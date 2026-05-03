// Phase 3.10c.5 — Phase 6 (Living Index): news-signal-ingest scaffold.
//
// Tier 3 news-signal ingestion via Exa semantic search. Loads
// `news_sources` (seeded in Phase 1), runs a daily Exa query per
// source bounded to the prior 24h, writes hits into `news_signals`
// (extended in migration 00021).
//
// This commit ships the SCAFFOLD: the Trigger.dev task is wired,
// the source-loop walks the registry, the dedupe-on-source_url
// constraint is in place, and the database write happens through
// onConflictDoNothing. The Exa client itself is gated behind
// EXA_API_KEY — when absent (the default in dev / unset prod), the
// job loops without making outbound calls and exits with `mode='stub'`.
//
// Cron: daily at 06:00 UTC.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, newsSignals, newsSources } from '@gtmi/db';
import { ExaError, exaSearchPublicationWindow, isExaConfigured } from '@gtmi/extraction';
import { eq } from 'drizzle-orm';

interface IngestHit {
  sourceUrl: string;
  publication: string;
  headline: string;
  publishedAt: Date | null;
  aiSummary: string | null;
  severityHint: 'breaking' | 'material' | 'minor' | 'unknown' | null;
  countryIso: string | null;
}

const SEVERITY_KEYWORDS: { regex: RegExp; severity: IngestHit['severityHint'] }[] = [
  // Order matters — first match wins. "breaking" is the strongest cue.
  { regex: /\b(suspend|abolish|repeal|terminat|shut down|closes?)\b/i, severity: 'breaking' },
  { regex: /\b(announce|launch|expand|cap|quota|cut|raise|introduc)\b/i, severity: 'material' },
  { regex: /\b(extend|renew|update|revise|amend)\b/i, severity: 'minor' },
];

function classifySeverity(text: string): IngestHit['severityHint'] {
  for (const { regex, severity } of SEVERITY_KEYWORDS) {
    if (regex.test(text)) return severity;
  }
  return 'unknown';
}

/**
 * Phase 3.10d / C.1 — call Exa for the last 24h of coverage at this
 * publication and project Exa's results onto the IngestHit shape.
 *
 * No-config branch (no EXA_API_KEY): returns [] so the cron's wrapper
 * stays happy in dev. ExaError branch: log + return []; one failing
 * publication shouldn't take down the whole batch.
 */
async function exaSearch(publication: string, windowHours: number): Promise<IngestHit[]> {
  if (!isExaConfigured()) return [];

  const domain = extractDomain(publication);
  if (!domain) return [];

  let response;
  try {
    response = await exaSearchPublicationWindow(domain, windowHours);
  } catch (err) {
    if (err instanceof ExaError) {
      console.warn(
        `[news-signal-ingest] Exa call failed for ${publication}: ${err.message} (status=${err.statusCode ?? 'n/a'})`
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[news-signal-ingest] Exa call threw for ${publication}: ${msg}`);
    }
    return [];
  }

  return response.results.map<IngestHit>((r) => {
    const headlineSource = r.title ?? '';
    const summarySource = r.summary ?? r.highlights?.join(' ') ?? null;
    return {
      sourceUrl: r.url,
      publication,
      headline: headlineSource,
      publishedAt: r.publishedDate ? new Date(r.publishedDate) : null,
      aiSummary: summarySource,
      severityHint: classifySeverity(`${headlineSource} ${summarySource ?? ''}`),
      // Country routing is deferred to the policy-change job (Phase 6) —
      // we don't have a domain → ISO map here, so we leave it null and
      // let downstream reviewers tag manually.
      countryIso: null,
    };
  });
}

function extractDomain(urlOrDomain: string): string | null {
  const trimmed = urlOrDomain.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('://')) {
    return trimmed.replace(/\/.*$/, '').toLowerCase();
  }
  try {
    const u = new URL(trimmed);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function loadActiveSources(): Promise<{ id: string; url: string; publication: string }[]> {
  return await db
    .select({ id: newsSources.id, url: newsSources.url, publication: newsSources.publication })
    .from(newsSources)
    .where(eq(newsSources.isActive, true));
}

async function persistHit(hit: IngestHit): Promise<boolean> {
  try {
    await db
      .insert(newsSignals)
      .values({
        sourceUrl: hit.sourceUrl,
        publication: hit.publication,
        headline: hit.headline,
        publishedAt: hit.publishedAt,
        aiSummary: hit.aiSummary,
        severityHint: hit.severityHint,
        countryIso: hit.countryIso,
      })
      .onConflictDoNothing({ target: newsSignals.sourceUrl });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[news-signal-ingest] persist failed for ${hit.sourceUrl}: ${msg}`);
    return false;
  }
}

export const newsSignalIngest = schedules.task({
  id: 'news-signal-ingest',
  // Daily at 06:00 UTC.
  cron: '0 6 * * *',
  maxDuration: 1800,
  run: async (): Promise<{
    status: 'ok';
    mode: 'stub' | 'live';
    sourcesScanned: number;
    hitsFound: number;
    hitsWritten: number;
  }> => {
    const mode: 'stub' | 'live' = isExaConfigured() ? 'live' : 'stub';
    console.log(`[news-signal-ingest] starting in ${mode} mode`);

    const sources = await loadActiveSources();
    console.log(`[news-signal-ingest] ${sources.length} active news sources to scan`);

    let totalHits = 0;
    let totalWritten = 0;

    for (const src of sources) {
      const hits = await exaSearch(src.url, 24);
      totalHits += hits.length;
      for (const h of hits) {
        // Stamp the publication if the stub left it empty.
        const enriched: IngestHit = { ...h, publication: h.publication || src.publication };
        const ok = await persistHit(enriched);
        if (ok) totalWritten++;
      }
    }

    console.log(
      `[news-signal-ingest] done; mode=${mode} sourcesScanned=${sources.length} hits=${totalHits} written=${totalWritten}`
    );
    return {
      status: 'ok',
      mode,
      sourcesScanned: sources.length,
      hitsFound: totalHits,
      hitsWritten: totalWritten,
    };
  },
});

export { exaSearch, persistHit, loadActiveSources };
