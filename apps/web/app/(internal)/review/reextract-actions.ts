'use server';

// Phase 3.8 / P3.5 — focused re-extraction. Reads the current
// field_values row's source URL, builds a rubric-grounded
// re-extraction prompt that includes the previous valueRaw and the
// analyst's rejection reason, and calls the LLM with a one-off prompt.
// The result is written back as pending_review so the universal gate
// (P1) and the rubric-aware editor (P2) handle the next round.
//
// Phase 3.9 / W14 — archive-first lookup. Prefers the latest
// scrape_history row (permanent GCS archive) over scrape_cache
// (24h TTL). Falls back to scrape_cache when no archive entry
// exists yet (pre-W0 rows or environments where the archive write
// has been disabled). This makes the "Re-extract from source" button
// continue to work indefinitely after the original scrape, rather
// than becoming dead after 24h.

import {
  db,
  fieldDefinitions,
  fieldValues,
  methodologyVersions,
  programs,
  scrapeCache,
  scrapeHistory,
  sources,
  countries,
  renderAllowedValues,
} from '@gtmi/db';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import {
  ExtractStageImpl,
  buildFocusedReextractionPrompt,
  getStorage,
  recordAttempt,
  getCurrentPromptId,
} from '@gtmi/extraction';
import { revalidatePath } from 'next/cache';

interface ReextractResult {
  status: 'pending_review' | 'no_change' | 'no_source' | 'no_scrape';
  valueRaw: string | null;
  sourceSentence: string | null;
}

function readSourceUrlFromProvenance(provenance: unknown): string | null {
  if (provenance === null || typeof provenance !== 'object') return null;
  const v = (provenance as Record<string, unknown>).sourceUrl;
  return typeof v === 'string' ? v : null;
}

interface CategoricalRubric {
  categories: Array<{ value: string; score?: number; description?: string }>;
}
function isCategoricalRubric(r: unknown): r is CategoricalRubric {
  if (!r || typeof r !== 'object') return false;
  const cats = (r as { categories?: unknown }).categories;
  return Array.isArray(cats);
}

interface ReextractScrapeHandle {
  contentMarkdown: string;
  contentHash: string;
  scrapedAt: Date;
  /** Phase 3.9 / W9 — populated when source came from the GCS archive. */
  scrapeHistoryId?: string | null;
  /** GCS storage path for /review provenance fallback link rendering. */
  archivePath?: string | null;
}

/**
 * Phase 3.9 / W14 — resolve a re-extractable scrape for a (program, URL)
 * pair. Tries the latest scrape_history row first (permanent GCS
 * archive); falls back to scrape_cache (24h TTL) when no archive entry
 * exists yet (pre-W0 rows or environments where the archive write was
 * disabled). Downloads bytes from GCS via @gtmi/storage when the
 * archive is the source.
 */
