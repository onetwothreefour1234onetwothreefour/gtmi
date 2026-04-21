import { client } from '@gtmi/db';
import { COUNTRY_LEVEL_SOURCES } from './country-sources';

const SCRAPER_URL = process.env['SCRAPER_URL'] ?? 'http://localhost:8765';

type AuditRow = {
  url: string;
  origin: string;
  httpStatus: number;
  contentLen: number;
  error: string | null;
  durationMs: number;
  klass: string;
  sample: string;
};

const CHALLENGE_PHRASES = [
  'performing security verification',
  'you have been blocked',
  'unable to access',
  'attention required',
  'ray id',
  'just a moment',
  'please enable javascript',
  'access denied',
  'checking your browser',
];

function classify(httpStatus: number, content: string, error: string | null): string {
  if (error === 'challenge_page_detected') return 'A_challenge';
  if (httpStatus === 0 && (error ?? '').toLowerCase().includes('navigation'))
    return 'B_waf_context_destroyed';
  if (httpStatus === 0) return 'unreachable';
  if (httpStatus === 403) return 'A_challenge';
  if (httpStatus === 404) return 'G_dead_url';
  if (httpStatus >= 400 && httpStatus < 500) return `HTTP_${httpStatus}`;
  if (httpStatus >= 500) return 'server_error';
  const trimmed = content.trim();
  if (trimmed.length === 0) return 'C_empty_render';
  const lowered = trimmed.toLowerCase();
  if (CHALLENGE_PHRASES.some((p) => lowered.includes(p)) && trimmed.length < 2000)
    return 'A_challenge_undetected';
  if (trimmed.length < 500) return 'C_thin_content';
  if (content.toLowerCase().includes('.pdf') && content.length < 1000) return 'E_pdf_maybe';
  return 'OK';
}

async function probe(url: string): Promise<Omit<AuditRow, 'origin'>> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, only_main_content: true }),
      signal: AbortSignal.timeout(60000),
    });
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      return {
        url,
        httpStatus: res.status,
        contentLen: 0,
        error: `fetch_not_ok_${res.status}`,
        durationMs,
        klass: 'scraper_error',
        sample: '',
      };
    }
    const data = (await res.json()) as {
      content_markdown: string;
      http_status: number;
      error?: string | null;
    };
    const content = data.content_markdown ?? '';
    const klass = classify(data.http_status, content, data.error ?? null);
    return {
      url,
      httpStatus: data.http_status,
      contentLen: content.length,
      error: data.error ?? null,
      durationMs,
      klass,
      sample: content.slice(0, 160).replace(/\s+/g, ' '),
    };
  } catch (e) {
    const durationMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      url,
      httpStatus: 0,
      contentLen: 0,
      error: msg,
      durationMs,
      klass: 'network_error',
      sample: '',
    };
  }
}

async function main() {
  const urls = new Map<string, string>(); // url -> origin label

  for (const s of COUNTRY_LEVEL_SOURCES) urls.set(s.url, 'country-level');

  const discoveryRows = await client<{ url: string }[]>`
    SELECT DISTINCT (jsonb_array_elements(discovered_urls)->>'url') AS url
    FROM discovery_cache
  `;
  for (const r of discoveryRows) if (r.url) urls.set(r.url, urls.get(r.url) ?? 'discovered');

  const scrapeRows = await client<{ url: string }[]>`SELECT DISTINCT url FROM scrape_cache`;
  for (const r of scrapeRows) urls.set(r.url, urls.get(r.url) ?? 'scrape-cache');

  console.log(`[audit] probing ${urls.size} distinct URLs against ${SCRAPER_URL}`);

  const rows: AuditRow[] = [];
  let i = 0;
  for (const [url, origin] of urls) {
    i++;
    process.stdout.write(`[${i}/${urls.size}] ${url}\n`);
    const r = await probe(url);
    rows.push({ ...r, origin });
    await new Promise((res) => setTimeout(res, 600));
  }

  const byClass = new Map<string, AuditRow[]>();
  for (const r of rows) {
    if (!byClass.has(r.klass)) byClass.set(r.klass, []);
    byClass.get(r.klass)!.push(r);
  }

  console.log('\n===== AUDIT SUMMARY =====');
  const sorted = [...byClass.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [klass, items] of sorted) {
    console.log(`\n[${klass}] — ${items.length} URLs`);
    for (const r of items.slice(0, 10)) {
      console.log(
        `  ${r.url}  (HTTP ${r.httpStatus}, ${r.contentLen} chars, ${r.durationMs}ms)` +
          (r.error ? ` err=${r.error.slice(0, 80)}` : '')
      );
    }
    if (items.length > 10) console.log(`  ... (+${items.length - 10} more)`);
  }

  console.log('\n===== SUCCESS RATE =====');
  const ok = byClass.get('OK')?.length ?? 0;
  console.log(`OK: ${ok}/${rows.length} (${((ok / rows.length) * 100).toFixed(1)}%)`);

  const outPath = `logs/scrape-audit-${new Date().toISOString().slice(0, 10)}.json`;
  const fs = await import('fs');
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
  console.log(`\nFull results written to ${outPath}`);

  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
