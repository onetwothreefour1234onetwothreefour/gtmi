/**
 * Phase 2 PAQ scoring run.
 *
 * Reads approved field_values for a program, runs the scoring engine, and
 * writes the result to the scores table.
 *
 *  ⚠️  PHASE 2 PLACEHOLDER RANGES — NOT PUBLICATION-READY
 *
 * The NORMALIZATION_PARAMS below are engineer-chosen ranges used to unblock
 * Phase 2 end-to-end scoring. They are NOT calibrated against real cross-program
 * distribution data. Every score written by this script is tagged with
 * `provenance.phase2Placeholder = true` in the scores row so downstream
 * consumers can refuse to publish until Phase 3 replaces these with real
 * distribution stats from ≥5 scored programs.
 *
 * Scope: Wave 1 fields only (via WAVE_1_FIELD_CODES). Out-of-scope fields do
 * not contribute to denominators or weight re-normalization.
 *
 * Usage:
 *   npx tsx scripts/run-paq-score.ts --country AUS [--programId <uuid>]
 */

import { db, fieldDefinitions, fieldValues, methodologyVersions, scores } from '@gtmi/db';
import { runScoringEngine } from '@gtmi/scoring';
import type { NormalizationParams, ScoringInput } from '@gtmi/scoring';
import { eq, and } from 'drizzle-orm';
import { WAVE_1_FIELD_CODES } from './wave-config';

