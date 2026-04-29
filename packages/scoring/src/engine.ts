import {
  FieldDefinitionRecord,
  NormalizationFn,
  NormalizationParams,
  ScoringError,
  ScoringInput,
  ScoringOutput,
} from './types';
import {
  normalizeBoolean,
  normalizeBooleanWithAnnotation,
  normalizeCategorical,
  normalizeMinMax,
  normalizeZScore,
  parseIndicatorValue,
} from './normalize';
import { isNoLimitMarker, isNotApplicableMarker } from './sentinels';
import {
  INSUFFICIENT_DISCLOSURE_THRESHOLD,
  CME_WEIGHT,
  PAQ_WEIGHT,
  PILLAR_WEIGHTS,
  SUB_FACTOR_WEIGHTS,
  aggregateWeightedMean,
  applyMissingDataPenalty,
  computeDataCoverage,
  reNormalizeWeights,
} from './score';

const KNOWN_NORMALIZATION_FNS = new Set<NormalizationFn>([
  'min_max',
  'z_score',
  'categorical',
  'boolean',
  'boolean_with_annotation',
  'country_substitute_regional',
]);

interface IndicatorResult {
  defKey: string;
  subFactor: string;
  pillar: string;
  score: number;
  weight: number;
}

/**
 * Phase 3.7 / ADR-019 — score one indicator in isolation.
 *
 * Pure: takes a field definition, a normalised value, and the per-field
 * normalisation parameters; returns a 0–100 score. No DB, no I/O.
 *
 * Returns `null` when the input is missing or the `notApplicable: true`
 * marker is present — those rows are excluded from scoring.
 *
 * `runScoringEngine` and `PublishStageImpl.execute` (and the /review
 * approve / edit actions) call this so a single row can be scored
 * without re-running the whole programme.
 */
export function scoreSingleIndicator(args: {
  fieldDefinition: FieldDefinitionRecord;
  valueNormalized: unknown;
  normalizationParams: NormalizationParams;
}): number | null {
  const { fieldDefinition: def, valueNormalized, normalizationParams } = args;
  if (valueNormalized === null || valueNormalized === undefined) return null;
  if (isNotApplicableMarker(valueNormalized)) return null;

  const parsed = parseIndicatorValue(valueNormalized, def.normalizationFn);
  const params = normalizationParams[def.key] ?? {};

  switch (def.normalizationFn) {
    case 'min_max':
      // Phase 3.6.3 / FIX 4 — sentinel short-circuit. "no limit" rows
      // bypass min_max entirely so 999/none/no_cap can never distort the
      // cohort range. higher_is_better → 100; lower_is_better → 0.
      if (isNoLimitMarker(parsed)) {
        return def.direction === 'higher_is_better' ? 100 : 0;
      }
      return normalizeMinMax(parsed as number, params, def.direction);
    case 'z_score':
      if (isNoLimitMarker(parsed)) {
        return def.direction === 'higher_is_better' ? 100 : 0;
      }
      return normalizeZScore(parsed as number, params, def.direction);
    case 'categorical':
    case 'country_substitute_regional': {
      // country_substitute_regional reuses the categorical scoring path —
      // the substituted string in valueNormalized maps to a rubric score
      // exactly like a normal categorical extraction. The "country
      // substitute" provenance lives on the field_values row's
      // provenance.extractionModel, not in scoring.
      if (!def.scoringRubricJsonb) {
        throw new ScoringError(
          `Field "${def.key}" uses ${def.normalizationFn} normalization but has no scoringRubricJsonb`
        );
      }
      return normalizeCategorical(parsed as string, def.scoringRubricJsonb);
    }
    case 'boolean':
      return normalizeBoolean(parsed as boolean, def.direction);
    case 'boolean_with_annotation':
      return normalizeBooleanWithAnnotation(
        parsed as Record<string, unknown>,
        def.key,
        def.direction
      );
  }
}

function scoreIndicator(
  def: FieldDefinitionRecord,
  valueNormalized: unknown,
  input: ScoringInput
): number {
  // Inside the cohort engine we know the value is present (the caller
  // already filtered nulls + notApplicable markers in the gather loop),
  // so a null result here is a pipeline bug — surface it loudly.
  const score = scoreSingleIndicator({
    fieldDefinition: def,
    valueNormalized,
    normalizationParams: input.normalizationParams,
  });
  if (score === null) {
    throw new ScoringError(
      `scoreSingleIndicator returned null for "${def.key}" — value should have been filtered upstream`
    );
  }
  return score;
}

