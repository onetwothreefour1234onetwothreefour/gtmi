/**
 * Phase 3.10d / C.1 — minimal typed wrapper around the Exa search API
 * (https://docs.exa.ai/reference/search). Used by the news-signal-ingest
 * cron to find recent policy / programme coverage and by future Phase 6
 * source-discovery jobs.
 *
 * Single dependency: global fetch (Node 20+ / Cloud Run runtime). No SDK
 * — Exa's REST shape is small enough that pulling exa-js would be
 * overkill and would lock the bundle to one major version.
 *
 * Configuration: EXA_API_KEY env var. callers MUST guard with
 * `isExaConfigured()` and handle the no-config branch gracefully so
 * the news-signal-ingest cron stays no-op-able in dev.
 */

const EXA_API_URL = 'https://api.exa.ai/search';

export interface ExaSearchOptions {
  query: string;
  /** Cap the result set. Exa's hard ceiling is 100; we default to 10. */
  numResults?: number;
  /** ISO-8601 date strings; let Exa apply the published-date window. */
  startPublishedDate?: string;
  endPublishedDate?: string;
  /** Restrict to a domain (or an array of them). */
  includeDomains?: string[];
  /** Whether to include extracted text + summary. */
  contents?: {
    text?: boolean;
    summary?: boolean | { query?: string };
    highlights?: boolean | { numSentences?: number };
  };
  /** 'auto' (default) | 'neural' | 'keyword'. */
  type?: 'auto' | 'neural' | 'keyword';
  /** Use Exa's autoprompt rewrite. Default: true. */
  useAutoprompt?: boolean;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. Default: 30 seconds. */
  timeoutMs?: number;
}

export interface ExaResult {
  id: string;
  url: string;
  title: string | null;
  publishedDate: string | null;
  author: string | null;
  score: number | null;
  summary: string | null;
  text: string | null;
  highlights: string[] | null;
}

export interface ExaSearchResponse {
  results: ExaResult[];
  /** Echo of Exa's autoprompt rewrite when useAutoprompt=true. */
  autopromptString: string | null;
  /** Wall-clock ms the request took (round-trip + parse). */
  durationMs: number;
}

export class ExaError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ExaError';
  }
}

export function isExaConfigured(): boolean {
  return typeof process.env['EXA_API_KEY'] === 'string' && process.env['EXA_API_KEY'].length > 0;
}

interface RawExaResult {
  id?: string;
  url?: string;
  title?: string | null;
  publishedDate?: string | null;
  author?: string | null;
  score?: number | null;
  summary?: string | null;
  text?: string | null;
  highlights?: string[] | null;
}

interface RawExaResponse {
  results?: RawExaResult[];
  autopromptString?: string | null;
}

/**
 * POST a search to Exa and normalise the result. Throws ExaError on
 * misconfiguration (no API key) or non-2xx response — callers should
 * catch and degrade gracefully (return [] from the news-signal cron,
 * fall back to seed sources from a discovery job, etc).
 */
export async function exaSearch(options: ExaSearchOptions): Promise<ExaSearchResponse> {
  const apiKey = process.env['EXA_API_KEY'];
  if (!apiKey) {
    throw new ExaError('EXA_API_KEY is not configured', null);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  const body: Record<string, unknown> = {
    query: options.query,
    numResults: options.numResults ?? 10,
    type: options.type ?? 'auto',
    useAutoprompt: options.useAutoprompt ?? true,
  };
  if (options.startPublishedDate) body['startPublishedDate'] = options.startPublishedDate;
  if (options.endPublishedDate) body['endPublishedDate'] = options.endPublishedDate;
  if (options.includeDomains && options.includeDomains.length > 0) {
    body['includeDomains'] = options.includeDomains;
  }
  if (options.contents) body['contents'] = options.contents;

  let response: Response;
  try {
    response = await fetchImpl(EXA_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    throw new ExaError(`Exa request failed: ${msg}`, null, err);
  }
  clearTimeout(timer);

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ExaError(
      `Exa returned ${response.status}: ${detail.slice(0, 200) || response.statusText}`,
      response.status
    );
  }

  let parsed: RawExaResponse;
  try {
    parsed = (await response.json()) as RawExaResponse;
  } catch (err) {
    throw new ExaError('Exa returned non-JSON', response.status, err);
  }

  const results: ExaResult[] = (parsed.results ?? [])
    .filter((r): r is RawExaResult & { id: string; url: string } => Boolean(r?.id && r?.url))
    .map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title ?? null,
      publishedDate: r.publishedDate ?? null,
      author: r.author ?? null,
      score: typeof r.score === 'number' ? r.score : null,
      summary: r.summary ?? null,
      text: r.text ?? null,
      highlights: Array.isArray(r.highlights) ? r.highlights : null,
    }));

  return {
    results,
    autopromptString: parsed.autopromptString ?? null,
    durationMs: Date.now() - start,
  };
}

/**
 * Convenience wrapper for the news-signal-ingest cron: search a single
 * publication's domain for content published in the last `windowHours`
 * referencing the GTMI keyword set.
 */
export async function exaSearchPublicationWindow(
  publicationDomain: string,
  windowHours: number,
  query = 'talent visa OR golden visa OR mobility programme policy change'
): Promise<ExaSearchResponse> {
  const now = Date.now();
  const start = new Date(now - windowHours * 60 * 60 * 1000).toISOString();
  const end = new Date(now).toISOString();
  return exaSearch({
    query,
    numResults: 25,
    startPublishedDate: start,
    endPublishedDate: end,
    includeDomains: [publicationDomain],
    contents: { summary: true, highlights: { numSentences: 3 } },
    type: 'auto',
    useAutoprompt: true,
  });
}
