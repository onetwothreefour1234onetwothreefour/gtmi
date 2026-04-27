/**
 * Phase 3 Pre-flight: Tier-1 URL drift sweep.
 *
 * Read-only. HEADs every Tier-1 URL across:
 *   - `sources` table (tier=1)
 *   - `scripts/country-sources.ts` COUNTRY_LEVEL_SOURCES (tier=1)
 *
 * Some servers reject HEAD; for those we fall back to a tiny GET (Range:
 * bytes=0-2047) and treat any 2xx as live. We DO NOT auto-replace anything.
 * The report is hand-reviewed by an analyst before any URL is changed —
 * a wrong replacement loses provenance continuity.
 *
 * Output (CSV):
 *   url, source ('db'|'registry'), country, status, finalUrl, redirected,
 *   probeMethod, contentLength, notes
 *
 * Status values:
 *   LIVE        — 2xx response
 *   REDIRECT    — 3xx response (final URL recorded)
 *   GONE        — 404 / 410
 *   ERROR_4xx   — other 4xx
 *   ERROR_5xx   — 5xx
 *   TIMEOUT     — fetch timed out
 *   NETWORK     — DNS / connection error
 *   SOFT_404    — 200 OK but body suspiciously short (<512 bytes on Range probe)
 *
 * Usage:
 *   npx tsx scripts/check-tier1-url-drift.ts \
 *     --countries AUS,SGP,CAN \
 *     --out docs/phase-3/baseline-url-drift.csv
 *
 * Concurrency: 8 parallel probes by default (--concurrency to override).
 */

import { client, db, sources } from '@gtmi/db';
import { inArray } from 'drizzle-orm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { COUNTRY_LEVEL_SOURCES } from './country-sources';

const TIMEOUT_MS = 15000;
const SOFT_404_THRESHOLD = 512;

type Status =
  | 'LIVE'
  | 'REDIRECT'
  | 'GONE'
  | 'ERROR_4xx'
  | 'ERROR_5xx'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SOFT_404';

interface ProbeRow {
  url: string;
  source: 'db' | 'registry';
  country: string;
  status: Status;
  finalUrl: string;
  redirected: boolean;
  probeMethod: 'HEAD' | 'GET-RANGE';
  contentLength: string;
  notes: string;
}

async function probe(url: string): Promise<ProbeRow> {
  const baseRow: Omit<
    ProbeRow,
    'status' | 'finalUrl' | 'redirected' | 'probeMethod' | 'contentLength' | 'notes'
  > = {
    url,
    source: 'db',
    country: '',
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // First try HEAD.
    let res: Response;
    let probeMethod: 'HEAD' | 'GET-RANGE' = 'HEAD';
    try {
      res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'user-agent': 'gtmi-url-drift-checker/1.0' },
      });
    } catch {
      // HEAD blocked or unsupported — fall back to a tiny ranged GET.
      probeMethod = 'GET-RANGE';
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'user-agent': 'gtmi-url-drift-checker/1.0',
          range: 'bytes=0-2047',
        },
      });
    }

    // Some servers respond 405 to HEAD even when GET works.
    if (res.status === 405 && probeMethod === 'HEAD') {
      probeMethod = 'GET-RANGE';
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'user-agent': 'gtmi-url-drift-checker/1.0',
          range: 'bytes=0-2047',
        },
      });
    }

    const finalUrl = res.url || url;
    const redirected = finalUrl !== url;
    const contentLength = res.headers.get('content-length') ?? '';

    let status: Status;
    let notes = '';
    if (res.status === 404 || res.status === 410) {
      status = 'GONE';
    } else if (res.status >= 500) {
      status = 'ERROR_5xx';
    } else if (res.status >= 400) {
      status = 'ERROR_4xx';
    } else if (res.status >= 300) {
      status = 'REDIRECT';
    } else if (res.status >= 200) {
      // 2xx — check for soft-404 if we did a body probe.
      if (probeMethod === 'GET-RANGE') {
        try {
          const text = await res.text();
          if (text.length < SOFT_404_THRESHOLD) {
            status = 'SOFT_404';
            notes = `body length=${text.length}`;
          } else {
            status = 'LIVE';
          }
        } catch {
          status = 'LIVE';
        }
      } else {
        status = 'LIVE';
      }
    } else {
      status = 'LIVE';
    }

    return {
      ...baseRow,
      status,
      finalUrl,
      redirected,
      probeMethod,
      contentLength,
      notes: notes || `status=${res.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = ctrl.signal.aborted;
    return {
      ...baseRow,
      status: isTimeout ? 'TIMEOUT' : 'NETWORK',
      finalUrl: url,
      redirected: false,
      probeMethod: 'HEAD',
      contentLength: '',
      notes: msg.slice(0, 200),
    };
  } finally {
    clearTimeout(t);
  }
}

async function probeAll(rows: ProbeRow[], concurrency: number): Promise<ProbeRow[]> {
  const results: ProbeRow[] = new Array(rows.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= rows.length) return;
      const row = rows[idx];
      const res = await probe(row.url);
      results[idx] = { ...res, source: row.source, country: row.country };
      const tag = `[${idx + 1}/${rows.length}]`;
      process.stderr.write(`${tag} ${res.status.padEnd(10)} ${row.url.slice(0, 90)}\n`);
    }
  });
  await Promise.all(workers);
  return results;
}

function csvEscape(s: string): string {
  if (s == null) return '';
  const cleaned = String(s)
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (/[",]/.test(cleaned)) return `"${cleaned.replace(/"/g, '""')}"`;
  return cleaned;
}

