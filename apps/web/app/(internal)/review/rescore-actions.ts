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
import { scoreProgramFromDb } from '@gtmi/extraction';
import { PHASE2_PLACEHOLDER_PARAMS, scoreSingleIndicator } from '@gtmi/scoring';
import type { FieldDefinitionRecord } from '@gtmi/scoring';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

// Phase 3.8 — single-flight lock for the long-running cohort path.
// Module-level Promise so concurrent invocations within the same
// Cloud Run instance share one in-flight execution rather than
// stacking. This prevents the failure mode that crashed rev
// gtmi-web-00028-x7b: an analyst clicks "Re-score cohort" multiple
// times while waiting; each click fires off a long async action; the
// node process serves them concurrently and a stuck one starves the
// instance of capacity for other routes (the `/` rankings page hit
// the 60s Cloud Run timeout because the cohort rescore tied up the
// event loop). Cross-instance protection (multiple Cloud Run replicas)
// would require a DB-level advisory lock — out of scope today;
// max-instances=5 makes simultaneous duplicate clicks unlikely
// once each instance enforces single-flight.
let inflightCohortRescore: Promise<{
  programsRescored: number;
  compositesRefreshed: number;
  rowsRescored: number;
  rowsSkipped: number;
}> | null = null;

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

  // Phase 3.8 — invalidate the data cache (unstable_cache) in addition
  // to the route cache. revalidatePath alone does NOT bust unstable_cache;
  // without revalidateTag the public dashboard will keep serving stale
  // composites for up to an hour after a rescore.
  revalidateTag('programs:all');
  revalidatePath('/review');
  revalidatePath(`/review/${id}`);
  return { score };
}

export interface RescoreProgramResult {
  rowsRescored: number;
  rowsSkipped: number;
  programName: string;
  /**
   * Phase 3.7 / ADR-021 — programme-level composite refresh result.
   * Null when the programme has no approved field_values (the
   * composite refresh is skipped; per-row writes still happen).
   */
  composite: {
    compositeScore: number;
    paqScore: number;
    cmeScore: number;
    populatedFields: number;
    activeFields: number;
    dataCoveragePct: number;
    flaggedInsufficientDisclosure: boolean;
    scoresRowId: string | null;
  } | null;
}

/**
 * Recompute `value_indicator_score` for every approved + pending row in
 * one programme, then refresh the programme-level composite in
 * `scores` via `scoreProgramFromDb` so the public dashboard
 * (composite, PAQ, CME, per-pillar) reflects the new per-row values.
 *
 * Returns { rowsRescored, rowsSkipped, programName, composite } — the
 * `composite` block is null when the programme has no approved rows
 * (the engine has nothing to score; per-row writes still complete).
 */
