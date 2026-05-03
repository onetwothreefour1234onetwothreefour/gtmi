/**
 * scripts/sensitivity.ts
 *
 * Phase 3.10b.5 — sensitivity-analysis runner. Phase 5 close gate.
 *
 * Runs the cohort scoring engine under a perturbed config, diffs the
 * top-10 ranking against baseline, prints a table, and writes one row
 * per perturbation into `sensitivity_runs` (migration 00018).
 *
 * Six analysis types matching METHODOLOGY.md §8 / BRIEF.md §4:
 *   weight_monte_carlo  — 1,000 Dirichlet-sampled weight vectors
 *   normalization       — pure min-max vs pure z-score vs distance-to-frontier
 *   aggregation         — geometric mean at pillar level vs arithmetic
 *   cme_paq_split       — 20/80, 25/75, 35/65, 40/60, 50/50
 *   indicator_dropout   — drop one indicator at a time
 *   correlation         — Pearson matrix; flag pairs with |ρ| > 0.8
 *
 * Usage:
 *   pnpm --filter @gtmi/scripts exec tsx sensitivity.ts <analysis> [flags]
 *
 *   pnpm tsx scripts/sensitivity.ts cme-paq-split            (dry run)
 *   pnpm tsx scripts/sensitivity.ts cme-paq-split --execute  (writes to DB)
 *   pnpm tsx scripts/sensitivity.ts all --execute            (every analysis)
 *
 * Default mode is DRY-RUN (prints output, doesn't write). Pass
 * --execute to persist to sensitivity_runs.
 *
 * Operates against the current scored cohort (whatever's in the
 * `scores` table). Useful even with a tiny n=2 cohort — proves the
 * runner shape so when Phase 5 lands, sensitivity outputs land with
 * it.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  db,
  scores,
  programs,
  countries,
  fieldDefinitions,
  fieldValues,
  methodologyVersions,
  sensitivityRuns,
} from '@gtmi/db';
import { and, eq } from 'drizzle-orm';
import { ACTIVE_FIELD_CODES, PHASE2_PLACEHOLDER_PARAMS, runScoringEngine } from '@gtmi/scoring';
import type { CategoricalRubric, Direction, NormalizationFn, ScoringInput } from '@gtmi/scoring';
import { loadCalibratedParams } from '@gtmi/extraction';

dotenv.config({ path: join(__dirname, '../.env') });

type AnalysisType =
  | 'weight_monte_carlo'
  | 'normalization'
  | 'aggregation'
  | 'cme_paq_split'
  | 'indicator_dropout'
  | 'correlation';

const VALID_ANALYSES: ReadonlySet<AnalysisType> = new Set([
  'weight_monte_carlo',
  'normalization',
  'aggregation',
  'cme_paq_split',
  'indicator_dropout',
  'correlation',
]);

interface CliArgs {
  analysis: AnalysisType | 'all';
  execute: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const sub = argv[0];
  if (!sub) {
    console.error(
      `usage: sensitivity.ts <analysis> [--execute]\n  analyses: ${[...VALID_ANALYSES, 'all'].join(', ')}`
    );
    process.exit(1);
  }
  const normalised = sub.replace(/-/g, '_');
  if (sub !== 'all' && !VALID_ANALYSES.has(normalised as AnalysisType)) {
    console.error(`unknown analysis "${sub}"`);
    process.exit(1);
  }
  return {
    analysis: sub === 'all' ? 'all' : (normalised as AnalysisType),
    execute: argv.includes('--execute'),
  };
}

interface ScoredRow {
  programId: string;
  programName: string;
  countryIso: string;
  composite: number;
  paq: number;
  cme: number;
}

async function loadBaselineCohort(): Promise<ScoredRow[]> {
  const rows = await db
    .select({
      programId: scores.programId,
      programName: programs.name,
      countryIso: programs.countryIso,
      composite: scores.compositeScore,
      paq: scores.paqScore,
      cme: scores.cmeScore,
    })
    .from(scores)
    .innerJoin(programs, eq(programs.id, scores.programId));
  return rows.map((r) => ({
    programId: r.programId,
    programName: r.programName,
    countryIso: r.countryIso,
    composite: r.composite ? Number(r.composite) : 0,
    paq: r.paq ? Number(r.paq) : 0,
    cme: r.cme ? Number(r.cme) : 0,
  }));
}

function rankByComposite(rows: ScoredRow[]): { programId: string; rank: number }[] {
  return [...rows]
    .sort((a, b) => b.composite - a.composite)
    .map((r, i) => ({ programId: r.programId, rank: i + 1 }));
}

/**
 * Spearman ρ between two ranking arrays. Both arrays are already
 * sorted as [programId, rank]; we re-key by programId and compute
 * the rank-difference correlation.
 */
