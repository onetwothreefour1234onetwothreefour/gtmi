from fastapi import FastAPI
from pydantic import BaseModel
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from curl_cffi import requests as curl_requests
from bs4 import BeautifulSoup
import asyncio
import hashlib
import re
import time
import urllib.parse
from datetime import datetime, timezone

app = FastAPI()

# -----------------------------------------------------------------------------
# Rate limiting — per-domain minimum interval between requests.
# Prevents self-DoSing sites like OECD/MPI at scale and getting IP-banned.
# -----------------------------------------------------------------------------
_DOMAIN_LAST_HIT: dict[str, float] = {}
_DOMAIN_LOCK = asyncio.Lock()
_MIN_DOMAIN_INTERVAL_S = 2.0


async def _respect_rate_limit(url: str) -> None:
    domain = urllib.parse.urlparse(url).netloc.lower()
    async with _DOMAIN_LOCK:
        last = _DOMAIN_LAST_HIT.get(domain, 0.0)
        wait = _MIN_DOMAIN_INTERVAL_S - (time.monotonic() - last)
        if wait > 0:
            await asyncio.sleep(wait)
        _DOMAIN_LAST_HIT[domain] = time.monotonic()


# -----------------------------------------------------------------------------
# Challenge-page detection — bot-protection bodies served with HTTP 200 must
# fail loud so the caller retries with a different layer.
# -----------------------------------------------------------------------------
CHALLENGE_MARKERS = [
    "performing security verification",
    "you have been blocked",
    "unable to access",
    "checking your browser before",
    "attention required | cloudflare",
    "ray id:",
    "please enable javascript and cookies",
    "access denied",
    "just a moment...",
    "enable javascript to continue",
    "one more step",
    "verify you are human",
]


def is_challenge_body(content: str) -> bool:
    if not content:
        return False
    lowered = content.lower()
    trimmed_len = len(content.strip())
    return trimmed_len < 2000 and any(m in lowered for m in CHALLENGE_MARKERS)


# -----------------------------------------------------------------------------
# Content-quality gate — a scrape that returns <300 chars on a non-API URL is
# almost always a failure (empty render, redirect, auth wall). Treat as fail so
# fallback layer kicks in.
# -----------------------------------------------------------------------------
MIN_CONTENT_CHARS = 300


def is_usable_content(content: str) -> bool:
    return content is not None and len(content.strip()) >= MIN_CONTENT_CHARS


# -----------------------------------------------------------------------------
# HTML → text helper for curl_cffi + Wayback layers (Playwright has its own).
# -----------------------------------------------------------------------------
def html_to_text(html: str, only_main_content: bool = True) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    if only_main_content:
        for tag in soup.find_all(["nav", "footer"]):
            tag.decompose()
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"class": "content"})
        or soup.find(id="content")
        or soup.body
        or soup
    )
    text = main.get_text(separator="\n", strip=True)
    return re.sub(r"\n{3,}", "\n\n", text)


# -----------------------------------------------------------------------------
# Layer 1: Playwright + stealth
# -----------------------------------------------------------------------------
async def scrape_playwright(url: str, only_main_content: bool) -> tuple[int, str, str | None]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                },
            )
            page = await context.new_page()
            await stealth_async(page)
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            http_status = response.status if response else 0
            try:
                await page.wait_for_load_state("load", timeout=10000)
            except Exception:
                pass

            if only_main_content:
                await page.evaluate(
                    "() => { document.querySelectorAll('nav, footer').forEach(el => el.remove()); }"
                )

            content = await page.evaluate(
                """() => {
                    const main = document.querySelector('main') ||
                                 document.querySelector('article') ||
                                 document.querySelector('.content') ||
                                 document.querySelector('#content') ||
                                 document.body;
                    return main ? (main.innerText || '') : '';
                }"""
            )
            return http_status, content or "", None
        except Exception as e:
            return 0, "", str(e)
        finally:
            await browser.close()


# -----------------------------------------------------------------------------
# Layer 2: curl_cffi (Chrome-impersonating TLS fingerprint, no JS execution)
# Fast and often beats Cloudflare JS3 checks on pages where content is in the
# initial HTML.
# -----------------------------------------------------------------------------
def scrape_curl_cffi(url: str, only_main_content: bool) -> tuple[int, str, str | None]:
    try:
        resp = curl_requests.get(
            url,
            impersonate="chrome124",
            timeout=30,
            allow_redirects=True,
        )
        if resp.status_code >= 400:
            return resp.status_code, "", f"http_{resp.status_code}"
        text = html_to_text(resp.text, only_main_content=only_main_content)
        return resp.status_code, text, None
    except Exception as e:
        return 0, "", str(e)


# -----------------------------------------------------------------------------
# Layer 3: Jina Reader — free service that fetches any URL through its own
# infrastructure and returns cleaned markdown. Often bypasses Cloudflare on
# sites that block datacenter IPs (Jina has its own reputation).
# Docs: https://jina.ai/reader/  (free tier, rate-limited)
# -----------------------------------------------------------------------------
def scrape_jina(url: str) -> tuple[int, str, str | None]:
    try:
        # r.jina.ai/<url>  returns cleaned markdown of <url>
        jina_url = f"https://r.jina.ai/{url}"
        resp = curl_requests.get(
            jina_url,
            impersonate="chrome124",
            timeout=60,
            allow_redirects=True,
            headers={
                "Accept": "text/plain",
                "X-Return-Format": "text",
            },
        )
        if resp.status_code >= 400:
            return resp.status_code, "", f"jina_{resp.status_code}"
        text = resp.text or ""
        # Jina prefixes metadata like "Title:", "URL Source:". Strip to body.
        if "Markdown Content:" in text:
            text = text.split("Markdown Content:", 1)[1].strip()
        return resp.status_code, text, None
    except Exception as e:
        return 0, "", f"jina_exc:{e}"