export async function rescoreProgram(programId: string): Promise<RescoreProgramResult> {
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

  // Phase 3.7 / ADR-021 — refresh the programme-level composite in
  // `scores` after the per-row updates land. Wrapped in a try/catch
  // because scoreProgramFromDb throws when the programme has no
  // approved rows (engine has nothing to score); we still want the
  // per-row refresh to succeed in that case.
  let composite: RescoreProgramResult['composite'] = null;
  let countryIso: string | null = null;
  try {
    const r = await scoreProgramFromDb(programId);
    countryIso = r.countryIso;
    composite = {
      compositeScore: r.engine.compositeScore,
      paqScore: r.engine.paqScore,
      cmeScore: r.engine.cmeScore,
      populatedFields: r.engine.populatedFieldCount,
      activeFields: r.engine.activeFieldCount,
      dataCoveragePct:
        (r.engine.populatedFieldCount / Math.max(1, r.engine.activeFieldCount)) * 100,
      flaggedInsufficientDisclosure: r.engine.flaggedInsufficientDisclosure,
      scoresRowId: r.scoresRowId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[rescoreProgram] composite refresh skipped for ${programName} (${programId}): ${msg}`
    );
  }

  console.log(
    `[rescoreProgram] ${programName} (${programId}): rescored=${rowsRescored} skipped=${rowsSkipped} composite=${composite ? composite.compositeScore.toFixed(2) : 'skipped'}`
  );

  // Bust the cache on every public surface that reads from `scores`.
  // Phase 3.8 — tag-based invalidation for the data cache. The query
  // layer's unstable_cache wrappers carry these tags (programs:all on
  // landing/rankings/cohort-stats/all-countries, program:<id> on the
  // detail page, country:<iso> on the country page). revalidatePath
  // alone busts only the route cache and leaves the data cache stale;
  // without these calls the public dashboard sticks for up to 1h.
  revalidateTag('programs:all');
  revalidateTag(`program:${programId}`);
  if (countryIso) revalidateTag(`country:${countryIso}`);
  revalidatePath('/review');
  revalidatePath(`/programs/${programId}`);
  revalidatePath('/');
  if (countryIso) revalidatePath(`/countries/${countryIso}`);

  return { rowsRescored, rowsSkipped, programName, composite };
}

/**
 * Recompute `value_indicator_score` for every approved + pending row
 * across the entire cohort, then refresh each programme's composite
 * in `scores`. Iterates rescoreProgram per programme so each
 * programme commits independently — a failure on one doesn't roll
 * back the rest.
 *
 * Phase 3.7 / ADR-021 — also returns `compositesRefreshed` so the UI
 * can confirm the public dashboard's composite + per-pillar scores
 * are now in sync with the per-row values.
 *
 * Used after a calibration commit replaces PHASE2_PLACEHOLDER_PARAMS.
 * Single-pass; ~30-60s in steady state. Promote to a Trigger.dev job
 * if cohort size grows past the Cloud Run request timeout.
 */
export async function rescoreCohort(): Promise<{
  programsRescored: number;
  compositesRefreshed: number;
  rowsRescored: number;
  rowsSkipped: number;
}> {
  // Phase 3.8 — single-flight: if a cohort rescore is already running
  // on this instance, the new caller awaits the SAME promise. The UI's
  // confirm button has its own pending state but multiple browser
  // tabs / page reloads can still re-trigger; this gate ensures only
  // one execution per instance, regardless of how many clicks.
  if (inflightCohortRescore) {
    console.log('[rescoreCohort] joining in-flight execution (single-flight)');
    return inflightCohortRescore;
  }
  inflightCohortRescore = (async () => {
    try {
      return await runRescoreCohort();
    } finally {
      inflightCohortRescore = null;
    }
  })();
  return inflightCohortRescore;
}

async function runRescoreCohort(): Promise<{
  programsRescored: number;
  compositesRefreshed: number;
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
  let compositesRefreshed = 0;
  let rowsRescored = 0;
  let rowsSkipped = 0;

  for (const p of allPrograms) {
    try {
      const r = await rescoreProgram(p.id);
      programsRescored++;
      rowsRescored += r.rowsRescored;
      rowsSkipped += r.rowsSkipped;
      if (r.composite) compositesRefreshed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[rescoreCohort] ${p.name} (${p.id}) failed: ${msg}`);
    }
  }

  console.log(
    `[rescoreCohort] programmes=${programsRescored}/${allPrograms.length} composites=${compositesRefreshed} rescored=${rowsRescored} skipped=${rowsSkipped}`
  );
  // Phase 3.8 — cohort-wide tag bust. rescoreProgram already busts each
  // program/country tag during its inner loop; we re-issue the cohort
  // tag here as a belt-and-braces in case any inner call threw before
  // its revalidate ran (failures are caught and logged, the loop
  // continues). 'programs:all' covers landing, rankings, cohort-stats,
  // and all-countries.
  revalidateTag('programs:all');
  revalidatePath('/review');
  revalidatePath('/');
  return { programsRescored, compositesRefreshed, rowsRescored, rowsSkipped };
}
