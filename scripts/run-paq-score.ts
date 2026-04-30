/**
 * Phase 2 PAQ scoring CLI.
 *
 * Resolves a programme by --country (with a fallback keyword) or
 * --programId, then delegates to `scoreProgramFromDb` in
 * @gtmi/extraction (Phase 3.8 / ADR-022). The orchestration that used
 * to live inline here — methodology-version lookup, CME load,
 * approved-field-values read, ScoringInput build, runScoringEngine,
 * scores upsert — is now a single shared helper used by:
 *
 *   - this CLI,
 *   - apps/web/app/(internal)/review/rescore-actions.ts (the manual
 *     re-score buttons), and
 *   - scripts/canary-run.ts (auto-rescore after extraction).
 *
 *  ⚠️  PHASE 2 PLACEHOLDER RANGES — NOT PUBLICATION-READY
 *
 * The scoring uses PHASE2_PLACEHOLDER_PARAMS from @gtmi/scoring —
 * engineer-chosen ranges that are NOT calibrated against real
 * cross-programme distribution data. Every score row is tagged with
 * `metadata.phase2Placeholder = true`; downstream consumers should
 * refuse to publish until Phase 5 calibration replaces the ranges.
 *
 * Scope: ACTIVE_FIELD_CODES (Wave 1 ∪ Wave 2 when WAVE_2_ENABLED).
 * Out-of-scope fields do not contribute to denominators or weight
 * re-normalisation.
 *
 * Usage:
 *   npx tsx scripts/run-paq-score.ts --country AUS [--programId <uuid>]
 */

import { db } from '@gtmi/db';
import { scoreProgramFromDb } from '@gtmi/extraction';

async function resolveProgramId(
  countryArg: string,
  programIdArg: string | undefined
): Promise<{ id: string; name: string }> {
  if (programIdArg) {
    const row = await db.query.programs.findFirst({
      where: (p, { eq }) => eq(p.id, programIdArg),
    });
    if (!row) {
      console.error(`No program found: ${programIdArg}`);
      process.exit(1);
    }
    return { id: row.id, name: row.name };
  }

  const defaultKeywords: Record<string, string> = {
    AUS: 'skills in demand',
    SGP: 's pass',
    CAN: 'express entry',
    GBR: 'skilled worker visa',
  };
  const keyword = defaultKeywords[countryArg];
  const allForCountry = await db.query.programs.findMany({
    where: (p, { eq }) => eq(p.countryIso, countryArg),
    columns: { id: true, name: true },
  });
  if (allForCountry.length === 0) {
    console.error(`No programs found for country_iso="${countryArg}"`);
    process.exit(1);
  }
  const matched = keyword
    ? allForCountry.filter((r) => r.name.toLowerCase().includes(keyword))
    : [];
  const selected = (matched.length > 0 ? matched : allForCountry)[0]!;
  return { id: selected.id, name: selected.name };
}

async function main(): Promise<void> {
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

  const program = await resolveProgramId(countryArg, programIdArg);
  console.log(`\nProgram: ${program.name} (${program.id})`);

  // Phase 3.8 / ADR-022 — single delegated call. The helper handles
  // methodology lookup, CME load, approved-field-values read,
  // ScoringInput build, runScoringEngine, and the scores upsert.
  const r = await scoreProgramFromDb(program.id);

  // Console output preserves the legacy CLI shape so existing analyst
  // muscle memory + log-grep recipes keep working.
  console.log(`Methodology: (${r.methodologyVersionId})`);
  console.log('\n' + '='.repeat(60));
  console.log('SCORING RESULTS');
  console.log('='.repeat(60));
  console.log(`PAQ Score:        ${r.engine.paqScore.toFixed(2)}`);
  console.log(`CME Score:        ${r.engine.cmeScore.toFixed(2)}`);
  console.log(`Composite Score:  ${r.engine.compositeScore.toFixed(2)}`);
  console.log(
    `Coverage:         ${r.engine.populatedFieldCount}/${r.engine.activeFieldCount} active fields ` +
      `(${((r.engine.populatedFieldCount / Math.max(1, r.engine.activeFieldCount)) * 100).toFixed(1)}%)`
  );
  console.log(`Flagged (insufficient disclosure): ${r.engine.flaggedInsufficientDisclosure}`);

  console.log('\nData coverage by pillar:');
  for (const [pillar, coverage] of Object.entries(r.engine.dataCoverageByPillar)) {
    const pct = (coverage * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(coverage * 20)).padEnd(20, '░');
    console.log(`  ${pillar}: ${bar} ${pct}%`);
  }

  console.log('\nPillar scores:');
  for (const [pillar, score] of Object.entries(r.engine.pillarScores)) {
    console.log(`  ${pillar}: ${score.toFixed(2)}`);
  }

  console.log(`\nWritten to scores table — id: ${r.scoresRowId ?? '(no row id returned)'}`);

  if (r.engine.flaggedInsufficientDisclosure) {
    console.log(
      '\n⚠  FLAGGED: insufficient disclosure (data coverage < 70% in one or more pillars)'
    );
    console.log(
      '   This is expected for partial coverage; scores are deterministic and repeatable — engine is working correctly.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
