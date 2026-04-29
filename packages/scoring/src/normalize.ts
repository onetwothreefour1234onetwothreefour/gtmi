import {
  CategoricalRubric,
  Direction,
  NormalizationFn,
  NormalizationParamSet,
  ScoringError,
  rubricToScoreMap,
} from './types';
import { isNoLimitMarker, type NoLimitMarker } from './sentinels';

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

// ────────────────────────────────────────────────────────────────────
// Phase 3.5 / ADR-014 — boolean_with_annotation
//
// Structured value where the primary boolean drives scoring and
// additional fields (notes, daysPerYear) are stored for analyst
// review only.
//
// The boolean field NAME varies per indicator (per the user-approved
// shape from ADR-014):
//   B.2.3 → { hasLevy: boolean,                         notes: string|null }
//   B.2.4 → { hasMandatoryNonGovCosts: boolean,         notes: string|null }
//   D.1.3 → { required: boolean, daysPerYear: number|null, notes: string|null }
//   D.1.4 → { required: boolean, daysPerYear: number|null, notes: string|null }
//
// We resolve the boolean field name via a per-field-key map so the
// scoring engine doesn't need to do schema-discovery on each row.
// ────────────────────────────────────────────────────────────────────
export const BOOLEAN_WITH_ANNOTATION_KEYS: Record<string, string> = {
  'B.2.3': 'hasLevy',
  'B.2.4': 'hasMandatoryNonGovCosts',
  'D.1.3': 'required',
  'D.1.4': 'required',
};

export function normalizeBooleanWithAnnotation(
  parsed: Record<string, unknown>,
  fieldKey: string,
  direction: Direction
): number {
  const booleanKey = BOOLEAN_WITH_ANNOTATION_KEYS[fieldKey];
  if (!booleanKey) {
    throw new ScoringError(
      `boolean_with_annotation: no boolean key registered for field "${fieldKey}"`
    );
  }
  const b = parsed[booleanKey];
  if (typeof b !== 'boolean') {
    throw new ScoringError(
      `boolean_with_annotation: field "${fieldKey}" expects "${booleanKey}: boolean", got ${typeof b}`
    );
  }
  if (direction === 'higher_is_better') {
    return b ? 100 : 0;
  }
  return b ? 0 : 100;
}

// ────────────────────────────────────────────────────────────────────
// Phase 3.5 / ADR-014 — country_substitute_regional
//
// Per the analyst-approved C.3.2 (Public education access) substitution
// matrix:
//   OECD_HIGH_INCOME (AUS, CAN, GBR, SGP, HKG, ...) → 'automatic'  → score 100
//   GCC              (UAE, SAU, BHR, QAT, KWT, OMN) → 'fee_paying' → score 40
//   OTHER            (everything else)              → null         → missing
//
// The substitution map is per-field so future indicators (if any) can
// register their own regional defaults without affecting C.3.2.
//
// At publish time, when the LLM returns no value AND the indicator's
// normalizationFn === 'country_substitute_regional', a synthetic
// field_values row is written with valueNormalized set to the
// substituted categorical string and provenance.extractionModel set to
// 'country-substitute-regional'. Scoring then reads the categorical
// value out of valueNormalized exactly like a normal categorical.
// ────────────────────────────────────────────────────────────────────
export type Region = 'OECD_HIGH_INCOME' | 'GCC' | 'OTHER';

