// Phase 3.6.3 / FIX 4 — numeric sentinel handling for "no limit" values.
//
// Some min_max / z_score numeric fields use a sentinel value to mean
// "no limit" rather than a real measurement. The canonical case is
// A.3.3 (applicant age cap): a program with no age cap is the BEST
// outcome under that field's higher_is_better direction, but the LLM
// historically encoded "no cap" as the integer 999 (or the string
// "none"). Passing 999 through min_max distorts the cohort-wide max
// during calibration and corrupts every other program's score on that
// field.
//
// This module exports the canonical sentinel set and helpers used by
// the publish path, normalize-raw, parseIndicatorValue, and the engine
// to short-circuit min_max / z_score normalisation when valueRaw is a
// sentinel. The published row carries valueNormalized={__noLimit: true}
// (a structured marker) and the engine returns score=100 for
// higher_is_better fields, score=0 for lower_is_better fields, without
// passing through min_max.

export const NUMERIC_NO_LIMIT_SENTINELS: ReadonlySet<string> = new Set([
  '999',
  'none',
  'no_cap',
  'no_limit',
]);

/** Marker stored in field_values.value_normalized for sentinel rows. */
export const NO_LIMIT_MARKER = { __noLimit: true } as const;
export type NoLimitMarker = typeof NO_LIMIT_MARKER;

/**
 * Returns true if the trimmed lowercased valueRaw matches a recognised
 * "no limit" sentinel for a numeric field.
 */
export function isNumericNoLimitSentinel(valueRaw: string): boolean {
  return NUMERIC_NO_LIMIT_SENTINELS.has(valueRaw.trim().toLowerCase());
}

/** Returns true if the value is the sentinel marker shape. */
export function isNoLimitMarker(value: unknown): value is NoLimitMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)['__noLimit'] === true
  );
}
