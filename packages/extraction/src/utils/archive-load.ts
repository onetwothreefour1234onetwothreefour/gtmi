// Phase 3.9 / W6 — load a ScrapeResult from the GCS archive instead
// of re-fetching the URL.
//
// Used by:
//   - canary-run.ts `--mode archive-first` / `--mode archive-only`
//   - jobs/weekly-maintenance-scrape (PR D commit 3)
//   - the /review re-extract action (already wired in PR A commit 7)
//
// Best-effort: every failure path (no sources row, no archive row,
// GCS download error) returns null and logs a warning. The caller
// decides whether to fall back to a live scrape or skip the URL.

import { db, scrapeHistory, sources } from '@gtmi/db';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getStorage } from '@gtmi/storage';
import type { DiscoveredUrl, ScrapeResult } from '../types/extraction';

export interface LoadArchivedScrapeArgs {
  programId: string;
  url: string;
}

/**
 * Resolve the most recent archived scrape for a (program, URL) pair
 * and download its bytes from GCS. Returns a ScrapeResult shaped
 * identically to a live scrape so downstream stages don't need to
 * know whether the content came from archive or live fetch.
 *
 * Sets `scrapeHistoryId`, `archivePath`, and marks `unchanged: true`
 * so the W11 short-circuit fires (extract.ts skips the LLM batch
 * because the existing field_values rows are still authoritative for
 * this content_hash).
 */
export async function loadArchivedScrape(
  args: LoadArchivedScrapeArgs
): Promise<ScrapeResult | null> {
  // 1. Resolve the source_id by (program_id, url).
  let sourceId: string | null = null;
  try {
    const rows = await db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.programId, args.programId), eq(sources.url, args.url)))
      .limit(1);
    sourceId = rows[0]?.id ?? null;
  } catch {
    return null;
  }
  if (sourceId === null) return null;

  // 2. Find the latest archived scrape_history row.
  let archive: {
    id: string;
    scrapedAt: Date;
    contentHash: string | null;
    storagePath: string | null;
    httpStatus: number | null;
    contentType: string | null;
  } | null = null;
  try {
    const rows = await db
      .select({
        id: scrapeHistory.id,
        scrapedAt: scrapeHistory.scrapedAt,
        contentHash: scrapeHistory.contentHash,
        storagePath: scrapeHistory.storagePath,
        httpStatus: scrapeHistory.httpStatus,
        contentType: scrapeHistory.contentType,
      })
      .from(scrapeHistory)
      .where(and(eq(scrapeHistory.sourceId, sourceId), isNotNull(scrapeHistory.storagePath)))
      .orderBy(desc(scrapeHistory.scrapedAt))
      .limit(1);
    archive = rows[0] ?? null;
  } catch {
    return null;
  }
  if (!archive || !archive.storagePath || !archive.contentHash) return null;

  // 3. Download the bytes from GCS.
  let contentMarkdown: string;
  try {
    const dl = await getStorage().download(archive.storagePath);
    contentMarkdown = dl.contentBytes.toString('utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[archive-load] download failed for ${archive.storagePath}: ${msg}`);
    return null;
  }

  return {
    url: args.url,
    contentMarkdown,
    contentHash: archive.contentHash,
    httpStatus: archive.httpStatus ?? 200,
    scrapedAt: archive.scrapedAt,
    layer: 'archive',
    contentType: archive.contentType ?? 'text/markdown',
    scrapeHistoryId: archive.id,
    archivePath: archive.storagePath,
    // Phase 3.9 / W11 — by definition, an archive load has the same
    // content_hash as the last successful scrape, so the LLM batch can
    // be skipped. Existing field_values rows are still authoritative.
    unchanged: true,
  };
}

/**
 * Bulk archive lookup. Used by canary-run.ts to pre-load archive
 * coverage for the merged URL set before calling scrape.execute.
 * Returns a Map<url, ScrapeResult> keyed by the input URLs.
 */
export async function loadArchivedScrapes(
  programId: string,
  discoveredUrls: ReadonlyArray<DiscoveredUrl>
): Promise<Map<string, ScrapeResult>> {
  const out = new Map<string, ScrapeResult>();
  for (const u of discoveredUrls) {
    const r = await loadArchivedScrape({ programId, url: u.url });
    if (r) out.set(u.url, r);
  }
  return out;
}
