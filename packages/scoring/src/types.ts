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
}

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoringError';
  }
}
