from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from playwright.async_api import async_playwright
import asyncio
import hashlib
from datetime import datetime, timezone

app = FastAPI()

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

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(request: ScrapeRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()
        try:
            response = await page.goto(
                request.url,
                wait_until="networkidle",
                timeout=30000
            )
            http_status = response.status if response else 0

            if request.only_main_content:
                # Remove nav, footer, header, cookie banners
                await page.evaluate("""
                    () => {
                        const selectors = [
                            'nav', 'footer', 'header',
                            '[class*="cookie"]', '[class*="banner"]',
                            '[class*="popup"]', '[id*="cookie"]',
                            '[class*="nav"]', '[class*="menu"]',
                            '[class*="sidebar"]', '[class*="breadcrumb"]'
                        ];
                        selectors.forEach(sel => {
                            document.querySelectorAll(sel)
                                .forEach(el => el.remove());
                        });
                    }
                """)

            # Extract main content as text
            content = await page.evaluate("""
                () => {
                    const main = document.querySelector('main') ||
                                 document.querySelector('article') ||
                                 document.querySelector('.content') ||
                                 document.querySelector('#content') ||
                                 document.body;
                    return main ? main.innerText : document.body.innerText;
                }
            """)

            content_hash = hashlib.sha256(
                content.encode()
            ).hexdigest()

            return ScrapeResponse(
                url=request.url,
                content_markdown=content,
                http_status=http_status,
                scraped_at=datetime.now(timezone.utc).isoformat(),
                content_hash=content_hash,
            )
        except Exception as e:
            return ScrapeResponse(
                url=request.url,
                content_markdown="",
                http_status=0,
                scraped_at=datetime.now(timezone.utc).isoformat(),
                content_hash="",
                error=str(e),
            )
        finally:
            await browser.close()

@app.get("/health")
async def health():
    return {"status": "ok"}
