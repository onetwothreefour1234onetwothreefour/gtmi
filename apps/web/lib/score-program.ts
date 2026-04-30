import 'server-only';

// Phase 3.7 / ADR-021 — server-side orchestrator that runs the full
// scoring engine for one programme and upserts the result into the
// `scores` table. Called by the /review re-score buttons
// (rescoreProgram, rescoreCohort) and by scripts/run-paq-score.ts so
// the CLI and the in-app button share one code path.
//
// What this does:
//   1. Resolve the programme (by id) and load its country.
//   2. Pick the current methodology version (first row — same heuristic
//      as the legacy CLI).
//   3. Read the country's CME score from
//      countries.imdAppealScoreCmeNormalized (default 0 if missing).
//   4. Read every approved field_values row for the programme.
//   5. Read every field_definitions row.
//   6. Build a ScoringInput with PHASE2_PLACEHOLDER_PARAMS and
//      ACTIVE_FIELD_CODES.
//   7. Call runScoringEngine(input).
//   8. Upsert the engine output into `scores`
//      (onConflictDoUpdate keyed on programId × methodologyVersionId).
//
// Returns the engine output plus the upserted row id. Caller is
// responsible for revalidatePath / route revalidation.

import {
  db,
  countries,
  fieldDefinitions,
  fieldValues,
  methodologyVersions,
  programs,
  scores,
} from '@gtmi/db';
import { ACTIVE_FIELD_CODES, PHASE2_PLACEHOLDER_PARAMS, runScoringEngine } from '@gtmi/scoring';
import type {
  CategoricalRubric,
  Direction,
  NormalizationFn,
  ScoringInput,
  ScoringOutput,
} from '@gtmi/scoring';
import { and, eq } from 'drizzle-orm';

export interface ScoreProgramResult {
  programId: string;
  programName: string;
  countryIso: string;
  methodologyVersionId: string;
  scoresRowId: string | null;
  /** Raw engine output for callers that want to log / display details. */
  engine: ScoringOutput;
}

export interface ScoreProgramOptions {
  /**
   * Methodology version id override. Defaults to the first row in the
   * methodology_versions table — same heuristic the CLI uses today.
   */
  methodologyVersionId?: string;
}

const PHASE2_METADATA = {
  phase2Placeholder: true,
  placeholderReason:
    'NORMALIZATION_PARAMS are engineer-chosen ranges, not calibrated from real distribution data. Do not publish publicly.',
} as const;

/**
 * Score one programme end-to-end and upsert the result into `scores`.
 * Throws when the programme has no approved field_values or when no
 * methodology version is configured.
 */