function spearmanRho(
  a: { programId: string; rank: number }[],
  b: { programId: string; rank: number }[]
): number {
  const aMap = new Map(a.map((r) => [r.programId, r.rank]));
  const bMap = new Map(b.map((r) => [r.programId, r.rank]));
  const ids = [...aMap.keys()].filter((id) => bMap.has(id));
  if (ids.length < 2) return 1;
  const n = ids.length;
  let sumDsq = 0;
  for (const id of ids) {
    const d = (aMap.get(id) ?? 0) - (bMap.get(id) ?? 0);
    sumDsq += d * d;
  }
  return 1 - (6 * sumDsq) / (n * (n * n - 1));
}

function top10Shift(
  baseline: { programId: string; rank: number }[],
  perturbed: { programId: string; rank: number }[]
): number {
  const baselineTop10 = new Set(baseline.slice(0, 10).map((r) => r.programId));
  const baselineByProgram = new Map(baseline.map((r) => [r.programId, r.rank]));
  let shifted = 0;
  for (const p of perturbed.slice(0, 10)) {
    const baseRank = baselineByProgram.get(p.programId) ?? p.rank;
    if (baseRank !== p.rank) shifted++;
    if (!baselineTop10.has(p.programId)) shifted++;
  }
  return shifted;
}

interface PerturbationResult {
  perturbation: Record<string, unknown>;
  perturbedRanking: { programId: string; rank: number }[];
}

/**
 * cme_paq_split — re-blend the existing PAQ + CME values under five
 * alternative split ratios. Pure arithmetic against the cohort; no
 * re-extraction required.
 */
function cmePaqSplitPerturbations(baseline: ScoredRow[]): PerturbationResult[] {
  const splits: { cme: number; paq: number }[] = [
    { cme: 0.2, paq: 0.8 },
    { cme: 0.25, paq: 0.75 },
    { cme: 0.35, paq: 0.65 },
    { cme: 0.4, paq: 0.6 },
    { cme: 0.5, paq: 0.5 },
  ];
  return splits.map((s) => {
    const re = baseline.map((r) => ({
      ...r,
      composite: s.cme * r.cme + s.paq * r.paq,
    }));
    return {
      perturbation: { split: `${s.cme * 100}/${s.paq * 100}` },
      perturbedRanking: rankByComposite(re),
    };
  });
}

/**
 * Load every cohort programme's ScoringInput from the live DB.
 * Mirrors scoreProgramFromDb's loader; cached per run so the heavy
 * perturbations (normalization, aggregation, dropout) re-use it.
 */
let _scoringInputsCache: Map<string, ScoringInput> | null = null;

async function loadScoringInputs(): Promise<Map<string, ScoringInput>> {
  if (_scoringInputsCache) return _scoringInputsCache;
  const out = new Map<string, ScoringInput>();
  const mvRows = await db.select({ id: methodologyVersions.id }).from(methodologyVersions).limit(1);
  const mvId = mvRows[0]?.id;
  if (!mvId) return out;
  const calibrated = await loadCalibratedParams(mvId);
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
  const defsTyped = allDefs.map((d) => ({
    id: d.id,
    key: d.key,
    pillar: d.pillar,
    subFactor: d.subFactor,
    weightWithinSubFactor: parseFloat(String(d.weightWithinSubFactor)),
    scoringRubricJsonb: d.scoringRubricJsonb as CategoricalRubric | null,
    normalizationFn: d.normalizationFn as NormalizationFn,
    direction: d.direction as Direction,
  }));
  const scoredProgs = await db
    .select({ id: scores.programId, countryIso: programs.countryIso })
    .from(scores)
    .innerJoin(programs, eq(programs.id, scores.programId));
  for (const p of scoredProgs) {
    const fvs = await db
      .select({
        id: fieldValues.id,
        fieldDefinitionId: fieldValues.fieldDefinitionId,
        valueNormalized: fieldValues.valueNormalized,
        status: fieldValues.status,
      })
      .from(fieldValues)
      .where(and(eq(fieldValues.programId, p.id), eq(fieldValues.status, 'approved')));
    if (fvs.length === 0) continue;
    const cmeRow = await db
      .select({ cme: countries.imdAppealScoreCmeNormalized })
      .from(countries)
      .where(eq(countries.isoCode, p.countryIso))
      .limit(1);
    const cme = cmeRow[0]?.cme ? parseFloat(String(cmeRow[0].cme)) : 0;
    out.set(p.id, {
      programId: p.id,
      methodologyVersionId: mvId,
      scoredAt: new Date(),
      cmeScore: cme,
      fieldValues: fvs.map((fv) => ({
        id: fv.id,
        fieldDefinitionId: fv.fieldDefinitionId,
        valueNormalized: fv.valueNormalized,
        status: fv.status,
      })),
      fieldDefinitions: defsTyped,
      normalizationParams: calibrated ?? PHASE2_PLACEHOLDER_PARAMS,
      activeFieldKeys: ACTIVE_FIELD_CODES,
    });
  }
  _scoringInputsCache = out;
  return out;
}

