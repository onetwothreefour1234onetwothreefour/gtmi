/**
 * scripts/backfill-extraction-attempts.ts
 *
 * Phase 3.9 / W9 — replay every existing field_values row as an
 * extraction_attempts entry tagged with prompt-v1 ("legacy"). After
 * this script runs, the extraction_attempts table is non-empty for
 * historical data, the field_url_yield materialized view has
 * something to aggregate, and W12 surgical re-runs (PR C) can target
 * pre-Phase-3.9 rows alongside fresh ones.
 *
 * Idempotent: skips rows that already have a was_published=true entry
 * for the same (program_id, field_definition_id, source_url) tuple.
 * The (program_id, field_definition_id) UNIQUE on field_values means
 * each call inserts at most one new attempt per existing field_values
 * row — re-running is safe.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-extraction-attempts.ts            (dry-run; no writes)
 *   pnpm exec tsx scripts/backfill-extraction-attempts.ts --execute  (real writes)
 *
 * Output: per-row classification + final summary. Rows skipped because
 * they came from synthetic provenance (derived/internal/world-bank/
 * country-substitute) are counted but not inserted — those bypass
 * extract.ts and have no logical attempts row.
 */
import 'dotenv/config';
import {
  db,
  extractionAttempts,
  extractionPrompts,
  fieldDefinitions,
  fieldValues,
  programs,
} from '@gtmi/db';
import { and, eq, sql } from 'drizzle-orm';

const SYNTHETIC_SOURCE_PREFIXES = [
  'derived:',
  'derived-computation:',
  'internal:',
  'country-substitute:',
  'https://api.worldbank.org/',
];

function isSyntheticUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return SYNTHETIC_SOURCE_PREFIXES.some((p) => url.startsWith(p));
}

interface BackfillRow {
  fieldValueId: string;
  programId: string;
  fieldDefinitionId: string;
  fieldKey: string;
  countryIso: string;
  status: string;
  valueRaw: string | null;
  extractedAt: Date | null;
  provenance: Record<string, unknown> | null;
}

