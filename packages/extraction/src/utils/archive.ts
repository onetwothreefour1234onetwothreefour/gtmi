// Phase 3.9 / W0 — write a successful scrape to the GCS archive bucket
// AND insert a `scrape_history` row that points at the storage object.
//
// All failures are non-fatal: a network blip on GCS, a missing source
// row, or an idempotent collision returns null and logs a warning. The
// caller (scrape.ts) treats the result as best-effort metadata.
//
// Idempotency: archive paths are content_hash-derived
// (`{iso}/{programId}/{date}/{sha256}.md`), so repeat uploads of the
// same content are no-ops at the storage layer. The scrape_history
// insert is NOT skipped on the "already there" branch — every call
// produces a row tagged with its run timestamp + extractor_version,
// which is what the W11 hash short-circuit needs to detect "the page
// hasn't changed since the last successful scrape."

import { db, scrapeHistory, sources } from '@gtmi/db';
import { and, desc, eq } from 'drizzle-orm';
import { archivePathFor, contentTypeForExt, getStorage } from '@gtmi/storage';
import type { ScrapeResult } from '../types/extraction';
import { archiveOnDrift } from './wayback';

/** Bumped when scrape→markdown extraction logic changes meaningfully. */
export const EXTRACTOR_VERSION = 'v1';

export interface ArchiveScrapeArgs {
  result: ScrapeResult;
  programId: string;
  countryIso: string;
  /**
   * Override the file extension. Defaults to 'md' (the scraper's HTML→markdown
   * output). PDF scrapes added in PR B will pass 'pdf' for the original and
   * 'md' for the extracted text sibling.
   */
  ext?: 'md' | 'pdf' | 'html' | 'txt';
}

export interface ArchiveScrapeResult {
  scrapeHistoryId: string;
  storagePath: string;
  byteSize: number;
  /**
   * Phase 3.9 / W11 — true when the archive write detected the same
   * content_hash as the last successful scrape for this source. The
   * caller (scrape.ts) propagates this onto the ScrapeResult so the
   * extraction pipeline can short-circuit.
   */
  unchanged: boolean;
}

/**
 * Phase 3.9 / W11 — return the content_hash of the most recent archived
 * scrape for a source, or null if none exists. Used to detect whether a
 * fresh scrape produced byte-identical content to the last successful
 * one (the page hasn't changed) so the orchestrator can skip the LLM
 * extraction batch entirely.
 */
async function lastArchivedHash(sourceId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ contentHash: scrapeHistory.contentHash })
      .from(scrapeHistory)
      .where(and(eq(scrapeHistory.sourceId, sourceId), eq(scrapeHistory.status, 'archived')))
      .orderBy(desc(scrapeHistory.scrapedAt))
      .limit(1);
    return rows[0]?.contentHash ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the `sources.id` for a (program_id, url) pair. Returns null
 * if no row exists — the orchestrator-injected URL was discovered but
 * not yet persisted, in which case the archive write is skipped (the
 * registry write happens in Stage 0 / discover.ts; if it failed there,
 * no `scrape_history` row should be created here).
 */
async function resolveSourceId(programId: string, url: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.programId, programId), eq(sources.url, url)))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort archive write. Returns the storage path + scrape_history
 * row id on success; returns null and logs a warning on any failure.
 *
 * Caller pattern (scrape.ts):
 *   const archived = await archiveScrapeResult({ result, programId, countryIso });
 *   if (archived) {
 *     result.scrapeHistoryId = archived.scrapeHistoryId;
 *     result.archivePath = archived.storagePath;
 *   }
 */
