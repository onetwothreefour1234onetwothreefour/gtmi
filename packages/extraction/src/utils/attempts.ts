// Phase 3.9 / W9 — write extraction_attempts rows.
//
// Append-only history of every (program × field × URL × prompt × run)
// extraction. Never overwritten by re-runs. Powers:
//   - W10 field_url_yield materialized view (URL ranking)
//   - W12 surgical re-runs (rubric-changed / gate-failed modes)
//   - W13 prompt versioning (which prompt produced what)
//
// Insertion is best-effort. Every failure path returns null + logs a
// warning; the upstream extraction/publish loop never crashes from an
// attempts write. The field_values "winner" path is the source of truth
// for the public dashboard; extraction_attempts is the audit trail.

import { db, extractionAttempts, fieldDefinitions } from '@gtmi/db';
import { eq, sql } from 'drizzle-orm';
import type { ExtractionOutput } from '../types/extraction';

/**
 * Per-process lookup cache. The 48 field_definitions rows fit comfortably
 * in memory; rebuilds on first miss. Cleared explicitly via clearFieldDefIdCache()
 * in tests. Phase 3.9 / W13 — also caches current_prompt_id so attempts
 * recording can tag every row with the prompt version that produced it
 * without an extra round-trip per attempt.
 */
interface FieldDefCacheEntry {
  fieldDefinitionId: string;
  /** field_definitions.current_prompt_id — null if migration backfill hasn't run yet. */
  currentPromptId: string | null;
}

let _fieldDefIdCache: Map<string, FieldDefCacheEntry> | null = null;

async function getFieldDefIdCache(): Promise<Map<string, FieldDefCacheEntry>> {
  if (_fieldDefIdCache !== null) return _fieldDefIdCache;
  const rows = await db
    .select({
      id: fieldDefinitions.id,
      key: fieldDefinitions.key,
      currentPromptId: fieldDefinitions.currentPromptId,
    })
    .from(fieldDefinitions);
  const m = new Map<string, FieldDefCacheEntry>();
  for (const r of rows) {
    m.set(r.key, {
      fieldDefinitionId: r.id,
      currentPromptId: r.currentPromptId ?? null,
    });
  }
  _fieldDefIdCache = m;
  return m;
}

export function clearFieldDefIdCache(): void {
  _fieldDefIdCache = null;
}

/**
 * Phase 3.9 / W13 — surface the cached promptId for a fieldKey, used
 * by callers that want to tag attempts records explicitly (e.g.
 * reextract-actions.ts which calls executeWithPrompt with a focused
 * prompt and wants to record the BASE prompt id alongside the
 * reextract reason).
 */
export async function getCurrentPromptId(fieldKey: string): Promise<string | null> {
  try {
    const cache = await getFieldDefIdCache();
    return cache.get(fieldKey)?.currentPromptId ?? null;
  } catch {
    return null;
  }
}

export interface RecordAttemptInput {
  programId: string;
  /** Field key (e.g. 'A.1.1'). Resolved to field_definition_id internally. */
  fieldKey: string;
  /** The URL this attempt scraped from. */
  sourceUrl: string;
  /** scrape_history.id for the scrape that produced this content; null for cache-only / pre-W0 scrapes. */
  scrapeHistoryId?: string | null;
  /** sha256 of the markdown the LLM saw. Empty string for cache-bypass paths. */
  contentHash?: string | null;
  /**
   * Phase 3.9 / W13 — the extraction_prompts.id whose prompt produced
   * this attempt. Null is acceptable; the prompt versioning lookup
   * (commit 5) populates this end-to-end.
   */
  extractionPromptId?: string | null;
  /** ExtractionOutput from extract.ts. valueRaw='' is a valid "tried + nothing found" attempt. */
  output: ExtractionOutput;
  /** Validation confidence when known (Stage 3 has run). */
  validationConfidence?: number | null;
  /** Optional gate verdict from publish.ts (rubric_mismatch / out_of_sanity_range / passed / null). */
  gateVerdict?: string | null;
  /** Free-form metadata (tier2_capped, translation_used, etc.). */
  notes?: Record<string, unknown> | null;
}

/**
 * Insert one extraction_attempts row. Returns the inserted row id, or
 * null on any failure (logged at warn level; the caller continues).
 */
export async function recordAttempt(input: RecordAttemptInput): Promise<string | null> {
  let entry: FieldDefCacheEntry | null = null;
  try {
    const cache = await getFieldDefIdCache();
    entry = cache.get(input.fieldKey) ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[attempts] field_definitions lookup failed: ${msg}`);
    return null;
  }
  if (entry === null) {
    console.warn(`[attempts] no field_definitions row for key=${input.fieldKey} — skipping`);
    return null;
  }

  // W13 — when the caller supplies an explicit extractionPromptId
  // (focused re-extraction with a one-off prompt), use it; otherwise
  // default to the current prompt for the field.
  const promptId = input.extractionPromptId ?? entry.currentPromptId;

  try {
    const inserted = await db
      .insert(extractionAttempts)
      .values({
        programId: input.programId,
        fieldDefinitionId: entry.fieldDefinitionId,
        sourceUrl: input.sourceUrl,
        scrapeHistoryId: input.scrapeHistoryId ?? null,
        contentHash: input.contentHash ?? null,
        attemptedAt: input.output.extractedAt,
        valueRaw: input.output.valueRaw === '' ? null : input.output.valueRaw,
        sourceSentence: input.output.sourceSentence === '' ? null : input.output.sourceSentence,
        characterOffsets: input.output.characterOffsets ?? null,
        extractionModel: input.output.extractionModel,
        extractionPromptId: promptId,
        extractionConfidence:
          typeof input.output.extractionConfidence === 'number'
            ? input.output.extractionConfidence.toFixed(2)
            : null,
        validationConfidence:
          typeof input.validationConfidence === 'number'
            ? input.validationConfidence.toFixed(2)
            : null,
        wasPublished: false,
        gateVerdict: input.gateVerdict ?? null,
        notes: input.notes ?? null,
      })
      .returning({ id: extractionAttempts.id });
    return inserted[0]?.id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[attempts] insert failed for ${input.fieldKey} / ${input.sourceUrl}: ${msg}`);
    return null;
  }
}