async function loadCandidates(): Promise<BackfillRow[]> {
  const rows = await db
    .select({
      fieldValueId: fieldValues.id,
      programId: fieldValues.programId,
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      fieldKey: fieldDefinitions.key,
      countryIso: programs.countryIso,
      status: fieldValues.status,
      valueRaw: fieldValues.valueRaw,
      extractedAt: fieldValues.extractedAt,
      provenance: fieldValues.provenance,
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .innerJoin(programs, eq(programs.id, fieldValues.programId));
  return rows.map((r) => ({
    ...r,
    provenance:
      typeof r.provenance === 'object' && r.provenance !== null
        ? (r.provenance as Record<string, unknown>)
        : null,
  }));
}

interface PromptIdLookup {
  byFieldDefinitionId: Map<string, string | null>;
}

async function loadPromptV1Map(): Promise<PromptIdLookup> {
  const rows = await db
    .select({
      fieldDefinitionId: extractionPrompts.fieldDefinitionId,
      promptId: extractionPrompts.id,
      versionTag: extractionPrompts.versionTag,
    })
    .from(extractionPrompts)
    .where(eq(extractionPrompts.versionTag, 'v1'));
  const m = new Map<string, string | null>();
  for (const r of rows) m.set(r.fieldDefinitionId, r.promptId);
  return { byFieldDefinitionId: m };
}

async function alreadyHasPublishedAttempt(args: {
  programId: string;
  fieldDefinitionId: string;
  sourceUrl: string;
}): Promise<boolean> {
  const rows = await db
    .select({ id: extractionAttempts.id })
    .from(extractionAttempts)
    .where(
      and(
        eq(extractionAttempts.programId, args.programId),
        eq(extractionAttempts.fieldDefinitionId, args.fieldDefinitionId),
        eq(extractionAttempts.sourceUrl, args.sourceUrl),
        eq(extractionAttempts.wasPublished, true)
      )
    )
    .limit(1);
  return rows.length > 0;
}

interface BuiltAttempt {
  programId: string;
  fieldDefinitionId: string;
  sourceUrl: string;
  contentHash: string | null;
  attemptedAt: Date;
  valueRaw: string | null;
  sourceSentence: string | null;
  characterOffsets: unknown;
  extractionModel: string;
  extractionPromptId: string | null;
  extractionConfidence: string | null;
  validationConfidence: string | null;
  wasPublished: boolean;
  gateVerdict: string;
  notes: Record<string, unknown>;
}

function buildAttempt(row: BackfillRow, promptId: string | null): BuiltAttempt | null {
  const prov = row.provenance ?? {};
  const sourceUrl = typeof prov['sourceUrl'] === 'string' ? (prov['sourceUrl'] as string) : null;
  if (sourceUrl === null) return null;
  const extractionModel =
    typeof prov['extractionModel'] === 'string' ? (prov['extractionModel'] as string) : 'unknown';
  const contentHash =
    typeof prov['contentHash'] === 'string' ? (prov['contentHash'] as string) : null;
  const sourceSentence =
    typeof prov['sourceSentence'] === 'string' && (prov['sourceSentence'] as string).trim() !== ''
      ? (prov['sourceSentence'] as string)
      : null;
  const characterOffsets =
    typeof prov['characterOffsets'] === 'object' && prov['characterOffsets'] !== null
      ? prov['characterOffsets']
      : null;
  const extractionConfidenceRaw = prov['extractionConfidence'];
  const extractionConfidence =
    typeof extractionConfidenceRaw === 'number' ? extractionConfidenceRaw.toFixed(2) : null;
  const validationConfidenceRaw = prov['validationConfidence'];
  const validationConfidence =
    typeof validationConfidenceRaw === 'number' ? validationConfidenceRaw.toFixed(2) : null;
  const normalizationError =
    typeof prov['normalizationError'] === 'string' ? (prov['normalizationError'] as string) : null;
  const gateVerdict =
    row.status === 'approved'
      ? 'passed'
      : normalizationError
        ? normalizationError.includes('out_of_sanity_range')
          ? 'out_of_sanity_range'
          : 'normalize_failed'
        : 'legacy_pending';
  return {
    programId: row.programId,
    fieldDefinitionId: row.fieldDefinitionId,
    sourceUrl,
    contentHash,
    attemptedAt: row.extractedAt ?? new Date(),
    valueRaw: row.valueRaw && row.valueRaw !== '' ? row.valueRaw : null,
    sourceSentence,
    characterOffsets,
    extractionModel,
    extractionPromptId: promptId,
    extractionConfidence,
    validationConfidence,
    wasPublished: true,
    gateVerdict,
    notes: { backfilled: true, sourceFieldValueId: row.fieldValueId },
  };
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const mode = execute ? 'EXECUTE' : 'DRY-RUN';
  console.log(`[backfill] mode: ${mode}`);

  const candidates = await loadCandidates();
  console.log(`[backfill] field_values rows: ${candidates.length}`);

  const promptLookup = await loadPromptV1Map();
  console.log(
    `[backfill] extraction_prompts v1 rows loaded: ${promptLookup.byFieldDefinitionId.size}`
  );

  let inserted = 0;
  let skippedSynthetic = 0;
  let skippedAlreadyPresent = 0;
  let skippedNoSourceUrl = 0;
  let errored = 0;

  for (const row of candidates) {
    const sourceUrl =
      row.provenance && typeof row.provenance['sourceUrl'] === 'string'
        ? (row.provenance['sourceUrl'] as string)
        : null;
    if (sourceUrl === null) {
      skippedNoSourceUrl++;
      continue;
    }
    if (isSyntheticUrl(sourceUrl)) {
      skippedSynthetic++;
      continue;
    }

    if (
      await alreadyHasPublishedAttempt({
        programId: row.programId,
        fieldDefinitionId: row.fieldDefinitionId,
        sourceUrl,
      })
    ) {
      skippedAlreadyPresent++;
      continue;
    }

    const promptId = promptLookup.byFieldDefinitionId.get(row.fieldDefinitionId) ?? null;
    const attempt = buildAttempt(row, promptId);
    if (!attempt) {
      skippedNoSourceUrl++;
      continue;
    }

    if (!execute) {
      inserted++;
      continue;
    }

    try {
      await db.insert(extractionAttempts).values(attempt);
      inserted++;
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[backfill] insert failed for ${row.programId}/${row.fieldKey}: ${msg}`);
    }
  }

  // Refresh the materialized view at the end so a subsequent canary
  // sees the backfilled history immediately.
  if (execute) {
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY field_url_yield`);
      console.log('[backfill] field_url_yield refreshed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[backfill] field_url_yield refresh failed: ${msg}`);
    }
  }

  console.log('');
  console.log('[backfill] summary');
  console.log(`  inserted${execute ? '' : ' (dry-run)'}      : ${inserted}`);
  console.log(`  skipped (synthetic)        : ${skippedSynthetic}`);
  console.log(`  skipped (already present)  : ${skippedAlreadyPresent}`);
  console.log(`  skipped (no sourceUrl)     : ${skippedNoSourceUrl}`);
  console.log(`  errored                    : ${errored}`);
  console.log('');
  if (!execute) {
    console.log('[backfill] DRY-RUN — re-run with --execute to write rows.');
  } else {
    console.log('[backfill] DONE');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