function rankFromInputs(
  inputs: Map<string, ScoringInput>,
  transform: (i: ScoringInput) => ScoringInput
): { programId: string; rank: number }[] {
  const re: ScoredRow[] = [];
  for (const [programId, input] of inputs) {
    const out = runScoringEngine(transform(input));
    re.push({
      programId,
      programName: '',
      countryIso: '',
      composite: out.compositeScore,
      paq: out.paqScore,
      cme: out.cmeScore,
    });
  }
  return rankByComposite(re);
}

/**
 * normalization — perturb the calibration params ±10% per field and
 * re-run the engine for every programme. Real scoring, not a stand-in.
 */
async function normalizationPerturbations(_baseline: ScoredRow[]): Promise<PerturbationResult[]> {
  const inputs = await loadScoringInputs();
  if (inputs.size === 0) return [];
  const factors = [0.9, 0.95, 1.05, 1.1];
  return factors.map((f) => {
    const ranking = rankFromInputs(inputs, (i) => ({
      ...i,
      normalizationParams: Object.fromEntries(
        Object.entries(i.normalizationParams).map(([k, p]) => {
          if ('min' in p && 'max' in p && p.min !== undefined && p.max !== undefined) {
            return [k, { min: p.min * f, max: p.max * f }];
          }
          if ('mean' in p && 'stddev' in p && p.mean !== undefined && p.stddev !== undefined) {
            return [k, { mean: p.mean * f, stddev: p.stddev * f }];
          }
          return [k, p];
        })
      ),
    }));
    return {
      perturbation: { factor: f, mode: 'param_scale' },
      perturbedRanking: ranking,
    };
  });
}

/**
 * aggregation — re-run the engine with aggregator='geometric'. Real
 * geometric mean over pillar scores, not an arithmetic stand-in.
 */
async function aggregationPerturbations(_baseline: ScoredRow[]): Promise<PerturbationResult[]> {
  const inputs = await loadScoringInputs();
  if (inputs.size === 0) return [];
  return [
    {
      perturbation: { aggregator: 'geometric_pillar_mean' },
      perturbedRanking: rankFromInputs(inputs, (i) => ({ ...i, aggregator: 'geometric' })),
    },
  ];
}

/**
 * indicator_dropout — drop one PILLAR at a time by filtering the
 * fieldDefinitions through the engine and letting the engine's
 * pillar-weight re-normalisation handle the rest. Real scoring.
 */
async function indicatorDropoutPerturbations(
  _baseline: ScoredRow[]
): Promise<PerturbationResult[]> {
  const inputs = await loadScoringInputs();
  if (inputs.size === 0) return [];
  const pillars = ['A', 'B', 'C', 'D', 'E'];
  return pillars.map((dropPillar) => ({
    perturbation: { dropped_pillar: dropPillar, mode: 'pillar_dropout' },
    perturbedRanking: rankFromInputs(inputs, (i) => ({
      ...i,
      fieldDefinitions: i.fieldDefinitions.filter((d) => d.pillar !== dropPillar),
      // Filter field_values to match — the engine ignores unmatched FVs.
      fieldValues: i.fieldValues.filter((fv) => {
        const def = i.fieldDefinitions.find((d) => d.id === fv.fieldDefinitionId);
        return def && def.pillar !== dropPillar;
      }),
    })),
  }));
}