export async function scoreProgramFromDb(
  programId: string,
  options: ScoreProgramOptions = {}
): Promise<ScoreProgramResult> {
  if (!programId) throw new Error('scoreProgramFromDb: missing programId');

  // 1. Resolve programme.
  const progRows = await db
    .select({ id: programs.id, name: programs.name, countryIso: programs.countryIso })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  if (progRows.length === 0) {
    throw new Error(`scoreProgramFromDb: no programme with id=${programId}`);
  }
  const program = progRows[0]!;

  // 2. Methodology version (override or first row).
  let mvId = options.methodologyVersionId;
  if (!mvId) {
    const mvRows = await db
      .select({ id: methodologyVersions.id })
      .from(methodologyVersions)
      .limit(1);
    if (mvRows.length === 0) {
      throw new Error('scoreProgramFromDb: no methodology_version row found');
    }
    mvId = mvRows[0]!.id;
  }

  // 3. CME score from the country row.
  const countryRow = await db
    .select({ cme: countries.imdAppealScoreCmeNormalized })
    .from(countries)
    .where(eq(countries.isoCode, program.countryIso))
    .limit(1);
  const cmeScore = countryRow[0]?.cme ? parseFloat(String(countryRow[0].cme)) : 0;

  // 4. Approved field values for this programme.
  const approvedFvs = await db
    .select({
      id: fieldValues.id,
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      valueNormalized: fieldValues.valueNormalized,
      status: fieldValues.status,
    })
    .from(fieldValues)
    .where(and(eq(fieldValues.programId, programId), eq(fieldValues.status, 'approved')));

  if (approvedFvs.length === 0) {
    throw new Error(
      `scoreProgramFromDb: programme ${program.name} (${programId}) has no approved field_values — nothing to score`
    );
  }

  // 5. Every field definition (engine handles the activeFieldKeys filter).
  const allDefs = await db
    .select({
      id: fieldDefinitions.id,
      key: fieldDefinitions.key,
      pillar: fieldDefinitions.pillar,
      subFactor: fieldDefinitions.subFactor,
      weightWithinSubFactor: fieldDefinitions.weightWithinSubFactor,
      scoringRubricJsonb: fieldDefinitions.scoringRubricJsonb,
      normalizationFn: fieldDefinitions.normalizationFn,
      direction: fieldDefinitions.direction,
    })
    .from(fieldDefinitions);

  // 6. Build the ScoringInput.
  const input: ScoringInput = {
    programId,
    methodologyVersionId: mvId,
    scoredAt: new Date(),
    cmeScore,
    fieldValues: approvedFvs.map((fv) => ({
      id: fv.id,
      fieldDefinitionId: fv.fieldDefinitionId,
      valueNormalized: fv.valueNormalized,
      status: fv.status,
    })),
    fieldDefinitions: allDefs.map((d) => ({
      id: d.id,
      key: d.key,
      pillar: d.pillar,
      subFactor: d.subFactor,
      weightWithinSubFactor: parseFloat(String(d.weightWithinSubFactor)),
      scoringRubricJsonb: d.scoringRubricJsonb as CategoricalRubric | null,
      normalizationFn: d.normalizationFn as NormalizationFn,
      direction: d.direction as Direction,
    })),
    normalizationParams: PHASE2_PLACEHOLDER_PARAMS,
    activeFieldKeys: ACTIVE_FIELD_CODES,
  };

  // 7. Run engine.
  const output = runScoringEngine(input);

  // 8. Upsert into `scores`.
  const coveragePct = (output.populatedFieldCount / Math.max(1, output.activeFieldCount)) * 100;
  const metadata = {
    ...PHASE2_METADATA,
    activeFieldCodes: ACTIVE_FIELD_CODES,
    activeFieldCount: output.activeFieldCount,
    populatedFieldCount: output.populatedFieldCount,
  };
  const inserted = await db
    .insert(scores)
    .values({
      programId,
      methodologyVersionId: mvId,
      scoredAt: output.scoredAt,
      cmeScore: String(output.cmeScore),
      paqScore: String(output.paqScore),
      compositeScore: String(output.compositeScore),
      pillarScores: output.pillarScores,
      subFactorScores: output.subFactorScores,
      dataCoveragePct: coveragePct.toFixed(2),
      flaggedInsufficientDisclosure: output.flaggedInsufficientDisclosure,
      metadata,
    })
    .onConflictDoUpdate({
      target: [scores.programId, scores.methodologyVersionId],
      set: {
        scoredAt: output.scoredAt,
        cmeScore: String(output.cmeScore),
        paqScore: String(output.paqScore),
        compositeScore: String(output.compositeScore),
        pillarScores: output.pillarScores,
        subFactorScores: output.subFactorScores,
        dataCoveragePct: coveragePct.toFixed(2),
        flaggedInsufficientDisclosure: output.flaggedInsufficientDisclosure,
        metadata,
      },
    })
    .returning({ id: scores.id });

  return {
    programId,
    programName: program.name,
    countryIso: program.countryIso,
    methodologyVersionId: mvId,
    scoresRowId: inserted[0]?.id ?? null,
    engine: output,
  };
}