# -----------------------------------------------------------------------------
# Layer 4: Wayback Machine — last-resort stale snapshot. Never bot-blocks.
# Goes direct to web.archive.org/web/ with id_ modifier to skip the availability
# API (heavily rate-limited) and skip toolbar injection. Wayback resolves the
# latest snapshot via HTTP redirect.
# -----------------------------------------------------------------------------
WAYBACK_UA = "Mozilla/5.0 (compatible; GTMIBot/1.0; +https://gtmi.example/bot)"


def scrape_wayback(url: str, only_main_content: bool) -> tuple[int, str, str | None]:
    try:
        # "2id_/<url>" → latest snapshot, raw HTML (no Wayback toolbar injection).
        snap_url = f"https://web.archive.org/web/2id_/{url}"
        resp = curl_requests.get(
            snap_url,
            impersonate="chrome124",
            timeout=40,
            allow_redirects=True,
            headers={"User-Agent": WAYBACK_UA},
        )
        if resp.status_code == 404:
            return 404, "", "no_wayback_snapshot"
        if resp.status_code >= 400:
            return resp.status_code, "", f"wayback_fetch_{resp.status_code}"
        text = html_to_text(resp.text, only_main_content=only_main_content)
        return resp.status_code, text, None
    except Exception as e:
        return 0, "", f"wayback_exc:{e}"


# -----------------------------------------------------------------------------
# Request / response models
# -----------------------------------------------------------------------------
class ScrapeRequest(BaseModel):
    url: str
    only_main_content: bool = True


class ScrapeResponse(BaseModel):
    url: str
    content_markdown: str
    http_status: int
    scraped_at: str
    content_hash: str
    error: str | None = None
    layer: str | None = None


# -----------------------------------------------------------------------------
# Orchestrator: try Layer 1 → 2 → 3 until one returns usable non-challenge
# content. First success wins; report which layer produced it.
# -----------------------------------------------------------------------------
@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(request: ScrapeRequest):
    await _respect_rate_limit(request.url)

    now_iso = lambda: datetime.now(timezone.utc).isoformat()
    attempts: list[str] = []

    # Layer 1: Playwright
    status, content, err = await scrape_playwright(request.url, request.only_main_content)
    if err is None and not is_challenge_body(content) and is_usable_content(content):
        return ScrapeResponse(
            url=request.url,
            content_markdown=content,
            http_status=status,
            scraped_at=now_iso(),
            content_hash=hashlib.sha256(content.encode()).hexdigest(),
            layer="playwright",
        )
    attempts.append(f"playwright:http={status},err={err or ('challenge' if is_challenge_body(content) else 'thin')}")

    # Layer 2: curl_cffi
    await _respect_rate_limit(request.url)
    status2, content2, err2 = await asyncio.to_thread(
        scrape_curl_cffi, request.url, request.only_main_content
    )
    if err2 is None and not is_challenge_body(content2) and is_usable_content(content2):
        return ScrapeResponse(
            url=request.url,
            content_markdown=content2,
            http_status=status2,
            scraped_at=now_iso(),
            content_hash=hashlib.sha256(content2.encode()).hexdigest(),
            layer="curl_cffi",
        )
    attempts.append(
        f"curl_cffi:http={status2},err={err2 or ('challenge' if is_challenge_body(content2) else 'thin')}"
    )

    # Layer 3: Jina Reader
    status3, content3, err3 = await asyncio.to_thread(scrape_jina, request.url)
    if err3 is None and not is_challenge_body(content3) and is_usable_content(content3):
        return ScrapeResponse(
            url=request.url,
            content_markdown=content3,
            http_status=status3,
            scraped_at=now_iso(),
            content_hash=hashlib.sha256(content3.encode()).hexdigest(),
            layer="jina",
        )
    attempts.append(
        f"jina:http={status3},err={err3 or ('challenge' if is_challenge_body(content3) else 'thin')}"
    )

    # Layer 4: Wayback
    status4, content4, err4 = await asyncio.to_thread(
        scrape_wayback, request.url, request.only_main_content
    )
    if err4 is None and not is_challenge_body(content4) and is_usable_content(content4):
        return ScrapeResponse(
            url=request.url,
            content_markdown=content4,
            http_status=status4,
            scraped_at=now_iso(),
            content_hash=hashlib.sha256(content4.encode()).hexdigest(),
            layer="wayback",
        )
    attempts.append(
        f"wayback:http={status4},err={err4 or ('challenge' if is_challenge_body(content4) else 'thin')}"
    )

    # All layers failed — surface loud so orchestrator doesn't cache garbage.
    return ScrapeResponse(
        url=request.url,
        content_markdown="",
        http_status=403,
        scraped_at=now_iso(),
        content_hash="",
        error=f"all_layers_failed: {'; '.join(attempts)}",
        layer="none",
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
