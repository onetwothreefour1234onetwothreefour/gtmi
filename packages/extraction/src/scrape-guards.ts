export const SOFT_404_PATTERNS: RegExp[] = [
  /\b404\b.*\bnot found\b/i,
  /\bpage (not|cannot be) found\b/i,
  /\bcan't find (the )?page\b/i,
  /\bthis page (doesn't|does not) exist\b/i,
];

// Phase 3.6 / Fix C — raised from 300 → 1500. The AUS Medicare URL
// returned 484 chars (a redirect-stub page with the actual content one
// layer behind a JS-gated SPA shell) and silently passed the old guard
// while producing zero extractions. 1500 is the empirical floor below
// which a government page is functionally an empty shell. Below this
// threshold scrape.ts retries once via the Jina reader (force_layer=jina);
// if Jina still returns thin content, the field is logged
// SCRAPE_THIN_CONTENT and treated as ABSENT.
export const MIN_VISIBLE_TEXT_LENGTH = 1500;

export type ScrapeStatus =
  | 'ok'
  | 'http_error'
  | 'soft_404'
  | 'short_content'
  | 'client_rendered'
  | 'other';

export type ScrapeGuardResult =
  | { ok: true }
  | { ok: false; status: Exclude<ScrapeStatus, 'ok'>; reason: string };

export function visibleTextLength(markdown: string): number {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*`_>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

export function checkScrapeContent(content: string, httpStatus: number): ScrapeGuardResult {
  if (httpStatus >= 400) {
    return { ok: false, status: 'http_error', reason: `HTTP ${httpStatus}` };
  }

  const snippet = content.slice(0, 2048);
  for (const pattern of SOFT_404_PATTERNS) {
    if (pattern.test(snippet)) {
      return { ok: false, status: 'soft_404', reason: `matched pattern: ${pattern.source}` };
    }
  }

  const vLen = visibleTextLength(content);
  if (vLen < MIN_VISIBLE_TEXT_LENGTH) {
    return {
      ok: false,
      status: 'short_content',
      reason: `visible text length ${vLen} < ${MIN_VISIBLE_TEXT_LENGTH}`,
    };
  }

  return { ok: true };
}
