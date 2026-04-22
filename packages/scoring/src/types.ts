export type NormalizationFn = 'min_max' | 'z_score' | 'categorical' | 'boolean';

export type Direction = 'higher_is_better' | 'lower_is_better';

export type FlatCategoricalRubric = Record<string, number>;

export interface WrappedCategoricalRubric {
  categories: Array<{
    value: string;
    score: number;
    description?: string;
  }>;
}

export type CategoricalRubric = FlatCategoricalRubric | WrappedCategoricalRubric;

export function rubricToScoreMap(rubric: CategoricalRubric): Record<string, number> {
  if (
    typeof rubric === 'object' &&
    rubric !== null &&
    'categories' in rubric &&
    Array.isArray((rubric as WrappedCategoricalRubric).categories)
  ) {
    const map: Record<string, number> = {};
    for (const c of (rubric as WrappedCategoricalRubric).categories) {
      map[c.value] = c.score;
    }
    return map;
  }
  return rubric as FlatCategoricalRubric;
}

export interface NormalizationParamSet {
  min?: number;
  max?: number;
  mean?: number;
  stddev?: number;
}

/** Keyed by fieldDefinition.key (e.g. "A.1.1"). */
export type NormalizationParams = Record<string, NormalizationParamSet>;

export interface FieldDefinitionRecord {
  id: string;
  key: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: number;
  scoringRubricJsonb: CategoricalRubric | null;
  normalizationFn: NormalizationFn;
  direction: Direction;
}

export interface FieldValueRecord {
  id: string;
  fieldDefinitionId: string;
  valueNormalized: unknown;
  status: string;
}

export interface ScoringInput {
  programId: string;
  methodologyVersionId: string;
  scoredAt: Date;
  cmeScore: number;
  fieldValues: FieldValueRecord[];
  fieldDefinitions: FieldDefinitionRecord[];
  normalizationParams: NormalizationParams;
  /**
   * Optional: restrict scoring scope to these field keys (e.g. Wave 1 only).
   * When provided:
   *   - Sub-factor denominators use only keys intersecting the active set.
   *   - Sub-factors with no active keys are excluded from pillar aggregation,
   *     and the pillar's sub-factor weights are re-normalized accordingly.
   *   - Coverage percentages use only active-set keys.
   * When omitted, all fieldDefinitions count toward denominators (Phase 3 behavior).
   */
  activeFieldKeys?: string[];
}

export interface ScoringOutput {
  programId: string;
  methodologyVersionId: string;
  scoredAt: Date;
  cmeScore: number;
  paqScore: number;
  compositeScore: number;
  pillarScores: Record<string, number>;
  subFactorScores: Record<string, number>;
  dataCoverageByPillar: Record<string, number>;
  flaggedInsufficientDisclosure: boolean;
  /** Total active fields in scope (denominator for data_coverage_pct). */
  activeFieldCount: number;
  /** Populated fields in scope (numerator for data_coverage_pct). */
  populatedFieldCount: number;
}

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoringError';
  }
}
