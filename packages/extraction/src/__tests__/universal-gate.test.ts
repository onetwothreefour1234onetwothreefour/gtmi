import { describe, expect, it } from 'vitest';
import { isNumericInSanityRange, NUMERIC_SANITY_RANGES } from '../stages/publish';

// Phase 3.8 / P1 — universal sanity gate for numeric fields. The gate
// catches obviously wrong LLM extractions (negative salaries, 99,999-day
// SLAs, age caps of -3) and routes them to /review with score=null
// instead of producing a nonsense score from the placeholder calibration.

describe('NUMERIC_SANITY_RANGES coverage', () => {
  it('covers the active numeric fields in PHASE2_PLACEHOLDER_PARAMS', () => {
    // The gate must know about every field that `scoreSingleIndicator`
    // can touch — otherwise an out-of-range value falls through to
    // scoring with the placeholder params and produces a 0 / 100 that
    // looks correct.
    const expectedKeys = [
      'A.1.1',
      'A.1.3',
      'A.1.5',
      'A.2.1',
      'A.2.3',
      'B.1.1',
      'B.2.1',
      'B.2.2',
      'B.3.1',
      'C.2.2',
      'D.1.2',
      'D.2.2',
      'D.3.1',
      'E.1.1',
      'E.1.3',
      'E.3.1',
      'E.3.2',
    ];
    for (const k of expectedKeys) {
      expect(NUMERIC_SANITY_RANGES[k], `missing sanity range for ${k}`).toBeDefined();
    }
  });

  it('every range has min <= max', () => {
    for (const [k, r] of Object.entries(NUMERIC_SANITY_RANGES)) {
      expect(r.min, `${k}: min`).toBeLessThanOrEqual(r.max);
    }
  });
});

describe('isNumericInSanityRange', () => {
  it('accepts the lower and upper bounds inclusively', () => {
    const r = NUMERIC_SANITY_RANGES['A.1.1']!;
    expect(isNumericInSanityRange('A.1.1', r.min)).toBe(true);
    expect(isNumericInSanityRange('A.1.1', r.max)).toBe(true);
  });

  it('rejects a negative % of median (A.1.1)', () => {
    expect(isNumericInSanityRange('A.1.1', -1)).toBe(false);
  });

  it('rejects an absurdly long SLA (B.1.1)', () => {
    expect(isNumericInSanityRange('B.1.1', 100_000)).toBe(false);
  });

  it('rejects a >100% rule-of-law score (E.3.1 must be in [-5,5])', () => {
    expect(isNumericInSanityRange('E.3.1', 8)).toBe(false);
    expect(isNumericInSanityRange('E.3.1', -8)).toBe(false);
    expect(isNumericInSanityRange('E.3.1', 0)).toBe(true);
  });

  it('rejects the integer 999 on age-cap fields (methodology v4.0.0 / ADR-030: no_cap token is the only no-cap encoding)', () => {
    // Sanity ranges for A.1.5 / C.2.2 dropped to 0..100 — the integer
    // 999 no longer trickles through as a "valid age". The no-cap
    // semantic is carried via the sentinel-token route (valueRaw =
    // 'no_cap' | 'no_limit' | 'none' | '999') which normalize-raw.ts
    // converts to the structured NO_LIMIT_MARKER before this gate.
    expect(isNumericInSanityRange('A.1.5', 999)).toBe(false);
    expect(isNumericInSanityRange('C.2.2', 999)).toBe(false);
    // The realistic cap upper bound (100) still passes.
    expect(isNumericInSanityRange('A.1.5', 100)).toBe(true);
    expect(isNumericInSanityRange('C.2.2', 100)).toBe(true);
  });

  it('fails open for unknown fields (no entry → returns true)', () => {
    expect(isNumericInSanityRange('UNKNOWN.0.0', 1e9)).toBe(true);
    expect(isNumericInSanityRange('UNKNOWN.0.0', -1e9)).toBe(true);
  });
});
