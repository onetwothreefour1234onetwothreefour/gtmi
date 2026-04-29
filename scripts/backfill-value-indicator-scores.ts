// Phase 3.7 / ADR-019 — one-time backfill of field_values.value_indicator_score.
//
// The publish path historically wrote value_indicator_score only on
// country_substitute_regional rows. Diagnostic on 2026-04-29 found 136 of
// 139 rows with NULL — useful for debugging "did this row score?" was
// only available via re-running the cohort engine.
//
// This script reads every approved+pending row whose
// value_indicator_score IS NULL, recomputes via scoreSingleIndicator,
// and writes the score back. Idempotent — running twice is a no-op the
// second time. Uses PHASE2_PLACEHOLDER_PARAMS as the cohort
// normalization-params source (the same set the canary uses for
// auto-approval scoring).
//
// Usage:
//   pnpm exec tsx scripts/backfill-value-indicator-scores.ts            # dry run
//   pnpm exec tsx scripts/backfill-value-indicator-scores.ts --execute  # apply
import { client, db, fieldDefinitions, fieldValues } from '@gtmi/db';
import { scoreSingleIndicator, PHASE2_PLACEHOLDER_PARAMS } from '@gtmi/scoring';
import type { FieldDefinitionRecord } from '@gtmi/scoring';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';

(async () => {
  const execute = process.argv.includes('--execute');
  const mode = execute ? 'EXECUTE' : 'DRY-RUN';
  console.log(`[backfill-value-indicator-scores] mode=${mode}`);

  const allDefs = await db.select().from(fieldDefinitions);
  const defById = new Map<string, FieldDefinitionRecord>(
    allDefs.map((d) => [d.id, d as unknown as FieldDefinitionRecord])
  );

  // Pull approved + pending rows whose score is NULL.
  const candidates = await db
    .select({
      id: fieldValues.id,
      programId: fieldValues.programId,
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      valueNormalized: fieldValues.valueNormalized,
      status: fieldValues.status,
    })
    .from(fieldValues)
    .where(
      and(
        inArray(fieldValues.status, ['approved', 'pending_review']),
        isNull(fieldValues.valueIndicatorScore)
      )
    );

  console.log(`Candidates with NULL value_indicator_score: ${candidates.length}`);

  let computed = 0;
  let skippedNoValue = 0;
  let skippedMissingDef = 0;
  let errored = 0;
  const updates: Array<{ id: string; score: number }> = [];

  for (const r of candidates) {
    const def = defById.get(r.fieldDefinitionId);
    if (!def) {
      skippedMissingDef++;
      continue;
    }
    if (r.valueNormalized === null || r.valueNormalized === undefined) {
      skippedNoValue++;
      continue;
    }
    try {
      const score = scoreSingleIndicator({
        fieldDefinition: def,
        valueNormalized: r.valueNormalized,
        normalizationParams: PHASE2_PLACEHOLDER_PARAMS,
      });
      if (score === null) {
        skippedNoValue++;
        continue;
      }
      updates.push({ id: r.id, score });
      computed++;
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [${def.key}] row ${r.id}: ${msg}`);
    }
  }

  console.log('');
  console.log(`Will set value_indicator_score on ${updates.length} rows`);
  console.log(`  computed:           ${computed}`);
  console.log(`  skipped (no value): ${skippedNoValue}`);
  console.log(`  skipped (no def):   ${skippedMissingDef}`);
  console.log(`  errored:            ${errored}`);

  if (!execute) {
    console.log('\nDry run — pass --execute to apply.');
    await client.end({ timeout: 5 });
    process.exit(0);
  }

  console.log('\nApplying updates...');
  let written = 0;
  for (const u of updates) {
    await db
      .update(fieldValues)
      .set({ valueIndicatorScore: String(u.score) })
      .where(eq(fieldValues.id, u.id));
    written++;
  }
  console.log(`Wrote ${written} rows.`);

  // Final sanity check — count NULLs after.
  const remaining = (await db.execute(sql`
    SELECT count(*)::int AS n
    FROM field_values
    WHERE status IN ('approved', 'pending_review')
      AND value_indicator_score IS NULL
  `)) as unknown as Array<{ n: number }>;
  console.log(`Approved+pending rows still NULL: ${remaining[0]?.n ?? '?'}`);

  await client.end({ timeout: 5 });
  process.exit(0);
})().catch(async (e) => {
  console.error('FATAL:', e);
  try {
    await client.end({ timeout: 5 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
