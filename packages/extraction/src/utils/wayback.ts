/**
 * Phase 3.10d / C.3 — Wayback Machine "Save Page Now" client.
 *
 * Archives a URL to https://web.archive.org/save/<url> and resolves to
 * the snapshot URL. Save-Page-Now is rate-limited and slow (30–60s
 * typical), so callers must:
 *
 *   1. Only call this on content drift (previous hash !== current hash).
 *   2. Treat the call as best-effort — never throw out of the call site.
 *      Wayback failures must not block the scrape pipeline.
 *   3. Honour a short timeout (default 60s) with AbortSignal.
 *
 * Configuration:
 *   - WAYBACK_ENABLED — must be 'true' to actually call Save Page Now.
 *     Otherwise archiveOnDrift returns null. Default: off.
 *   - WAYBACK_S3_ACCESS / WAYBACK_S3_SECRET — optional auth for the
 *     anonymous endpoint's higher rate-limit tier. When unset, the call
 *     uses the unauthenticated endpoint (lower rate-limit ceiling).
 */

const SAVE_PAGE_NOW_URL = 'https://web.archive.org/save/';
const WAYBACK_TIMEOUT_MS = 60_000;

export interface WaybackArchiveResult {
  /** The canonical web.archive.org snapshot URL. */
  archiveUrl: string;
  /** The snapshot timestamp in YYYYMMDDHHMMSS form when extractable. */
  capturedAt: string | null;
  /** Wall-clock duration of the call in ms. */
  durationMs: number;
}

export class WaybackError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'WaybackError';
  }
}

export function isWaybackEnabled(): boolean {
  return process.env['WAYBACK_ENABLED'] === 'true';
}

/**
 * Pull the snapshot URL out of the response. Save Page Now resolves to
 * a `Content-Location` header on success and otherwise produces a
 * canonical /web/<timestamp>/<original-url> path on the response URL.
 */
function readSnapshotUrl(response: Response, originalUrl: string): string | null {
  const contentLoc = response.headers.get('content-location');
  if (contentLoc) {
    return contentLoc.startsWith('http') ? contentLoc : `https://web.archive.org${contentLoc}`;
  }
  // Some Save Page Now responses include the snapshot URL in `Link`.
  const link = response.headers.get('link');
  if (link) {
    const match = link.match(/<(https:\/\/web\.archive\.org\/web\/[^>]+)>/);
    if (match && match[1]) return match[1];
  }
  // Fall back to the response URL when it includes /web/<timestamp>/.
  if (response.url && response.url.includes('/web/')) return response.url;
  // Last-resort: synthesise a "latest snapshot" URL — if Save Page Now
  // accepted the request but didn't populate the headers, this URL will
  // resolve to the most recent capture.
  return `https://web.archive.org/web/0/${originalUrl}`;
}

function readCapturedAt(snapshotUrl: string): string | null {
  const match = snapshotUrl.match(/\/web\/(\d{14})\//);
  return match && match[1] ? match[1] : null;
}

/**
 * Submit `url` to Save Page Now. Returns the snapshot URL on success.
 * Throws WaybackError on misconfiguration or non-2xx response — callers
 * should catch and degrade gracefully.
 */
export async function captureUrl(
  url: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<WaybackArchiveResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? WAYBACK_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  const headers: Record<string, string> = {
    accept: 'application/json,text/html,*/*;q=0.5',
    // Polite UA — Save Page Now classifies bots and rate-limits more
    // aggressively when the UA is missing or generic.
    'user-agent': 'gtmi-archival/1.0 (+https://gtmi.example)',
  };
  const accessKey = process.env['WAYBACK_S3_ACCESS'];
  const secretKey = process.env['WAYBACK_S3_SECRET'];
  if (accessKey && secretKey) {
    headers['authorization'] = `LOW ${accessKey}:${secretKey}`;
  }

  let response: Response;
  try {
    response = await fetchImpl(`${SAVE_PAGE_NOW_URL}${url}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    throw new WaybackError(`Save Page Now request failed: ${msg}`, null, err);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new WaybackError(
      `Save Page Now returned ${response.status}: ${response.statusText}`,
      response.status
    );
  }

  const snapshot = readSnapshotUrl(response, url);
  if (!snapshot) {
    throw new WaybackError('Save Page Now returned no snapshot URL', response.status);
  }
  return {
    archiveUrl: snapshot,
    capturedAt: readCapturedAt(snapshot),
    durationMs: Date.now() - start,
  };
}

/**
 * Best-effort archive-on-drift wrapper. Callers pass the URL and the
 * boolean drift signal (their already-computed hash comparison). The
 * helper:
 *
 *   - Returns null when WAYBACK_ENABLED is not 'true' (the default).
 *   - Returns null when `drift` is false (no work to do — most calls).
 *   - Returns null on any failure with a logged warning.
 *   - Returns the archive URL on success.
 */
export async function archiveOnDrift(
  url: string,
  drift: boolean
): Promise<WaybackArchiveResult | null> {
  if (!drift) return null;
  if (!isWaybackEnabled()) return null;
  try {
    return await captureUrl(url);
  } catch (err) {
    if (err instanceof WaybackError) {
      console.warn(
        `[wayback] capture failed for ${url}: ${err.message} (status=${err.statusCode ?? 'n/a'})`
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[wayback] capture threw for ${url}: ${msg}`);
    }
    return null;
  }
}