// ---------------------------------------------------------------------------
// Phase 2 placeholder normalization params (global benchmark ranges)
// Replace with cross-program distribution data in Phase 3.
// ---------------------------------------------------------------------------
const NORMALIZATION_PARAMS: NormalizationParams = {
  // A — Access & Eligibility
  'A.1.1': { mean: 65000, stddev: 35000 }, // salary threshold USD — z_score
  'A.1.2': { min: 50, max: 300 }, // salary as % median — min_max
  'A.2.2': { min: 0, max: 10 }, // work experience years — min_max
  'A.3.3': { min: 0, max: 100 }, // quota size — min_max

  // B — Process & Cost
  'B.1.1': { min: 1, max: 365 }, // processing days — min_max
  'B.1.3': { min: 1, max: 10 }, // number of steps — min_max
  'B.2.1': { mean: 2500, stddev: 2000 }, // principal fees USD — z_score
  'B.2.2': { mean: 1200, stddev: 900 }, // per-dependant fees USD — z_score
  'B.2.3': { mean: 5000, stddev: 3000 }, // employer levies USD — z_score
  'B.2.4': { mean: 1000, stddev: 700 }, // non-gov costs USD — z_score
  'B.3.2': { min: 0, max: 100 }, // online application — min_max

  // C — Conditions
  'C.2.2': { min: 0, max: 25 }, // dependent child age cap — min_max

  // D — Pathways
  'D.1.2': { min: 0, max: 10 }, // years to PR — min_max
  'D.1.3': { min: 0, max: 365 }, // physical presence days/yr — min_max
  'D.1.4': { min: 0, max: 365 }, // PR retention days/yr — min_max
  'D.2.2': { min: 5, max: 30 }, // years to citizenship — min_max
  'D.3.1': { min: 0, max: 365 }, // tax trigger days — min_max

  // E — Environment & Stability
  'E.1.1': { mean: 3, stddev: 2.5 }, // policy changes count — z_score
  'E.1.3': { min: 0, max: 20 }, // program age years — min_max
  'E.3.1': { min: 0, max: 365 }, // tax residency trigger days — min_max
  'E.3.2': { min: -2.5, max: 2.5 }, // WGI score — min_max
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const countryArgIdx = process.argv.indexOf('--country');
  const countryArg = countryArgIdx !== -1 ? process.argv[countryArgIdx + 1] : undefined;
  if (!countryArg) {
    console.error(
      'Usage: npx tsx scripts/run-paq-score.ts --country <AUS|SGP> [--programId <uuid>]'
    );
    process.exit(1);
  }

  const programIdArgIdx = process.argv.indexOf('--programId');
  const programIdArg = programIdArgIdx !== -1 ? process.argv[programIdArgIdx + 1] : undefined;

  // --- 1. Resolve program ---
  let programId: string;
  let programName: string;

  if (programIdArg) {
    const rows = await db.query.programs.findFirst({
      where: (p, { eq }) => eq(p.id, programIdArg),
    });
    if (!rows) {
      console.error(`No program found: ${programIdArg}`);
      process.exit(1);
    }
    programId = rows.id;
    programName = rows.name;
  } else if (countryArg === 'AUS') {
    const rows = await db.query.programs.findFirst({
      where: (p, { and, eq, ilike }) =>
        and(eq(p.countryIso, 'AUS'), ilike(p.name, '%Skills in Demand%')),
    });
    if (!rows) {
      console.error('No AUS Skills in Demand program found');
      process.exit(1);
    }
    programId = rows.id;
    programName = rows.name;
  } else if (countryArg === 'SGP') {
    const rows = await db.query.programs.findFirst({
      where: (p, { and, eq, ilike }) => and(eq(p.countryIso, 'SGP'), ilike(p.name, '%S Pass%')),
    });
    if (!rows) {
      console.error('No SGP S Pass program found');
      process.exit(1);
    }
    programId = rows.id;
    programName = rows.name;
  } else {
    console.error(`Unknown country: ${countryArg}`);
    process.exit(1);
  }

  console.log(`\nProgram: ${programName} (${programId})`);

  // --- 2. Load methodology version ---
  const mvRows = await db.select().from(methodologyVersions).limit(1);
  if (mvRows.length === 0) {
    console.error('No methodology version found');
    process.exit(1);
  }
  const mv = mvRows[0]!;
  console.log(`Methodology: ${mv.versionTag} (${mv.id})`);

  // --- 3. Load CME score from countries ---
  const countryRow = await db.query.countries.findFirst({
    where: (c, { eq }) => eq(c.isoCode, countryArg),
  });
  const cmeScore = countryRow?.imdAppealScoreCmeNormalized
    ? parseFloat(String(countryRow.imdAppealScoreCmeNormalized))
    : 0;
  console.log(`CME score (IMD normalized): ${cmeScore}`);

  // --- 4. Load approved field values ---
  const approvedFVs = await db
    .select({
      id: fieldValues.id,
      fieldDefinitionId: fieldValues.fieldDefinitionId,
      valueNormalized: fieldValues.valueNormalized,
      status: fieldValues.status,
    })
    .from(fieldValues)
    .where(and(eq(fieldValues.programId, programId), eq(fieldValues.status, 'approved')));

  console.log(`\nApproved field values: ${approvedFVs.length}`);

  if (approvedFVs.length === 0) {
    console.error('No approved field values — run canary first');
    process.exit(1);
  }

  // --- 5. Load all field definitions ---
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

  // --- 6. Assemble ScoringInput ---
  const input: ScoringInput = {
    programId,
    methodologyVersionId: mv.id,
    scoredAt: new Date(),
    cmeScore,
    fieldValues: approvedFVs.map((fv) => ({
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
      scoringRubricJsonb: d.scoringRubricJsonb as import('@gtmi/scoring').CategoricalRubric | null,
      normalizationFn: d.normalizationFn as import('@gtmi/scoring').NormalizationFn,
      direction: d.direction as import('@gtmi/scoring').Direction,
    })),
    normalizationParams: NORMALIZATION_PARAMS,
    activeFieldKeys: WAVE_1_FIELD_CODES,
  };

  // Print which fields will be scored
  const approvedDefIds = new Set(approvedFVs.map((fv) => fv.fieldDefinitionId));
  const scoredDefs = allDefs.filter((d) => approvedDefIds.has(d.id));
  console.log('\nFields being scored:');
  for (const d of scoredDefs) {
    const fv = approvedFVs.find((fv) => fv.fieldDefinitionId === d.id);
    console.log(
      `  ${d.key.padEnd(8)} ${d.normalizationFn.padEnd(12)} → normalized: ${JSON.stringify(fv?.valueNormalized)}`
    );
  }

  // --- 7. Run scoring engine ---
  console.log('\nRunning scoring engine...');
  let output;
  try {
    output = runScoringEngine(input);
  } catch (err) {
    console.error('\nScoring engine error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // --- 8. Print results ---
  console.log('\n' + '='.repeat(60));
  console.log('SCORING RESULTS');
  console.log('='.repeat(60));
  console.log(`PAQ Score:        ${output.paqScore.toFixed(2)}`);
  console.log(`CME Score:        ${output.cmeScore.toFixed(2)}`);
  console.log(`Composite Score:  ${output.compositeScore.toFixed(2)}`);
  console.log(
    `Coverage:         ${output.populatedFieldCount}/${output.activeFieldCount} Wave-1 fields (${((output.populatedFieldCount / Math.max(1, output.activeFieldCount)) * 100).toFixed(1)}%)`
  );
  console.log(`Flagged (insufficient disclosure): ${output.flaggedInsufficientDisclosure}`);
  console.log('\nData coverage by pillar:');
  for (const [pillar, coverage] of Object.entries(output.dataCoverageByPillar)) {
    const pct = (coverage * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(coverage * 20)).padEnd(20, '░');
    console.log(`  ${pillar}: ${bar} ${pct}%`);
  }
  console.log('\nPillar scores:');
  for (const [pillar, score] of Object.entries(output.pillarScores)) {
    console.log(`  ${pillar}: ${score.toFixed(2)}`);
  }

  // --- 9. Write to scores table ---
  const coveragePct = (output.populatedFieldCount / Math.max(1, output.activeFieldCount)) * 100;
  const metadata = {
    phase2Placeholder: true,
    placeholderReason:
      'NORMALIZATION_PARAMS are engineer-chosen ranges, not calibrated from real distribution data. Do not publish publicly.',
    wave: 1,
    activeFieldCount: output.activeFieldCount,
    populatedFieldCount: output.populatedFieldCount,
  };

  const inserted = await db
    .insert(scores)
    .values({
      programId,
      methodologyVersionId: mv.id,
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

  console.log(`\nWritten to scores table — id: ${inserted[0]?.id}`);
  if (output.flaggedInsufficientDisclosure) {
    console.log(
      '\n⚠  FLAGGED: insufficient disclosure (data coverage < 70% in one or more pillars)'
    );
    console.log(
      '   This is expected for Phase 2 with a single program and partial field coverage.'
    );
    console.log('   Scores are deterministic and repeatable — engine is working correctly.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