async function loadScrapeForReextract(
  sourceUrl: string,
  programId: string
): Promise<ReextractScrapeHandle | null> {
  // Find the sources row to get the source_id; scrape_history is
  // keyed by source_id, not URL.
  const sourceRows = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.url, sourceUrl)))
    .limit(1);

  const sourceId = sourceRows[0]?.id;
  if (sourceId) {
    const archiveRows = await db
      .select({
        id: scrapeHistory.id,
        scrapedAt: scrapeHistory.scrapedAt,
        contentHash: scrapeHistory.contentHash,
        storagePath: scrapeHistory.storagePath,
      })
      .from(scrapeHistory)
      .where(and(eq(scrapeHistory.sourceId, sourceId), isNotNull(scrapeHistory.storagePath)))
      .orderBy(desc(scrapeHistory.scrapedAt))
      .limit(1);
    const archive = archiveRows[0];
    if (archive && archive.storagePath && archive.contentHash) {
      try {
        const dl = await getStorage().download(archive.storagePath);
        return {
          contentMarkdown: dl.contentBytes.toString('utf8'),
          contentHash: archive.contentHash,
          scrapedAt: archive.scrapedAt,
          scrapeHistoryId: archive.id,
          archivePath: archive.storagePath,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[reextract] archive download failed for ${archive.storagePath}: ${msg} — falling through to scrape_cache`
        );
      }
    }
  }

  // Fallback: scrape_cache (legacy 24h path).
  const cached = await db
    .select({
      contentMarkdown: scrapeCache.contentMarkdown,
      contentHash: scrapeCache.contentHash,
      scrapedAt: scrapeCache.scrapedAt,
    })
    .from(scrapeCache)
    .where(eq(scrapeCache.url, sourceUrl))
    .limit(1);
  if (cached.length === 0) return null;
  const c = cached[0]!;
  return {
    contentMarkdown: c.contentMarkdown,
    contentHash: c.contentHash,
    scrapedAt: c.scrapedAt,
  };
}

export async function reextractFieldValue(
  id: string,
  rejectReason?: string
): Promise<ReextractResult> {
  if (!id) throw new Error('reextractFieldValue: missing field_value id');

  const rows = await db
    .select({
      valueRaw: fieldValues.valueRaw,
      programId: fieldValues.programId,
      provenance: fieldValues.provenance,
      methodologyVersion: methodologyVersions.versionTag,
      def: {
        id: fieldDefinitions.id,
        key: fieldDefinitions.key,
        normalizationFn: fieldDefinitions.normalizationFn,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
        extractionPromptMd: fieldDefinitions.extractionPromptMd,
      },
      program: {
        id: programs.id,
        name: programs.name,
        countryIso: programs.countryIso,
      },
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .innerJoin(programs, eq(programs.id, fieldValues.programId))
    .leftJoin(methodologyVersions, eq(methodologyVersions.id, fieldValues.methodologyVersionId))
    .where(eq(fieldValues.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error(`reextractFieldValue: no field_values row with id=${id}`);

  const sourceUrl = readSourceUrlFromProvenance(row.provenance);
  if (!sourceUrl) {
    return { status: 'no_source', valueRaw: null, sourceSentence: null };
  }

  // Phase 3.9 / W14 — archive-first scrape lookup. The latest
  // scrape_history row for this URL (joined via sources) is permanent;
  // scrape_cache is the legacy 24h fallback. Re-extraction never
  // re-scrapes — if BOTH archive AND cache are empty for this URL the
  // analyst should run the upstream pipeline first (separate concern
  // from rubric refinement).
  const scrape = await loadScrapeForReextract(sourceUrl, row.programId);
  if (!scrape) {
    return { status: 'no_scrape', valueRaw: null, sourceSentence: null };
  }

  // Country name for the prompt's {program_country} placeholder.
  const countryRows = await db
    .select({ name: countries.name })
    .from(countries)
    .where(eq(countries.isoCode, row.program.countryIso))
    .limit(1);
  const countryDisplay = countryRows[0]?.name ?? row.program.countryIso;

  const rubricVocabBlock = isCategoricalRubric(row.def.scoringRubricJsonb)
    ? renderAllowedValues(row.def.scoringRubricJsonb)
    : null;

  const focusedPrompt = buildFocusedReextractionPrompt({
    basePromptMd: row.def.extractionPromptMd,
    previousValueRaw: row.valueRaw ?? null,
    rejectReason: rejectReason?.trim() || null,
    rubricVocabBlock,
  });

  // ExtractStageImpl.executeWithPrompt bypasses the fieldPrompts
  // constructor map entirely; we feed it the focused prompt directly.
  const stage = new ExtractStageImpl(new Map());
  const extraction = await stage.executeWithPrompt(
    {
      url: sourceUrl,
      contentMarkdown: scrape.contentMarkdown,
      contentHash: scrape.contentHash,
      httpStatus: 200,
      scrapedAt: scrape.scrapedAt,
    },
    row.def.key,
    row.programId,
    row.program.name,
    countryDisplay,
    focusedPrompt
  );

  // Phase 3.9 / W9 — record this focused re-extraction in
  // extraction_attempts. extractionPromptId stays null because the
  // focused prompt is one-off (not in extraction_prompts); notes
  // capture the rejectReason and the base prompt id.
  const basePromptId = await getCurrentPromptId(row.def.key);
  await recordAttempt({
    programId: row.programId,
    fieldKey: row.def.key,
    sourceUrl,
    scrapeHistoryId: scrape.scrapeHistoryId ?? null,
    contentHash: scrape.contentHash,
    extractionPromptId: null,
    output: extraction,
    notes: {
      reextract: true,
      basePromptId,
      rejectReason: rejectReason?.trim() ?? null,
      previousValueRaw: row.valueRaw ?? null,
    },
  });

  // No-change short-circuit: if the LLM returned the same raw, don't
  // bump extractedAt — keep the original timestamp so the analyst sees
  // the stale row was actually re-checked.
  if (extraction.valueRaw === row.valueRaw) {
    return {
      status: 'no_change',
      valueRaw: extraction.valueRaw,
      sourceSentence: extraction.sourceSentence,
    };
  }

  // Write back as pending_review with the new raw + sentence; let the
  // P1 universal gate handle normalization on next read.
  const newProvenance: Record<string, unknown> = {
    ...(typeof row.provenance === 'object' && row.provenance !== null
      ? (row.provenance as Record<string, unknown>)
      : {}),
    sourceSentence: extraction.sourceSentence,
    characterOffsets: extraction.characterOffsets,
    extractionConfidence: extraction.extractionConfidence,
    extractionModel: extraction.extractionModel,
    reextractedAt: new Date().toISOString(),
    reextractRejectReason: rejectReason?.trim() ?? null,
    // Phase 3.9 / W7 — preserve the archive path on the re-extracted
    // row so the snapshot link stays available even after the rewrite.
    ...(scrape.archivePath ? { archivePath: scrape.archivePath } : {}),
  };

  await db
    .update(fieldValues)
    .set({
      valueRaw: extraction.valueRaw,
      valueNormalized: null,
      valueIndicatorScore: null,
      provenance: newProvenance,
      status: 'pending_review',
      extractedAt: extraction.extractedAt,
      reviewedAt: null,
      ...(scrape.archivePath ? { archivePath: scrape.archivePath } : {}),
    })
    .where(eq(fieldValues.id, id));

  revalidatePath('/review');
  revalidatePath(`/review/${id}`);

  return {
    status: 'pending_review',
    valueRaw: extraction.valueRaw,
    sourceSentence: extraction.sourceSentence,
  };
}
