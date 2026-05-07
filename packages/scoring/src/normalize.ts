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
// Methodology v5.0.0 (ADR-031): the map is empty.
//   - B.2.3 / B.2.4 retired in v3.0.0 (ADR-029)
//   - D.1.3 / D.1.4 retired in v5.0.0 (ADR-031)
//
// The boolean_with_annotation engine branch + normalize function are
// left in place dormant per §k.4 of ADR-031; cleanup deferred to ADR-032
// (alongside country_substitute_regional cleanup).
// ────────────────────────────────────────────────────────────────────
export const BOOLEAN_WITH_ANNOTATION_KEYS: Record<string, string> = {};

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

// ────────────────────────────────────────────────────────────────────
// Methodology v6.0.0 / ADR-032 — numeric_or_categorical normalization.
//
// Pillar E.1.2 (cumulative approvals or active visa holders) accepts
// either an integer count (preferred) or a categorical bucket string
// from the LLM. The rubric defines five buckets in fixed order:
//   large > medium > small > marginal > no_data
// with scores 100 / 75 / 50 / 25 / 0. The numeric form is scored via
// piecewise linear interpolation anchored at the bucket boundaries:
//   ≥ 50_000        → 100  (large)
//   10_000..50_000  → 75..100  (medium → large)
//   1_000..10_000   → 50..75   (small → medium)
//   100..1_000      → 25..50   (marginal → small)
//   0..100          → 0..25    (no_data → marginal)
// This keeps the numeric and categorical forms numerically continuous
// at the bucket boundaries: 50_000 → 100 (top of medium = bottom of
// large), 10_000 → 75 (top of small = bottom of medium), etc.
// ────────────────────────────────────────────────────────────────────

interface NumericOrCategoricalBucket {
  /** Bucket lower bound (inclusive). */
  threshold: number;
  /** Bucket score at the lower bound. */
  score: number;
}

/**
 * Bucket boundaries for E.1.2 — must match the rubric in
 * packages/db/src/seed/rubric-scores.ts.
 *
 * Ordered ascending by threshold so the engine can find the
 * containing bucket with a single forward scan. The terminal bucket
 * (large, threshold 50_000) caps at score 100; values above 50_000
 * still score 100 (rubric calls "large" the top tier).
 */
const NUMERIC_OR_CATEGORICAL_BUCKETS: Record<string, NumericOrCategoricalBucket[]> = {
  'E.1.2': [
    { threshold: 0, score: 0 }, // no_data baseline
    { threshold: 100, score: 25 }, // marginal lower
    { threshold: 1_000, score: 50 }, // small lower
    { threshold: 10_000, score: 75 }, // medium lower
    { threshold: 50_000, score: 100 }, // large lower (and ceiling)
  ],
};

export function normalizeNumericOrCategorical(
  parsed: number | string,
  fieldKey: string,
  rubric: CategoricalRubric | null,
  direction: Direction
): number {
  // String form → straightforward rubric lookup.
  if (typeof parsed === 'string') {
    if (!rubric) {
      throw new ScoringError(
        `numeric_or_categorical: field "${fieldKey}" has a string value but no scoringRubricJsonb`
      );
    }
    return normalizeCategorical(parsed, rubric);
  }

  // Numeric form → piecewise linear interpolation against the field's
  // bucket configuration. Bucket map is per-field (currently E.1.2
  // only) and intentionally NOT derived from the rubric — the rubric
  // describes the bucket SCORES; the numeric thresholds live here.
  const buckets = NUMERIC_OR_CATEGORICAL_BUCKETS[fieldKey];
  if (!buckets || buckets.length === 0) {
    throw new ScoringError(
      `numeric_or_categorical: field "${fieldKey}" has a numeric value but no bucket configuration in NUMERIC_OR_CATEGORICAL_BUCKETS`
    );
  }
  // Negative inputs round to the bottom bucket (the LLM should never
  // hand back a negative count, but the sanity range catches it
  // upstream — fail open here).
  let raw: number;
  if (parsed <= buckets[0]!.threshold) {
    raw = buckets[0]!.score;
  } else if (parsed >= buckets[buckets.length - 1]!.threshold) {
    raw = buckets[buckets.length - 1]!.score;
  } else {
    raw = buckets[0]!.score;
    for (let i = 1; i < buckets.length; i++) {
      const prev = buckets[i - 1]!;
      const curr = buckets[i]!;
      if (parsed >= prev.threshold && parsed < curr.threshold) {
        const frac = (parsed - prev.threshold) / (curr.threshold - prev.threshold);
        raw = prev.score + frac * (curr.score - prev.score);
        break;
      }
    }
  }
  // Direction inversion is symmetric to other normFns. lower_is_better
  // is unusual for E.1.2 (more visa holders = better), but supported
  // for symmetry.
  if (direction === 'lower_is_better') {
    return Math.min(100, Math.max(0, 100 - raw));
  }
  return Math.min(100, Math.max(0, raw));
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
    if (typeof valueNormalized === 'string') return valueNormalized;
    // Phase 3.8 / shape-mismatch fix — `executeCountrySubstitute` in
    // PublishStageImpl writes value_normalized as the structured object
    // `{substituted: true, value: 'automatic'|'fee_paying', region}`.
    // The substitute vocabulary intentionally diverges from the field
    // rubric (ADR-014), so the engine's country_substitute_regional
    // case scores via REGIONAL_SUBSTITUTES[def.key][region] rather than
    // a rubric lookup. parseIndicatorValue therefore returns the object
    // verbatim for that fn so the engine can discriminate by shape.
    if (
      fn === 'country_substitute_regional' &&
      typeof valueNormalized === 'object' &&
      valueNormalized !== null &&
      !Array.isArray(valueNormalized) &&
      typeof (valueNormalized as { value?: unknown }).value === 'string'
    ) {
      return valueNormalized as Record<string, unknown>;
    }
    throw new ScoringError(
      `Expected JSON string for normalizationFn "${fn}", got ${typeof valueNormalized}`
    );
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
  if (fn === 'numeric_or_categorical') {
    // Methodology v6.0.0 / ADR-032 — accept either a JSON number
    // (preferred) or a JSON string (categorical fallback). The engine
    // discriminates by typeof and dispatches to interpolation or rubric
    // lookup accordingly.
    if (typeof valueNormalized === 'number') return valueNormalized;
    if (typeof valueNormalized === 'string') return valueNormalized;
    throw new ScoringError(
      `Expected JSON number or string for normalizationFn "numeric_or_categorical", got ${typeof valueNormalized}`
    );
  }
  throw new ScoringError(`Unknown normalizationFn: "${String(fn)}"`);
}
