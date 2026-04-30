"""Phase 3.9 / W17 — integration tests for the PDF extraction path.

Exercises the helpers in scraper/main.py against:
  1. A pypdf-generated minimal PDF (always runs; no network).
  2. URL-suffix sniffing edge cases (always runs; no network).
  3. Live government PDFs (RUN_LIVE_PDF_TESTS=1; manual / pre-deploy).

The unit tier guarantees PR B's W1 code doesn't regress structurally.
The live tier validates real-world extraction quality before each
production deploy of the scraper service. Live tests are gated so the
default `pytest scraper/` invocation in CI stays hermetic.

Run:
    cd scraper && python -m pytest test_pdf_extract.py -v
    RUN_LIVE_PDF_TESTS=1 python -m pytest test_pdf_extract.py -v
"""
from __future__ import annotations

import io
import os

import pytest
import pypdf
from curl_cffi import requests as curl_requests

# main.py is in the same directory; fastapi/playwright imports are heavy
# but tolerable for a one-off test process.
import main as scraper_main  # type: ignore


# --- Synthetic minimal PDF ------------------------------------------------


def _build_minimal_pdf() -> bytes:
    """Generate a 1-page PDF in memory using pypdf itself.

    Blank page; no text content. Enough for `_extract_pdf_text` to walk
    the structure without crashing and return its `## Page N of M`
    header. Real text-recovery quality is exercised by the live tier.
    """
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=595, height=842)  # A4 in points
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _build_two_page_pdf() -> bytes:
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=595, height=842)
    writer.add_blank_page(width=595, height=842)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


# --- Unit tier: always runs ---------------------------------------------


class TestLooksLikePdfUrl:
    @pytest.mark.parametrize(
        "url,expected",
        [
            ("https://example.com/foo.pdf", True),
            ("https://example.com/foo.PDF", True),
            ("https://example.com/foo.pdf?download=1", True),
            ("https://example.com/foo.html", False),
            ("https://example.com/", False),
            ("https://example.com/foo.pdf.html", False),  # not actually a pdf
        ],
    )
    def test_url_suffix_detection(self, url: str, expected: bool) -> None:
        assert scraper_main._looks_like_pdf_url(url) is expected


class TestExtractPdfText:
    def test_minimal_pdf_returns_page_header(self) -> None:
        pdf_bytes = _build_minimal_pdf()
        out = scraper_main._extract_pdf_text(pdf_bytes)
        # Function should produce its `## Page 1 of 1` marker even for
        # a blank page, plus a trimmed body (which will be empty here).
        assert "Page 1 of 1" in out

    def test_two_page_pdf_returns_two_headers(self) -> None:
        pdf_bytes = _build_two_page_pdf()
        out = scraper_main._extract_pdf_text(pdf_bytes)
        assert "Page 1 of 2" in out
        assert "Page 2 of 2" in out

    def test_invalid_pdf_bytes_returns_error_marker(self) -> None:
        # Garbage bytes — pypdf raises during PdfReader construction;
        # `_extract_pdf_text` should catch and return an error marker.
        out = scraper_main._extract_pdf_text(b"not a real pdf")
        assert out.startswith("[pdf_read_error")


class TestScrapePdfHeaderValidation:
    def test_html_response_is_rejected_with_pdf_not_a_pdf(self, monkeypatch) -> None:
        """When curl_cffi succeeds (200) but the body isn't %PDF-, the
        function returns the explicit `pdf_not_a_pdf` error so callers
        don't try to parse HTML as PDF."""

        class FakeResp:
            status_code = 200
            content = b"<!DOCTYPE html><html><body>Hello</body></html>"

        def fake_get(*_args, **_kwargs):  # type: ignore[no-untyped-def]
            return FakeResp()

        monkeypatch.setattr(curl_requests, "get", fake_get)
        status, content, err = scraper_main.scrape_pdf("https://example.com/fake.pdf")
        assert status == 200
        assert content == ""
        assert err == "pdf_not_a_pdf"

    def test_real_pdf_round_trips_through_extract(self, monkeypatch) -> None:
        pdf_bytes = _build_minimal_pdf()

        class FakeResp:
            status_code = 200
            content = pdf_bytes

        def fake_get(*_args, **_kwargs):  # type: ignore[no-untyped-def]
            return FakeResp()

        monkeypatch.setattr(curl_requests, "get", fake_get)
        status, content, err = scraper_main.scrape_pdf("https://example.com/real.pdf")
        assert status == 200
        assert err is None
        assert "Page 1 of 1" in content


