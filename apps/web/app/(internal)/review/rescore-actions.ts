'use server';

// Phase 3.8 / ADR-020 — on-demand re-scoring server actions.
//
// Three scopes (progressively heavier UX gates upstream — see
// /review/[id], /review header):
//
//   - rescoreFieldValue(id)         — single row; <50ms.
//   - rescoreProgram(programId)     — every approved + pending row in
//                                      one programme; ~1-2s.
//   - rescoreCohort()               — every programme with at least
//                                      one approved row; ~30-60s.
//
// All three reuse `scoreSingleIndicator` from @gtmi/scoring with the
// shared `PHASE2_PLACEHOLDER_PARAMS`. The cohort-level composite
// recompute (programmes table → `scores` rows) is out of scope for
// this commit; this file only refreshes per-row
// `field_values.value_indicator_score`. The composite re-write lands
// alongside `rescoreProgram` in the next commit.

import { db, fieldDefinitions, fieldValues, programs } from '@gtmi/db';
import { PHASE2_PLACEHOLDER_PARAMS, scoreSingleIndicator } from '@gtmi/scoring';
import type { FieldDefinitionRecord } from '@gtmi/scoring';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

interface FieldDefForRescore {
  id: string;
  key: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: string;
  normalizationFn: string;
  direction: string;
  scoringRubricJsonb: unknown;
}

function buildFieldDefinitionRecord(def: FieldDefForRescore): FieldDefinitionRecord {
  return {
    id: def.id,
    key: def.key,
    pillar: def.pillar,
    subFactor: def.subFactor,
    weightWithinSubFactor: Number(def.weightWithinSubFactor),
    normalizationFn: def.normalizationFn as FieldDefinitionRecord['normalizationFn'],
    direction: def.direction as FieldDefinitionRecord['direction'],
    scoringRubricJsonb: def.scoringRubricJsonb as FieldDefinitionRecord['scoringRubricJsonb'],
  };
}

/**
 * Recompute `value_indicator_score` for one field_values row from the
 * stored `value_normalized` and the current `PHASE2_PLACEHOLDER_PARAMS`.
 *
 * Used after the analyst notices a stale score (defensive — Step 4's
 * `editApprovedFieldValue` already re-scores on edit) or after a
 * params calibration commit that changed how a field normalises.
 *
 * Returns the new score (or null when the row is missing /
 * value_normalized is null / the row carries the FIX-1 not-applicable
 * marker — those legitimately stay null).
 */
