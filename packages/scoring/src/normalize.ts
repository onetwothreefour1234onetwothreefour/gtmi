import {
  CategoricalRubric,
  Direction,
  NormalizationFn,
  NormalizationParamSet,
  ScoringError,
  rubricToScoreMap,
} from './types.ts';

/**
 * Abramowitz & Stegun approximation 26.2.17.
 * Max error: 7.5e-8. No external dependencies.
 */
function phi(z: number): number {
  if (z < 0) return 1 - phi(-z);
  const t = 1 / (1 + 0.2316419 * z);
  const poly =
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return 1 - pdf * poly;
}

export function normalizeMinMax(
  value: number,
  params: NormalizationParamSet,
  direction: Direction
): number {
  if (params.min === undefined || params.max === undefined) {
    throw new ScoringError('min_max normalization requires min and max in NormalizationParams');
  }
  if (params.min === params.max) {
    throw new ScoringError(`min_max normalization degenerate range: min === max === ${params.min}`);
  }
  const raw =
    direction === 'higher_is_better'
      ? (value - params.min) / (params.max - params.min)
      : (params.max - value) / (params.max - params.min);
  return Math.min(100, Math.max(0, raw * 100));
}

export function normalizeZScore(
  value: number,
  params: NormalizationParamSet,
  direction: Direction
): number {
  if (params.mean === undefined || params.stddev === undefined) {
    throw new ScoringError('z_score normalization requires mean and stddev in NormalizationParams');
  }
  if (params.stddev === 0) {
    throw new ScoringError('z_score normalization requires stddev !== 0');
  }
  const z = (value - params.mean) / params.stddev;
  const score = direction === 'higher_is_better' ? phi(z) : phi(-z);
  return Math.min(100, Math.max(0, score * 100));
}

export function normalizeCategorical(value: string, rubric: CategoricalRubric): number {
  const scoreMap = rubricToScoreMap(rubric);
  if (!(value in scoreMap)) {
    throw new ScoringError(
      `Categorical value "${value}" not found in rubric. Valid keys: ${Object.keys(scoreMap).join(', ')}`
    );
  }
  return scoreMap[value];
}

export function normalizeBoolean(value: boolean, direction: Direction): number {
  if (direction === 'higher_is_better') {
    return value ? 100 : 0;
  }
  return value ? 0 : 100;
}

/**
 * Parse valueNormalized from JSONB based on the normalization function.
 * Throws ScoringError if the stored type does not match what the fn expects.
 */
export function parseIndicatorValue(
  valueNormalized: unknown,
  fn: NormalizationFn
): number | string | boolean {
  if (fn === 'min_max' || fn === 'z_score') {
    if (typeof valueNormalized !== 'number') {
      throw new ScoringError(
        `Expected JSON number for normalizationFn "${fn}", got ${typeof valueNormalized}`
      );
    }
    return valueNormalized;
  }
  if (fn === 'categorical') {
    if (typeof valueNormalized !== 'string') {
      throw new ScoringError(
        `Expected JSON string for normalizationFn "categorical", got ${typeof valueNormalized}`
      );
    }
    return valueNormalized;
  }
  if (fn === 'boolean') {
    if (typeof valueNormalized !== 'boolean') {
      throw new ScoringError(
        `Expected JSON boolean for normalizationFn "boolean", got ${typeof valueNormalized}`
      );
    }
    return valueNormalized;
  }
  throw new ScoringError(`Unknown normalizationFn: "${String(fn)}"`);
}
