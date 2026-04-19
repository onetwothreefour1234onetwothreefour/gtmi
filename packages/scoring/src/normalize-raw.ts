import { CategoricalRubric, NormalizationFn, ScoringError } from './types.ts';

export type NormalizedValue = number | string | boolean;

function isNormalizationFn(value: string): value is NormalizationFn {
  return (
    value === 'min_max' || value === 'z_score' || value === 'categorical' || value === 'boolean'
  );
}

function isCategoricalRubric(value: unknown): value is CategoricalRubric {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number')
  );
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
      const trimmed = valueRaw.trim();
      if (!(trimmed in scoringRubricJsonb)) {
        throw new ScoringError(
          `Categorical value "${trimmed}" not in rubric. Valid keys: ${Object.keys(scoringRubricJsonb).join(', ')}`
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
  }
}