/**
 * Bulk-insert a batch of attempts in one round-trip. Same best-effort
 * semantics as recordAttempt — returns the count successfully inserted.
 */
export async function recordAttempts(inputs: ReadonlyArray<RecordAttemptInput>): Promise<number> {
  if (inputs.length === 0) return 0;

  let cache: Map<string, FieldDefCacheEntry>;
  try {
    cache = await getFieldDefIdCache();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[attempts] field_definitions lookup failed: ${msg}`);
    return 0;
  }

  const rows = inputs
    .map((input) => {
      const entry = cache.get(input.fieldKey);
      if (!entry) {
        console.warn(`[attempts] no field_definitions row for key=${input.fieldKey} — skipping`);
        return null;
      }
      const promptId = input.extractionPromptId ?? entry.currentPromptId;
      return {
        programId: input.programId,
        fieldDefinitionId: entry.fieldDefinitionId,
        sourceUrl: input.sourceUrl,
        scrapeHistoryId: input.scrapeHistoryId ?? null,
        contentHash: input.contentHash ?? null,
        attemptedAt: input.output.extractedAt,
        valueRaw: input.output.valueRaw === '' ? null : input.output.valueRaw,
        sourceSentence: input.output.sourceSentence === '' ? null : input.output.sourceSentence,
        characterOffsets: input.output.characterOffsets ?? null,
        extractionModel: input.output.extractionModel,
        extractionPromptId: promptId,
        extractionConfidence:
          typeof input.output.extractionConfidence === 'number'
            ? input.output.extractionConfidence.toFixed(2)
            : null,
        validationConfidence:
          typeof input.validationConfidence === 'number'
            ? input.validationConfidence.toFixed(2)
            : null,
        wasPublished: false,
        gateVerdict: input.gateVerdict ?? null,
        notes: input.notes ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return 0;

  try {
    await db.insert(extractionAttempts).values(rows);
    return rows.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[attempts] bulk insert failed (${rows.length} rows): ${msg}`);
    return 0;
  }
}

/**
 * Phase 3.9 / W9 — flip was_published on the most recent matching
 * attempt for a (program × field × source_url × content_hash) tuple,
 * and chain superseded_by from the prior winner. Called by publish.ts
 * after a successful field_values upsert.
 *
 * Returns the id of the newly-published attempt, or null if no
 * matching attempt row exists (e.g. archive write failed and no
 * attempts row was ever created — should be rare).
 */
export async function markAttemptPublished(args: {
  programId: string;
  fieldKey: string;
  sourceUrl: string;
  contentHash?: string | null;
}): Promise<string | null> {
  let fieldDefinitionId: string | null;
  try {
    const cache = await getFieldDefIdCache();
    fieldDefinitionId = cache.get(args.fieldKey)?.fieldDefinitionId ?? null;
  } catch {
    return null;
  }
  if (fieldDefinitionId === null) return null;

  try {
    // Find the latest matching attempt for this (program, field, url).
    // We don't filter by content_hash because re-extractions against the
    // same URL with a focused prompt may hit a slightly different scrape.
    const candidate = await db
      .select({ id: extractionAttempts.id })
      .from(extractionAttempts)
      .where(
        sql`${extractionAttempts.programId} = ${args.programId}
            AND ${extractionAttempts.fieldDefinitionId} = ${fieldDefinitionId}
            AND ${extractionAttempts.sourceUrl} = ${args.sourceUrl}`
      )
      .orderBy(sql`${extractionAttempts.attemptedAt} DESC`)
      .limit(1);
    const newWinnerId = candidate[0]?.id;
    if (!newWinnerId) return null;

    // Find the prior winner (if any) and chain superseded_by.
    const prior = await db
      .select({ id: extractionAttempts.id })
      .from(extractionAttempts)
      .where(
        sql`${extractionAttempts.programId} = ${args.programId}
            AND ${extractionAttempts.fieldDefinitionId} = ${fieldDefinitionId}
            AND ${extractionAttempts.wasPublished} = TRUE
            AND ${extractionAttempts.id} <> ${newWinnerId}`
      )
      .limit(1);

    if (prior[0]?.id) {
      await db
        .update(extractionAttempts)
        .set({ wasPublished: false, supersededBy: newWinnerId })
        .where(eq(extractionAttempts.id, prior[0].id));
    }

    await db
      .update(extractionAttempts)
      .set({ wasPublished: true })
      .where(eq(extractionAttempts.id, newWinnerId));

    return newWinnerId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[attempts] markAttemptPublished failed: ${msg}`);
    return null;
  }
}