export function runScoringEngine(input: ScoringInput): ScoringOutput {
  // Step 1: Validate
  for (const fv of input.fieldValues) {
    if (fv.status !== 'approved') {
      throw new ScoringError(
        `FieldValue ${fv.id} has status "${fv.status}" — only approved values may be scored`
      );
    }
  }
  for (const def of input.fieldDefinitions) {
    if (!KNOWN_NORMALIZATION_FNS.has(def.normalizationFn)) {
      throw new ScoringError(
        `Unknown normalizationFn "${def.normalizationFn}" on field "${def.key}"`
      );
    }
  }

  // Step 2: Build lookup maps
  const defById = new Map<string, FieldDefinitionRecord>();
  for (const def of input.fieldDefinitions) {
    defById.set(def.id, def);
  }

  // Restrict scope when activeFieldKeys is provided.
  const activeSet = input.activeFieldKeys ? new Set(input.activeFieldKeys) : null;
  const activeDefs = activeSet
    ? input.fieldDefinitions.filter((d) => activeSet.has(d.key))
    : input.fieldDefinitions;

  const valueByDefId = new Map<string, unknown>();
  for (const fv of input.fieldValues) {
    if (fv.valueNormalized === null || fv.valueNormalized === undefined) continue;
    // Phase 3.6.6 / FIX 1 — `notApplicable: true` rows exist for
    // coverage/audit purposes but contribute no score (the indicator
    // genuinely does not apply to the programme). Excluding them here
    // mirrors the missing-data path and keeps min_max / z_score
    // parsing honest.
    if (isNotApplicableMarker(fv.valueNormalized)) continue;
    valueByDefId.set(fv.fieldDefinitionId, fv.valueNormalized);
  }

  // Step 3: Score each present indicator (only within active scope)
  const indicatorResults: IndicatorResult[] = [];
  for (const def of activeDefs) {
    const valueNormalized = valueByDefId.get(def.id);
    if (valueNormalized === undefined) continue; // missing — excluded
    const score = scoreIndicator(def, valueNormalized, input);
    indicatorResults.push({
      defKey: def.key,
      subFactor: def.subFactor,
      pillar: def.pillar,
      score,
      weight: def.weightWithinSubFactor,
    });
  }

  // Step 4: Aggregate to sub-factor scores
  // Group active defs by subFactor for total counts (denominator respects active scope)
  const defsBySubFactor = new Map<string, FieldDefinitionRecord[]>();
  for (const def of activeDefs) {
    const group = defsBySubFactor.get(def.subFactor) ?? [];
    group.push(def);
    defsBySubFactor.set(def.subFactor, group);
  }

  // Group indicator results by subFactor for present counts
  const resultsBySubFactor = new Map<string, IndicatorResult[]>();
  for (const result of indicatorResults) {
    const group = resultsBySubFactor.get(result.subFactor) ?? [];
    group.push(result);
    resultsBySubFactor.set(result.subFactor, group);
  }

  const subFactorScores: Record<string, number> = {};
  const subFactorCoverage = new Map<string, { present: number; total: number; pillar: string }>();

  for (const [subFactor, defs] of defsBySubFactor) {
    const presentResults = resultsBySubFactor.get(subFactor) ?? [];
    const total = defs.length;
    const present = presentResults.length;
    const pillar = defs[0].pillar;

    subFactorCoverage.set(subFactor, { present, total, pillar });

    // Sub-factors with no active fields in scope are excluded from scoring entirely
    // (handled downstream at pillar aggregation). Skip here so we don't emit a 0.
    if (total === 0) continue;

    if (present === 0) {
      // All in-scope indicators missing — propagate as 0 with full penalty; the pillar
      // coverage check will flag insufficient_disclosure if needed.
      subFactorScores[subFactor] = 0;
      continue;
    }

    const allWeights: Record<string, number> = {};
    for (const def of defs) {
      allWeights[def.key] = def.weightWithinSubFactor;
    }
    const presentKeys = new Set(presentResults.map((r) => r.defKey));
    const reNormalized = reNormalizeWeights(allWeights, presentKeys, subFactor);

    const weightedItems = presentResults.map((r) => ({
      score: r.score,
      weight: reNormalized[r.defKey] ?? 0,
    }));
    const rawScore = aggregateWeightedMean(weightedItems);
    subFactorScores[subFactor] = applyMissingDataPenalty(rawScore, present, total);
  }

  // Step 5: Compute dataCoverageByPillar
  const pillarCoverageNumerator = new Map<string, number>();
  const pillarCoverageDenominator = new Map<string, number>();
  for (const [, { present, total, pillar }] of subFactorCoverage) {
    pillarCoverageNumerator.set(pillar, (pillarCoverageNumerator.get(pillar) ?? 0) + present);
    pillarCoverageDenominator.set(pillar, (pillarCoverageDenominator.get(pillar) ?? 0) + total);
  }

  const dataCoverageByPillar: Record<string, number> = {};
  for (const pillar of Object.keys(PILLAR_WEIGHTS)) {
    const present = pillarCoverageNumerator.get(pillar) ?? 0;
    const total = pillarCoverageDenominator.get(pillar) ?? 0;
    dataCoverageByPillar[pillar] = computeDataCoverage(present, total);
  }

  // Step 6: Flag insufficient disclosure
  const flaggedInsufficientDisclosure = Object.values(dataCoverageByPillar).some(
    (coverage) => coverage < INSUFFICIENT_DISCLOSURE_THRESHOLD
  );

  // Step 7: Aggregate sub-factors → pillar scores (re-normalize when sub-factors are
  // out of scope so in-scope weights sum to 1.0 within the pillar).
  const pillarScores: Record<string, number> = {};
  for (const pillar of Object.keys(PILLAR_WEIGHTS)) {
    const sfWeights = SUB_FACTOR_WEIGHTS[pillar];
    if (!sfWeights) {
      throw new ScoringError(`No sub-factor weights defined for pillar "${pillar}"`);
    }
    const scoped = Object.entries(sfWeights).filter(([sf]) => subFactorScores[sf] !== undefined);
    if (scoped.length === 0) {
      pillarScores[pillar] = 0;
      continue;
    }
    const weightSum = scoped.reduce((acc, [, w]) => acc + w, 0);
    const items = scoped.map(([sf, w]) => ({
      score: subFactorScores[sf] ?? 0,
      weight: weightSum > 0 ? w / weightSum : 0,
    }));
    pillarScores[pillar] = aggregateWeightedMean(items);
  }

  // Step 8: PAQ score — re-normalize pillar weights over pillars that have at least
  // one in-scope sub-factor, so PAQ is not diluted by entirely-out-of-scope pillars.
  const pillarsInScope = Object.keys(PILLAR_WEIGHTS).filter((p) =>
    Object.keys(SUB_FACTOR_WEIGHTS[p] ?? {}).some((sf) => subFactorScores[sf] !== undefined)
  );
  const pillarWeightSum = pillarsInScope.reduce((s, p) => s + (PILLAR_WEIGHTS[p] ?? 0), 0);
  const paqItems = pillarsInScope.map((p) => ({
    score: pillarScores[p] ?? 0,
    weight: pillarWeightSum > 0 ? (PILLAR_WEIGHTS[p] ?? 0) / pillarWeightSum : 0,
  }));
  const paqScore = aggregateWeightedMean(paqItems);

  // Step 9: Composite score
  const compositeScore = CME_WEIGHT * input.cmeScore + PAQ_WEIGHT * paqScore;

  // Step 10: Coverage counts (denominator = active scope)
  const activeFieldCount = activeDefs.length;
  const populatedFieldCount = indicatorResults.length;

  return {
    programId: input.programId,
    methodologyVersionId: input.methodologyVersionId,
    scoredAt: input.scoredAt,
    cmeScore: input.cmeScore,
    paqScore,
    compositeScore,
    pillarScores,
    subFactorScores,
    dataCoverageByPillar,
    flaggedInsufficientDisclosure,
    activeFieldCount,
    populatedFieldCount,
  };
}
