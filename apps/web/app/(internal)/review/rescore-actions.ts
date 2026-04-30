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

import { db, fieldDefinitions, fieldValues } from '@gtmi/db';
import { PHASE2_PLACEHOLDER_PARAMS, scoreSingleIndicator } from '@gtmi/scoring';
import type { FieldDefinitionRecord } from '@gtmi/scoring';
import { eq } from 'drizzle-orm';
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