export const COUNTRY_REGIONS: Record<string, Region> = {
  // 5 pilot countries.
  AUS: 'OECD_HIGH_INCOME',
  CAN: 'OECD_HIGH_INCOME',
  GBR: 'OECD_HIGH_INCOME',
  SGP: 'OECD_HIGH_INCOME',
  HKG: 'OECD_HIGH_INCOME',
  // Wider OECD high-income cohort (used as Phase 5 expands).
  CHE: 'OECD_HIGH_INCOME',
  NLD: 'OECD_HIGH_INCOME',
  IRL: 'OECD_HIGH_INCOME',
  LUX: 'OECD_HIGH_INCOME',
  ISL: 'OECD_HIGH_INCOME',
  DEU: 'OECD_HIGH_INCOME',
  SWE: 'OECD_HIGH_INCOME',
  BEL: 'OECD_HIGH_INCOME',
  AUT: 'OECD_HIGH_INCOME',
  JPN: 'OECD_HIGH_INCOME',
  NOR: 'OECD_HIGH_INCOME',
  TWN: 'OECD_HIGH_INCOME',
  USA: 'OECD_HIGH_INCOME',
  FIN: 'OECD_HIGH_INCOME',
  DNK: 'OECD_HIGH_INCOME',
  EST: 'OECD_HIGH_INCOME',
  LTU: 'OECD_HIGH_INCOME',
  FRA: 'OECD_HIGH_INCOME',
  NZL: 'OECD_HIGH_INCOME',
  // Gulf Cooperation Council.
  ARE: 'GCC',
  UAE: 'GCC',
  SAU: 'GCC',
  BHR: 'GCC',
  QAT: 'GCC',
  KWT: 'GCC',
  OMN: 'GCC',
};

interface RegionalSubValue {
  value: string;
  score: number;
}

export const REGIONAL_SUBSTITUTES: Record<string, Partial<Record<Region, RegionalSubValue>>> = {
  // C.3.2 — Public education access for children of visa holders.
  'C.3.2': {
    OECD_HIGH_INCOME: { value: 'automatic', score: 100 },
    GCC: { value: 'fee_paying', score: 40 },
    // OTHER intentionally omitted → missing data penalty applies.
  },
};

export interface RegionalSubstitute {
  value: string | null;
  score: number | null;
  region: Region;
}

export function getRegionalSubstitute(countryIso: string, fieldKey: string): RegionalSubstitute {
  const region = COUNTRY_REGIONS[countryIso] ?? 'OTHER';
  const fieldMap = REGIONAL_SUBSTITUTES[fieldKey];
  if (!fieldMap) {
    return { value: null, score: null, region };
  }
  const sub = fieldMap[region];
  if (!sub) {
    return { value: null, score: null, region };
  }
  return { value: sub.value, score: sub.score, region };
}

/**
 * Parse valueNormalized from JSONB based on the normalization function.
 * Throws ScoringError if the stored type does not match what the fn expects.
 *
 * Returns a wider type than the previous version: boolean_with_annotation
 * returns the raw object (the engine extracts the boolean via the
 * BOOLEAN_WITH_ANNOTATION_KEYS map). country_substitute_regional returns
 * a string (the substituted categorical value).
 */
export function parseIndicatorValue(
  valueNormalized: unknown,
  fn: NormalizationFn
): number | string | boolean | Record<string, unknown> | NoLimitMarker {
  if (fn === 'min_max' || fn === 'z_score') {
    // Phase 3.6.3 / FIX 4 — accept the no-limit sentinel marker as a
    // legitimate parsed value. The engine short-circuits scoring for it.
    if (isNoLimitMarker(valueNormalized)) {
      return valueNormalized;
    }
    if (typeof valueNormalized !== 'number') {
      throw new ScoringError(
        `Expected JSON number for normalizationFn "${fn}", got ${typeof valueNormalized}`
      );
    }
    return valueNormalized;
  }
  if (fn === 'categorical' || fn === 'country_substitute_regional') {
    if (typeof valueNormalized !== 'string') {
      throw new ScoringError(
        `Expected JSON string for normalizationFn "${fn}", got ${typeof valueNormalized}`
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
  if (fn === 'boolean_with_annotation') {
    if (
      typeof valueNormalized !== 'object' ||
      valueNormalized === null ||
      Array.isArray(valueNormalized)
    ) {
      throw new ScoringError(
        `Expected JSON object for normalizationFn "boolean_with_annotation", got ${typeof valueNormalized}`
      );
    }
    return valueNormalized as Record<string, unknown>;
  }
  throw new ScoringError(`Unknown normalizationFn: "${String(fn)}"`);
}