export async function rescoreFieldValue(id: string): Promise<{ score: number | null }> {
  const rows = await db
    .select({
      valueNormalized: fieldValues.valueNormalized,
      def: {
        id: fieldDefinitions.id,
        key: fieldDefinitions.key,
        pillar: fieldDefinitions.pillar,
        subFactor: fieldDefinitions.subFactor,
        weightWithinSubFactor: fieldDefinitions.weightWithinSubFactor,
        normalizationFn: fieldDefinitions.normalizationFn,
        direction: fieldDefinitions.direction,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
      },
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(eq(fieldValues.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(`rescoreFieldValue: no field_values row with id=${id}`);
  }

  let score: number | null = null;
  try {
    score = scoreSingleIndicator({
      fieldDefinition: buildFieldDefinitionRecord(row.def as FieldDefForRescore),
      valueNormalized: row.valueNormalized,
      normalizationParams: PHASE2_PLACEHOLDER_PARAMS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[rescoreFieldValue] scoreSingleIndicator failed for ${id}: ${msg}`);
    score = null;
  }

  await db
    .update(fieldValues)
    .set({ valueIndicatorScore: score === null ? null : String(score) })
    .where(eq(fieldValues.id, id));

  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
  return { score };
}

/**
 * Recompute `value_indicator_score` for every approved + pending row in
 * one programme. Mirrors the standalone backfill script but scoped to
 * a single program_id and runnable from the /review queue header
 * dropdown.
 *
 * Returns { rowsRescored, rowsSkipped } — skipped rows are those with
 * `value_normalized IS NULL` (legitimately unscored, e.g. the FIX-1
 * not-applicable derive markers).
 */
export async function rescoreProgram(
  programId: string
): Promise<{ rowsRescored: number; rowsSkipped: number; programName: string }> {
  if (!programId) throw new Error('rescoreProgram: missing programId');

  const programRows = await db
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  if (programRows.length === 0) {
    throw new Error(`rescoreProgram: no programme with id=${programId}`);
  }
  const programName = programRows[0]!.name;

  const rows = await db
    .select({
      id: fieldValues.id,
      valueNormalized: fieldValues.valueNormalized,
      def: {
        id: fieldDefinitions.id,
        key: fieldDefinitions.key,
        pillar: fieldDefinitions.pillar,
        subFactor: fieldDefinitions.subFactor,
        weightWithinSubFactor: fieldDefinitions.weightWithinSubFactor,
        normalizationFn: fieldDefinitions.normalizationFn,
        direction: fieldDefinitions.direction,
        scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
      },
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(
      and(
        eq(fieldValues.programId, programId),
        inArray(fieldValues.status, ['approved', 'pending_review'])
      )
    );

  let rowsRescored = 0;
  let rowsSkipped = 0;
  const updates: Array<{ id: string; score: string | null }> = [];

  for (const r of rows) {
    if (r.valueNormalized === null || r.valueNormalized === undefined) {
      rowsSkipped++;
      continue;
    }
    let score: number | null = null;
    try {
      score = scoreSingleIndicator({
        fieldDefinition: buildFieldDefinitionRecord(r.def as FieldDefForRescore),
        valueNormalized: r.valueNormalized,
        normalizationParams: PHASE2_PLACEHOLDER_PARAMS,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[rescoreProgram] scoreSingleIndicator failed for ${r.id}: ${msg}`);
    }
    if (score === null) {
      rowsSkipped++;
      continue;
    }
    updates.push({ id: r.id, score: String(score) });
    rowsRescored++;
  }

  if (updates.length > 0) {
    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx
          .update(fieldValues)
          .set({ valueIndicatorScore: u.score })
          .where(eq(fieldValues.id, u.id));
      }
    });
  }

  console.log(
    `[rescoreProgram] ${programName} (${programId}): rescored=${rowsRescored} skipped=${rowsSkipped}`
  );
  revalidatePath('/review');
  revalidatePath(`/programs/${programId}`);
  return { rowsRescored, rowsSkipped, programName };
}

/**
 * Recompute `value_indicator_score` for every approved + pending row
 * across the entire cohort. Iterates rescoreProgram per programme so
 * each programme commits independently — a failure on one doesn't
 * roll back the rest.
 *
 * Used after a calibration commit replaces PHASE2_PLACEHOLDER_PARAMS.
 * Single-pass; ~30-60s in steady state. Promote to a Trigger.dev job
 * if cohort size grows past the Cloud Run request timeout.
 */
export async function rescoreCohort(): Promise<{
  programsRescored: number;
  rowsRescored: number;
  rowsSkipped: number;
}> {
  // Programmes with at least one approved + pending row.
  const progRows = await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT p.id, p.name
    FROM field_values fv
    JOIN programs p ON p.id = fv.program_id
    WHERE fv.status IN ('approved', 'pending_review')
    ORDER BY p.name
  `);
  const iter = Array.isArray(progRows)
    ? progRows
    : ((progRows as unknown as { rows?: Array<{ id: string }> }).rows ?? []);
  const allPrograms = iter as Array<{ id: string; name: string }>;

  let programsRescored = 0;
  let rowsRescored = 0;
  let rowsSkipped = 0;

  for (const p of allPrograms) {
    try {
      const r = await rescoreProgram(p.id);
      programsRescored++;
      rowsRescored += r.rowsRescored;
      rowsSkipped += r.rowsSkipped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[rescoreCohort] ${p.name} (${p.id}) failed: ${msg}`);
    }
  }

  console.log(
    `[rescoreCohort] programmes=${programsRescored}/${allPrograms.length} rescored=${rowsRescored} skipped=${rowsSkipped}`
  );
  revalidatePath('/review');
  return { programsRescored, rowsRescored, rowsSkipped };
}
