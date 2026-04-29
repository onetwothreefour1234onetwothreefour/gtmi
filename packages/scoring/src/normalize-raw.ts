import {
  CategoricalRubric,
  NormalizationFn,
  ScoringError,
  WrappedCategoricalRubric,
  rubricToScoreMap,
} from './types';
import { NO_LIMIT_MARKER, isNumericNoLimitSentinel } from './sentinels';

export type NormalizedValue = number | string | boolean | Record<string, unknown>;

function isNormalizationFn(value: string): value is NormalizationFn {
  return (
    value === 'min_max' ||
    value === 'z_score' ||
    value === 'categorical' ||
    value === 'boolean' ||
    value === 'boolean_with_annotation' ||
    value === 'country_substitute_regional'
  );
}

function isWrappedCategoricalRubric(value: unknown): value is WrappedCategoricalRubric {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec['categories'])) return false;
  return (rec['categories'] as unknown[]).every(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as Record<string, unknown>)['value'] === 'string'
  );
}

function isFlatCategoricalRubric(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0 &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number')
  );
}

function isCategoricalRubric(value: unknown): value is CategoricalRubric {
  return isWrappedCategoricalRubric(value) || isFlatCategoricalRubric(value);
}

/**
 * Parses valueRaw (a string from LLM extraction) into the typed value
 * stored in field_values.value_normalized (JSONB).
 *
 * - min_max / z_score → number  (strips $, commas, %, whitespace)
 * - categorical       → string  (trimmed; validated against rubric keys)
 * - boolean           → boolean (yes/true/1 → true; no/false/0 → false)
 *
 * Throws ScoringError on parse failure so the publish stage fails loudly
 * rather than writing a silently unusable null.
 */
export function normalizeRawValue(
  valueRaw: string,
  def: { normalizationFn: string; scoringRubricJsonb: unknown }
): NormalizedValue {
  const { normalizationFn, scoringRubricJsonb } = def;

  if (!isNormalizationFn(normalizationFn)) {
    throw new ScoringError(`Unknown normalizationFn: "${normalizationFn}"`);
  }

  switch (normalizationFn) {
    case 'min_max':
    case 'z_score': {
      // Phase 3.6.3 / FIX 4 — numeric "no limit" sentinel handling. Fields
      // like A.3.3 (applicant age cap) encode "no cap" as 999 / "none" /
      // "no_cap" / "no_limit". Passing 999 through min_max would distort
      // the cohort max. Return the structured NO_LIMIT_MARKER instead;
      // the engine short-circuits to 100/0 based on direction.
      if (isNumericNoLimitSentinel(valueRaw)) {
        return { ...NO_LIMIT_MARKER };
      }
      const cleaned = valueRaw.replace(/[$,\s%]/g, '');
      const n = parseFloat(cleaned);
      if (!isFinite(n)) {
        throw new ScoringError(
          `Cannot parse "${valueRaw}" as a number for ${normalizationFn} normalization`
        );
      }
      return n;
    }
    case 'categorical': {
      if (!isCategoricalRubric(scoringRubricJsonb)) {
        throw new ScoringError(
          `Field uses categorical normalization but has no valid scoringRubricJsonb`
        );
      }
      const scoreMap = rubricToScoreMap(scoringRubricJsonb);
      const trimmed = valueRaw.trim();
      if (!(trimmed in scoreMap)) {
        throw new ScoringError(
          `Categorical value "${trimmed}" not in rubric. Valid keys: ${Object.keys(scoreMap).join(', ')}`
        );
      }
      return trimmed;
    }
    case 'boolean': {
      const lower = valueRaw.trim().toLowerCase();
      if (lower === 'yes' || lower === 'true' || lower === '1') return true;
      if (lower === 'no' || lower === 'false' || lower === '0') return false;
      throw new ScoringError(
        `Cannot parse "${valueRaw}" as boolean. Expected yes/no/true/false/1/0`
      );
    }
    case 'boolean_with_annotation': {
      // Phase 3.5: the LLM returns the structured object as JSON text in
      // valueRaw. Parse it; trust the publish stage to have validated the
      // shape upstream (the scoring engine's parseIndicatorValue performs
      // the strict shape check before scoring).
      const trimmed = valueRaw.trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new ScoringError(
          `boolean_with_annotation: cannot parse valueRaw as JSON: "${trimmed.slice(0, 80)}…"`
        );
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ScoringError(
          `boolean_with_annotation: parsed JSON must be an object, got ${typeof parsed}`
        );
      }
      return parsed as Record<string, unknown>;
    }
    case 'country_substitute_regional': {
      // Phase 3.5: the substituted value is written by the publish stage
      // as a categorical string ('automatic' / 'fee_paying'); raw form is
      // the same string. Validate against the rubric exactly like
      // categorical so the publish stage cannot stash an unmapped label.
      if (!isCategoricalRubric(scoringRubricJsonb)) {
        throw new ScoringError(
          `Field uses country_substitute_regional normalization but has no valid scoringRubricJsonb`
        );
      }
      const scoreMap = rubricToScoreMap(scoringRubricJsonb);
      const trimmed = valueRaw.trim();
      if (!(trimmed in scoreMap)) {
        throw new ScoringError(
          `country_substitute_regional value "${trimmed}" not in rubric. Valid keys: ${Object.keys(scoreMap).join(', ')}`
        );
      }
      return trimmed;
    }
  }
}
