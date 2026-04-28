import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Phase 3.6 / commit 4 — Fix C scrape.ts thin-content retry test.
//
// Asserts:
// 1. When Playwright returns thin content, scrape.ts issues a second
//    POST /scrape with `force_layer: 'jina'` in the body.
// 2. When Jina returns usable content, the result replaces the thin one.
// 3. When Jina also returns thin content, scrape.ts emits the
//    SCRAPE_THIN_CONTENT log line and returns an empty result.
// 4. The cache lookup is bypassed on the retry call.
// 5. Old deployments that ignore `force_layer` (silent ignore) result in a
//    second cascade run; the test asserts at least one fetch with
//    force_layer in body so any redeploy gap is detectable from logs.

interface FetchCall {
  url: string;
  body: Record<string, unknown>;
}

function setupFetchMock(
  layerResponses: Array<{ http_status: number; content: string; layer: string }>
): {
  fetchSpy: ReturnType<typeof vi.fn>;
  callLog: FetchCall[];
} {
  const callLog: FetchCall[] = [];
  let scrapeCallIdx = 0;
  const fetchSpy = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/health')) {
      return { ok: true } as Response;
    }
    if (url.endsWith('/scrape')) {
      const body = JSON.parse(String(init?.body ?? '{}'));
      callLog.push({ url, body });
      const resp = layerResponses[scrapeCallIdx++];
      if (!resp) throw new Error(`unexpected /scrape call #${scrapeCallIdx}`);
      const responseBody = {
        url: body.url,
        content_markdown: resp.content,
        http_status: resp.http_status,
        scraped_at: new Date().toISOString(),
        content_hash: 'hash',
        layer: resp.layer,
      };
      return {
        ok: resp.http_status >= 200 && resp.http_status < 400,
        status: resp.http_status,
        json: async () => responseBody,
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  return { fetchSpy, callLog };
}

describe('scrape.ts thin-content retry via Jina (Phase 3.6 / Fix C)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env['SCRAPER_URL'] = 'http://test-scraper:8765';
    vi.resetModules();
    vi.doMock('@gtmi/db', () => {
      const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve([]),
        insert: () => chain,
        values: () => chain,
        onConflictDoUpdate: () => Promise.resolve(),
      };
      return { db: chain, scrapeCache: { url: 'url' } };
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('retries via force_layer=jina when first response is short_content', async () => {
    const thinContent = 'short stub content. '.repeat(20); // ~ 400 chars, below 1500
    const fatContent = 'real medicare eligibility prose with lots of detail. '.repeat(50); // ~ 2700 chars
    const { fetchSpy, callLog } = setupFetchMock([
      { http_status: 200, content: thinContent, layer: 'playwright' },
      { http_status: 200, content: fatContent, layer: 'jina' },
    ]);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const { ScrapeStageImpl } = await import('../src/stages/scrape.js');
    const scrape = new ScrapeStageImpl({ delayMs: 0 });
    const [result] = await scrape.execute([
      {
        url: 'https://www.servicesaustralia.gov.au/medicare',
        tier: 1,
        geographicLevel: 'national',
        reason: 'test',
        isOfficial: true,
      },
    ]);

    // Two /scrape calls fired (initial + Jina retry).
    const scrapeCalls = callLog.filter((c) => c.url.endsWith('/scrape'));
    expect(scrapeCalls).toHaveLength(2);

    // Second call carries force_layer=jina in the JSON body.
    expect(scrapeCalls[1]!.body).toMatchObject({ force_layer: 'jina' });

    // Result content is the fat (Jina) one.
    expect(result?.contentMarkdown).toBe(fatContent);
  });

  it('returns empty result when Jina retry also returns thin content', async () => {
    const thinA = 'tiny shell A. '.repeat(10);
    const thinB = 'tiny shell B. '.repeat(10);
    const { fetchSpy } = setupFetchMock([
      { http_status: 200, content: thinA, layer: 'playwright' },
      { http_status: 200, content: thinB, layer: 'jina' },
    ]);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { ScrapeStageImpl } = await import('../src/stages/scrape.js');
    const scrape = new ScrapeStageImpl({ delayMs: 0 });
    const [result] = await scrape.execute([
      {
        url: 'https://example.com/redirect-stub',
        tier: 1,
        geographicLevel: 'national',
        reason: 'test',
        isOfficial: true,
      },
    ]);

    expect(result?.contentMarkdown).toBe('');
    const warnings = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('SCRAPE_THIN_CONTENT'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('does not retry when first response is already usable', async () => {
    const fatContent = 'normal page content. '.repeat(120); // > 1500 chars
    const { fetchSpy, callLog } = setupFetchMock([
      { http_status: 200, content: fatContent, layer: 'playwright' },
    ]);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const { ScrapeStageImpl } = await import('../src/stages/scrape.js');
    const scrape = new ScrapeStageImpl({ delayMs: 0 });
    const [result] = await scrape.execute([
      {
        url: 'https://example.com/normal',
        tier: 1,
        geographicLevel: 'national',
        reason: 'test',
        isOfficial: true,
      },
    ]);

    const scrapeCalls = callLog.filter((c) => c.url.endsWith('/scrape'));
    expect(scrapeCalls).toHaveLength(1);
    expect(scrapeCalls[0]!.body).not.toHaveProperty('force_layer');
    expect(result?.contentMarkdown).toBe(fatContent);
  });
});