function parseArgs(argv: string[]): { countries: string[]; out?: string; concurrency: number } {
  let countries = ['AUS', 'SGP', 'CAN', 'GBR', 'HKG'];
  let out: string | undefined;
  let concurrency = 8;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--countries' && next) {
      countries = next
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      i++;
    } else if (a === '--out' && next) {
      out = next;
      i++;
    } else if (a === '--concurrency' && next) {
      concurrency = Math.max(1, Number(next) | 0);
      i++;
    }
  }
  return { countries, out, concurrency };
}

async function main() {
  const { countries, out, concurrency } = parseArgs(process.argv.slice(2));

  // 1. Pull tier-1 URLs from `sources` table for the requested countries
  //    (joined via programs.countryIso).
  const dbSourceRows = await db
    .select({
      url: sources.url,
      tier: sources.tier,
      programId: sources.programId,
    })
    .from(sources);

  // We don't have programs join filter here directly without another query;
  // fetch country mapping cheaply.
  const { programs } = await import('@gtmi/db');
  const progRows = await db
    .select({ id: programs.id, countryIso: programs.countryIso })
    .from(programs)
    .where(inArray(programs.countryIso, countries));
  const progCountry = new Map(progRows.map((p) => [p.id, p.countryIso]));
  const programIds = new Set(progRows.map((p) => p.id));

  const dbTier1: ProbeRow[] = dbSourceRows
    .filter((r) => r.tier === 1 && programIds.has(r.programId))
    .map((r) => ({
      url: r.url,
      source: 'db',
      country: progCountry.get(r.programId) ?? '',
      status: 'LIVE',
      finalUrl: '',
      redirected: false,
      probeMethod: 'HEAD',
      contentLength: '',
      notes: '',
    }));

  // 2. Pull tier-1 URLs from COUNTRY_LEVEL_SOURCES.
  const registryTier1: ProbeRow[] = COUNTRY_LEVEL_SOURCES.filter(
    (s) => s.tier === 1 && (!s.country || countries.includes(s.country))
  ).map((s) => ({
    url: s.url,
    source: 'registry',
    country: s.country ?? '__global__',
    status: 'LIVE',
    finalUrl: '',
    redirected: false,
    probeMethod: 'HEAD',
    contentLength: '',
    notes: '',
  }));

  // 3. De-dupe by URL — prefer 'db' source when both present, but record both.
  // We keep duplicates because the same URL appearing in both registry and DB is
  // a useful signal in the report.
  const all = [...dbTier1, ...registryTier1];
  process.stderr.write(
    `Probing ${all.length} Tier-1 URLs (${dbTier1.length} from DB, ${registryTier1.length} from registry) at concurrency=${concurrency}...\n\n`
  );

  // 4. Probe.
  const results = await probeAll(all, concurrency);

  // 5. Render CSV.
  const header = [
    'url',
    'source',
    'country',
    'status',
    'finalUrl',
    'redirected',
    'probeMethod',
    'contentLength',
    'notes',
  ];
  const lines = [header.join(',')];
  for (const r of results) {
    lines.push(
      [
        r.url,
        r.source,
        r.country,
        r.status,
        r.finalUrl,
        r.redirected ? 'true' : 'false',
        r.probeMethod,
        r.contentLength,
        r.notes,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  const csv = lines.join('\n') + '\n';

  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, csv, 'utf8');
  } else {
    process.stdout.write(csv);
  }

  // 6. Summary to stderr.
  const counts: Record<Status, number> = {
    LIVE: 0,
    REDIRECT: 0,
    GONE: 0,
    ERROR_4xx: 0,
    ERROR_5xx: 0,
    TIMEOUT: 0,
    NETWORK: 0,
    SOFT_404: 0,
  };
  for (const r of results) counts[r.status]++;
  process.stderr.write(`\nProbe summary:\n`);
  for (const [k, v] of Object.entries(counts)) {
    process.stderr.write(`  ${k.padEnd(10)} ${v}\n`);
  }
  if (out) process.stderr.write(`\nReport written → ${out}\n\n`);

  // Exit non-zero only on the no-URL case; problems with individual URLs are
  // expected and the report is the deliverable.
  if (results.length === 0) process.exit(2);
}

main()
  .then(async () => {
    await client.end({ timeout: 5 });
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await client.end({ timeout: 5 });
    } catch {
      // ignore
    }
    process.exit(1);
  });