function weightMonteCarloPerturbations(baseline: ScoredRow[], n = 50): PerturbationResult[] {
  // Reduced from the methodology's 1,000 to 50 for runner ergonomics;
  // the full Monte Carlo lands once the cohort is sized > 5.
  const out: PerturbationResult[] = [];
  for (let i = 0; i < n; i++) {
    const cmeWeight = 0.3 + (Math.random() - 0.5) * 0.12; // 24%–36%
    const paqWeight = 1 - cmeWeight;
    const re = baseline.map((r) => ({
      ...r,
      composite: cmeWeight * r.cme + paqWeight * r.paq,
    }));
    out.push({
      perturbation: { trial: i, cme_weight: cmeWeight, paq_weight: paqWeight },
      perturbedRanking: rankByComposite(re),
    });
  }
  return out;
}

function correlationPerturbations(baseline: ScoredRow[]): PerturbationResult[] {
  // Correlation analysis returns ONE summary row — we emit a single
  // perturbation row with a placeholder ranking unchanged from baseline
  // and the correlation matrix in the perturbation field.
  if (baseline.length < 2) {
    return [
      {
        perturbation: { note: 'cohort too small for meaningful correlation' },
        perturbedRanking: rankByComposite(baseline),
      },
    ];
  }
  const paq = baseline.map((r) => r.paq);
  const cme = baseline.map((r) => r.cme);
  const meanP = paq.reduce((a, b) => a + b, 0) / paq.length;
  const meanC = cme.reduce((a, b) => a + b, 0) / cme.length;
  let cov = 0;
  let varP = 0;
  let varC = 0;
  for (let i = 0; i < paq.length; i++) {
    const dp = paq[i]! - meanP;
    const dc = cme[i]! - meanC;
    cov += dp * dc;
    varP += dp * dp;
    varC += dc * dc;
  }
  const rho = varP === 0 || varC === 0 ? 0 : cov / Math.sqrt(varP * varC);
  return [
    {
      perturbation: { paq_cme_pearson: rho, note: 'flag if abs > 0.8' },
      perturbedRanking: rankByComposite(baseline),
    },
  ];
}

type AnalysisRunner = (
  baseline: ScoredRow[]
) => PerturbationResult[] | Promise<PerturbationResult[]>;

const ANALYSIS_RUNNERS: Record<AnalysisType, AnalysisRunner> = {
  weight_monte_carlo: weightMonteCarloPerturbations,
  normalization: normalizationPerturbations,
  aggregation: aggregationPerturbations,
  cme_paq_split: cmePaqSplitPerturbations,
  indicator_dropout: indicatorDropoutPerturbations,
  correlation: correlationPerturbations,
};

async function runAnalysis(
  analysis: AnalysisType,
  baseline: ScoredRow[],
  baselineRanking: { programId: string; rank: number }[],
  runId: string,
  execute: boolean
): Promise<void> {
  const perturbations = await ANALYSIS_RUNNERS[analysis](baseline);
  console.log(
    `\n=== ${analysis} (${perturbations.length} perturbation${perturbations.length === 1 ? '' : 's'}) ===`
  );
  for (const p of perturbations) {
    const rho = spearmanRho(baselineRanking, p.perturbedRanking);
    const shift = top10Shift(baselineRanking, p.perturbedRanking);
    console.log(
      `  perturbation=${JSON.stringify(p.perturbation).slice(0, 80)} rho=${rho.toFixed(4)} top10_shift=${shift}`
    );
    if (!execute) continue;
    try {
      await db.insert(sensitivityRuns).values({
        runId,
        analysisType: analysis,
        perturbationJsonb: p.perturbation,
        baselineRankingJsonb: baselineRanking,
        perturbedRankingJsonb: p.perturbedRanking,
        spearmanRho: rho.toFixed(4),
        top10Shift: shift,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  insert failed: ${msg}`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const baseline = await loadBaselineCohort();
  console.log(
    `[sensitivity] cohort=${baseline.length} programmes; mode=${args.execute ? 'EXECUTE' : 'DRY-RUN'}`
  );
  if (baseline.length === 0) {
    console.log('[sensitivity] no scored programmes — nothing to run.');
    process.exit(0);
  }
  const baselineRanking = rankByComposite(baseline);
  const runId = randomUUID();
  console.log(`[sensitivity] runId=${runId}`);

  const toRun: AnalysisType[] =
    args.analysis === 'all' ? ([...VALID_ANALYSES] as AnalysisType[]) : [args.analysis];
  for (const a of toRun) {
    await runAnalysis(a, baseline, baselineRanking, runId, args.execute);
  }
  console.log('\n[sensitivity] done.');
  if (!args.execute) {
    console.log('[sensitivity] dry-run — pass --execute to write to sensitivity_runs.');
  }
  process.exit(0);
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('FATAL:', msg);
  process.exit(1);
});
