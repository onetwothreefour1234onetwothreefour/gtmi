import {
  FieldDefinitionRecord,
  NormalizationFn,
  ScoringError,
  ScoringInput,
  ScoringOutput,
} from './types.ts';
import {
  normalizeBoolean,
  normalizeCategorical,
  normalizeMinMax,
  normalizeZScore,
  parseIndicatorValue,
} from './normalize.ts';
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
} from './score.ts';

const KNOWN_NORMALIZATION_FNS = new Set<NormalizationFn>([
  'min_max',
  'z_score',
  'categorical',
  'boolean',
]);

interface IndicatorResult {
  defKey: string;
  subFactor: string;
  pillar: string;
  score: number;
  weight: number;
}

function scoreIndicator(
  def: FieldDefinitionRecord,
  valueNormalized: unknown,
  input: ScoringInput
): number {
  const parsed = parseIndicatorValue(valueNormalized, def.normalizationFn);
  const params = input.normalizationParams[def.key] ?? {};

  switch (def.normalizationFn) {
    case 'min_max':
      return normalizeMinMax(parsed as number, params, def.direction);
    case 'z_score':
      return normalizeZScore(parsed as number, params, def.direction);
    case 'categorical': {
      if (!def.scoringRubricJsonb) {
        throw new ScoringError(
          `Field "${def.key}" uses categorical normalization but has no scoringRubricJsonb`
        );
      }
      return normalizeCategorical(parsed as string, def.scoringRubricJsonb);
    }
    case 'boolean':
      return normalizeBoolean(parsed as boolean, def.direction);
  }
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

  const valueByDefId = new Map<string, unknown>();
  for (const fv of input.fieldValues) {
    if (fv.valueNormalized !== null && fv.valueNormalized !== undefined) {
      valueByDefId.set(fv.fieldDefinitionId, fv.valueNormalized);
    }
  }

  // Step 3: Score each present indicator
  const indicatorResults: IndicatorResult[] = [];
  for (const def of input.fieldDefinitions) {
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
  // Group defs by subFactor for total counts
  const defsBySubFactor = new Map<string, FieldDefinitionRecord[]>();
  for (const def of input.fieldDefinitions) {
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

    if (present === 0) {
      // All indicators missing — propagate as 0 with full penalty; the pillar
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

  // Step 7: Aggregate sub-factors → pillar scores
  const pillarScores: Record<string, number> = {};
  for (const pillar of Object.keys(PILLAR_WEIGHTS)) {
    const sfWeights = SUB_FACTOR_WEIGHTS[pillar];
    if (!sfWeights) {
      throw new ScoringError(`No sub-factor weights defined for pillar "${pillar}"`);
    }
    const items = Object.entries(sfWeights)
      .filter(([sf]) => subFactorScores[sf] !== undefined)
      .map(([sf, weight]) => ({ score: subFactorScores[sf] ?? 0, weight }));
    pillarScores[pillar] = aggregateWeightedMean(items);
  }

  // Step 8: PAQ score
  const paqItems = Object.entries(PILLAR_WEIGHTS).map(([pillar, weight]) => ({
    score: pillarScores[pillar] ?? 0,
    weight,
  }));
  const paqScore = aggregateWeightedMean(paqItems);

  // Step 9: Composite score
  const compositeScore = CME_WEIGHT * input.cmeScore + PAQ_WEIGHT * paqScore;

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
  };
}
