export const SOFT_404_PATTERNS: RegExp[] = [
  /\b404\b.*\bnot found\b/i,
  /\bpage (not|cannot be) found\b/i,
  /\bcan't find (the )?page\b/i,
  /\bthis page (doesn't|does not) exist\b/i,
];

export const MIN_VISIBLE_TEXT_LENGTH = 300;

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