export async function archiveScrapeResult(
  args: ArchiveScrapeArgs
): Promise<ArchiveScrapeResult | null> {
  const { result, programId, countryIso } = args;

  if (!result.contentMarkdown || result.contentHash === '') {
    // Empty / failed scrape — no point archiving "no content".
    return null;
  }

  const sourceId = await resolveSourceId(programId, result.url);
  if (sourceId === null) {
    // Common during the gap between Stage 0 discovery (which writes
    // sources rows) and a follow-up scrape from a stale registry entry.
    // The registry write-back path in discover.ts is the canonical
    // owner of sources rows; we don't backfill from here.
    console.warn(
      `[archive] Skipping scrape_history write for ${result.url} — no sources row for program ${programId}`
    );
    return null;
  }

  // Phase 3.9 / W11 — hash short-circuit. If the new scrape's
  // content_hash matches the last archived scrape for this source, the
  // page hasn't changed. Skip the GCS upload (the storage object
  // already exists at the same hash-derived path) and insert a
  // scrape_history row tagged status='unchanged' as the audit trail
  // of the re-check.
  const previousHash = await lastArchivedHash(sourceId);
  const isUnchanged = previousHash !== null && previousHash === result.contentHash;
  // Phase 3.10d / C.3 — content drift = had a prior hash AND it differs.
  // First-time scrapes (previousHash === null) are not drift; we don't
  // want to flood Save Page Now with first-publish snapshots.
  const isDrift = previousHash !== null && previousHash !== result.contentHash;

  // Phase 3.9 / W1 — choose archive extension from result.contentType
  // when caller didn't override. PDF scrapes archive as .pdf so future
  // re-extraction can re-parse the source bytes.
  const inferredExt = result.contentType === 'application/pdf' ? 'pdf' : 'md';
  const ext = args.ext ?? inferredExt;
  let storagePath: string;
  try {
    storagePath = archivePathFor({
      countryIso,
      programId,
      scrapedAt: result.scrapedAt,
      contentHash: result.contentHash,
      ext,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[archive] Path build failed for ${result.url}: ${msg}`);
    return null;
  }

  const contentType = contentTypeForExt(ext);
  const bytes = Buffer.from(result.contentMarkdown, 'utf8');

  // Phase 3.9 / W11 — skip the GCS re-upload when content hasn't
  // changed. The storage object already exists at the same path
  // (hash-derived), so re-uploading is a no-op-with-cost — both
  // network bytes and the GCS preconditionFailed handling.
  if (!isUnchanged) {
    try {
      await getStorage().upload({
        storagePath,
        contentBytes: bytes,
        contentType,
        metadata: {
          programId,
          countryIso,
          sourceUrl: result.url,
          contentHash: result.contentHash,
          layer: result.layer ?? 'unknown',
          extractorVersion: EXTRACTOR_VERSION,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[archive] GCS upload failed for ${result.url}: ${msg}`);
      return null;
    }
  }

  // Phase 3.10d / C.3 — fire Save Page Now BEFORE the scrape_history
  // insert so the wayback URL can land on the new row in a single
  // write. archiveOnDrift returns null when WAYBACK_ENABLED is unset,
  // when there's no drift, or on any failure; the rest of the archive
  // path is unaffected so a Wayback hiccup never blocks scraping.
  const waybackResult = await archiveOnDrift(result.url, isDrift);

  try {
    const inserted = await db
      .insert(scrapeHistory)
      .values({
        sourceId,
        scrapedAt: result.scrapedAt,
        httpStatus: result.httpStatus,
        contentHash: result.contentHash,
        // raw_markdown_storage_path retained for backwards compat with
        // any consumers that haven't switched to the new column yet.
        rawMarkdownStoragePath: storagePath,
        storagePath,
        byteSize: bytes.byteLength,
        contentType,
        extractorVersion: EXTRACTOR_VERSION,
        // Phase 3.9 / W11 — 'unchanged' rows are the audit trail of
        // hash-confirmation re-checks; they share storage_path with
        // the prior 'archived' row but stamp a fresh scraped_at so
        // the freshness clock for url-monitoring stays current.
        status: isUnchanged ? 'unchanged' : 'archived',
        waybackUrl: waybackResult?.archiveUrl ?? null,
        waybackCapturedAt: waybackResult ? new Date() : null,
      })
      .returning({ id: scrapeHistory.id });
    const id = inserted[0]?.id;
    if (!id) {
      console.warn(`[archive] scrape_history insert returned no id for ${result.url}`);
      return null;
    }
    if (isUnchanged) {
      console.log(
        `  [archive] HASH_UNCHANGED ${result.url} (hash matches last scrape; skipping LLM extraction)`
      );
    }
    return {
      scrapeHistoryId: id,
      storagePath,
      byteSize: bytes.byteLength,
      unchanged: isUnchanged,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[archive] scrape_history insert failed for ${result.url}: ${msg}`);
    return null;
  }
}
