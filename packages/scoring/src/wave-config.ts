/**
 * Wave configuration — methodology-version constants for the canary /
 * Trigger.dev extraction pipeline + the public scoring engine.
 *
 * Wave 1 was the original 27 sub-factors used to validate the end-to-end
 * pipeline on the AUS canary. Wave 2 covers the remaining 21 sub-factors
 * needed for full methodology coverage (48 fields total).
 *
 * Consumers MUST import `ACTIVE_FIELD_CODES` rather than `WAVE_1_FIELD_CODES`
 * directly so a single flag flip changes scope across canary, Trigger.dev,
 * scoring, and the diagnostic.
 *
 * Phase 3.7 / ADR-021 promoted this module from `scripts/wave-config.ts`
 * into `@gtmi/scoring` so apps/web can read it without depending on the
 * scripts workspace. `scripts/wave-config.ts` is kept as a re-export
 * shim for backwards compatibility.
 */

export const WAVE_1_ENABLED = true;
export const WAVE_2_ENABLED = true;

export const WAVE_1_FIELD_CODES: string[] = [
  'A.1.1',
  'A.2.1',
  'A.2.2',
  'A.2.3',
  'A.3.1',
  'A.3.2',
  'B.1.1',
  'B.1.2',
  'B.1.3',
  'B.2.1',
  'B.2.2',
  'C.1.1',
  'C.1.2',
  'C.1.4',
  'C.2.1',
  'C.2.2',
  'C.2.3',
  'C.3.1',
  'C.3.2',
  'D.1.1',
  'D.1.2',
  'D.2.1',
  'D.2.2',
  'E.1.1',
  'E.1.3',
  'E.2.2',
  'E.3.2',
];

// Remaining 21 sub-factors required for full 48-field methodology coverage.
export const WAVE_2_FIELD_CODES: string[] = [
  'A.1.2',
  'A.1.3',
  'A.3.3',
  'B.2.3',
  'B.2.4',
  'B.3.1',
  'B.3.2',
  'B.3.3',
  'C.1.3',
  'C.2.4',
  'D.1.3',
  'D.1.4',
  'D.2.3',
  'D.2.4',
  'D.3.1',
  'D.3.2',
  'D.3.3',
  'E.1.2',
  'E.2.1',
  'E.2.3',
  'E.3.1',
];

export const ACTIVE_FIELD_CODES: string[] = WAVE_2_ENABLED
  ? [...WAVE_1_FIELD_CODES, ...WAVE_2_FIELD_CODES]
  : WAVE_1_FIELD_CODES;
