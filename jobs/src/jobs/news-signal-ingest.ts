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

/**
 * Stub Exa client. When EXA_API_KEY is set, swap for the real client.
 * The contract: take a publication URL + a 24h window, return zero or
 * more hits in the IngestHit shape. Real implementation will live in
 * a separate exa-client.ts under @gtmi/extraction.
 */
async function exaSearch(_publication: string, _windowHours: number): Promise<IngestHit[]> {
  if (!process.env['EXA_API_KEY']) return [];
  // TODO(Phase 6): implement against https://exa.ai/api
  return [];
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
    const mode: 'stub' | 'live' = process.env['EXA_API_KEY'] ? 'live' : 'stub';
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
