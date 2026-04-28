import { describe, expect, it } from 'vitest';
import {
  MIN_VISIBLE_TEXT_LENGTH,
  SOFT_404_PATTERNS,
  checkScrapeContent,
  visibleTextLength,
} from '../src/scrape-guards';

// ---------------------------------------------------------------------------
// visibleTextLength
// ---------------------------------------------------------------------------

describe('visibleTextLength', () => {
  it('strips markdown links and images', () => {
    const md = '![alt](img.png) [click here](https://example.com)';
    expect(visibleTextLength(md)).toBe(0);
  });

  it('strips markdown symbols', () => {
    const md = '## Heading\n**bold** `code` > blockquote';
    expect(visibleTextLength(md)).toBeGreaterThan(0);
  });

  it('counts plain prose correctly', () => {
    const prose = 'a'.repeat(400);
    expect(visibleTextLength(prose)).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// SOFT_404_PATTERNS
// ---------------------------------------------------------------------------

describe('SOFT_404_PATTERNS', () => {
  const matches = (text: string) => SOFT_404_PATTERNS.some((p) => p.test(text));

  it('matches "404 not found"', () => expect(matches('Error 404 not found')).toBe(true));
  it('matches "page not found"', () => expect(matches('The page not found')).toBe(true));
  it('matches "page cannot be found"', () => expect(matches('page cannot be found')).toBe(true));
  it('matches "can\'t find the page"', () => expect(matches("We can't find the page")).toBe(true));
  it('does not match valid content', () =>
    expect(matches('Apply online for a skilled visa in Australia')).toBe(false));
});

// ---------------------------------------------------------------------------
// checkScrapeContent — the six real failure categories from the AUS canary audit
// ---------------------------------------------------------------------------

describe('checkScrapeContent', () => {
  it('rejects HTTP 404 (hard 404)', () => {
    const result = checkScrapeContent('', 404);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('http_error');
  });

  it('rejects HTTP 403 (access blocked)', () => {
    const result = checkScrapeContent('some content here', 403);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('http_error');
  });

  it('rejects soft-404: HTTP 200 + "page not found" body (Services Australia pattern)', () => {
    const body = `
# Sorry, we can't find that page
This page not found. Please check the URL or go to our home page.
`.repeat(10);
    const result = checkScrapeContent(body, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('soft_404');
  });

  it('rejects soft-404: HTTP 200 + "404 not found" in body (OECD pattern)', () => {
    const body = 'OECD — 404 not found\nThe requested resource could not be located.\n'.repeat(5);
    const result = checkScrapeContent(body, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('soft_404');
  });

  it('rejects client-rendered shell: HTTP 200 but only nav/script markup (Home Affairs pattern)', () => {
    // 323 chars of nav-only content — well below MIN_VISIBLE_TEXT_LENGTH
    const navShell =
      '[Home](/) [Visas](/visas) [Work](/work) [Skilled](/skilled) [482](/482) [Contact](/contact)';
    expect(navShell.length).toBeLessThan(MIN_VISIBLE_TEXT_LENGTH * 3);
    const result = checkScrapeContent(navShell, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('short_content');
  });

  it('accepts a normal page with sufficient prose content', () => {
    const body = `
# Temporary Skill Shortage visa (subclass 482) — Core Skills stream

The Core Skills stream allows Australian employers to sponsor skilled workers
from overseas when they cannot source suitably qualified Australians.
Applicants must hold a relevant qualification and have at least two years of
recent full-time work experience in the nominated occupation.
    `.repeat(8);
    const result = checkScrapeContent(body, 200);
    expect(result.ok).toBe(true);
  });

  // Phase 3.6 / Fix C — regression test for the AUS Medicare 484-char case.
  it('rejects 484-char redirect-stub page (AUS Medicare regression)', () => {
    // 484 chars of prose — passes the old 300-char threshold, fails the
    // new 1500-char threshold. Reproduces the exact bug from the AUS
    // re-canary where the Medicare URL produced zero extractions.
    const body =
      'Medicare is the Australian universal health insurance scheme. ' +
      'It provides access to subsidised health care for eligible residents. ' +
      'For information about eligibility, including who can enrol and what ' +
      'documents are required, please visit the dedicated eligibility page. ' +
      'New residents can apply online via myGov once they arrive in Australia. ' +
      'Verification of identity may take additional time during peak periods.';
    expect(body.length).toBeGreaterThan(300);
    expect(body.length).toBeLessThan(1500);
    const result = checkScrapeContent(body, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('short_content');
  });

  it('threshold is 1500 chars (Phase 3.6 / Fix C)', () => {
    expect(MIN_VISIBLE_TEXT_LENGTH).toBe(1500);
  });

  it('rejects HTTP 503 (service unavailable)', () => {
    const result = checkScrapeContent('503 Service Unavailable', 503);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('http_error');
  });
});