class TestPdfContentTypeDetection:
    def test_application_pdf_returns_true(self, monkeypatch) -> None:
        class FakeResp:
            status_code = 200
            headers = {"content-type": "application/pdf"}

        def fake_head(*_args, **_kwargs):  # type: ignore[no-untyped-def]
            return FakeResp()

        monkeypatch.setattr(curl_requests, "head", fake_head)
        assert scraper_main._detect_is_pdf("https://example.com/x") is True

    def test_text_html_falls_through_to_url_suffix(self, monkeypatch) -> None:
        class FakeResp:
            status_code = 200
            headers = {"content-type": "text/html; charset=utf-8"}

        def fake_head(*_args, **_kwargs):  # type: ignore[no-untyped-def]
            return FakeResp()

        monkeypatch.setattr(curl_requests, "head", fake_head)
        # text/html → returns False directly; URL suffix bypassed.
        assert scraper_main._detect_is_pdf("https://example.com/foo.pdf") is False

    def test_head_error_falls_through_to_url_suffix(self, monkeypatch) -> None:
        def fake_head(*_args, **_kwargs):  # type: ignore[no-untyped-def]
            raise RuntimeError("HEAD blocked")

        monkeypatch.setattr(curl_requests, "head", fake_head)
        # Suffix-based fallback applies; .pdf URL → True, .html URL → False.
        assert scraper_main._detect_is_pdf("https://example.com/foo.pdf") is True
        assert scraper_main._detect_is_pdf("https://example.com/foo.html") is False


# --- Live tier: gated --------------------------------------------------


LIVE_PDF_URLS = [
    # AUS skilled-occupation list — Department of Home Affairs
    "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189/points-tested/skilled-occupation-list",  # may not be PDF; placeholder
    # UK Home Office Skilled Worker fees (large; well-established)
    "https://www.gov.uk/government/publications/visa-regulations-revised-table",
    # Could also try a known-stable World Bank PDF for control
]


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_PDF_TESTS") != "1",
    reason="Live PDF tests gated on RUN_LIVE_PDF_TESTS=1",
)
class TestLivePdfExtraction:
    """Manual-trigger validation. Not run in CI by default.

    Set RUN_LIVE_PDF_TESTS=1 before deploying the scraper Cloud Run
    service to verify pypdf / pdfplumber still parse real-world
    government PDFs cleanly (e.g. after a pypdf version bump).
    """

    @pytest.mark.parametrize("url", LIVE_PDF_URLS)
    def test_live_pdf_returns_substantial_content(self, url: str) -> None:
        status, content, err = scraper_main.scrape_pdf(url)
        # When the URL is actually a PDF on a working server, expect:
        #   status 200, no error, > 500 chars of extracted text.
        # If the test URL happens to redirect to HTML (server change),
        # the assertion fails loud and the URL needs updating.
        assert err is None, f"{url} → error: {err}"
        assert status == 200, f"{url} → http {status}"
        assert len(content) > 500, f"{url} → only {len(content)} chars extracted"
        # Spot-check: a real government PDF will mention common policy
        # words. If none appear, the parser is likely producing garbage.
        common_tokens = [
            "visa",
            "skilled",
            "applicant",
            "occupation",
            "permit",
            "fee",
            "salary",
        ]
        text_lower = content.lower()
        assert any(
            tok in text_lower for tok in common_tokens
        ), f"{url} → none of {common_tokens} present in extracted text"
