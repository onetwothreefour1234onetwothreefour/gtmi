// Phase 3.6.3 / FIX 4 — sentinel "no limit" tests for min_max / z_score.
//
// A.3.3 (applicant age cap) is the canonical case: a program with no age
// cap is the BEST outcome under higher_is_better. Encoding "no cap" as
// 999 / "none" / "no_cap" / "no_limit" must short-circuit min_max so the
// sentinel never distorts the cohort range during calibration and so the
// indicator score is 100 regardless of the cohort's real-age min/max.

import { describe, expect, it } from 'vitest';
import {
  NUMERIC_NO_LIMIT_SENTINELS,
  NO_LIMIT_MARKER,
  isNoLimitMarker,
  isNumericNoLimitSentinel,
  normalizeRawValue,
  runScoringEngine,
  type FieldDefinitionRecord,
  type FieldValueRecord,
  type ScoringInput,
} from '../src';

const minMaxDef = { normalizationFn: 'min_max', scoringRubricJsonb: null };

describe('isNumericNoLimitSentinel', () => {
  it('matches every canonical sentinel', () => {
    for (const s of NUMERIC_NO_LIMIT_SENTINELS) {
      expect(isNumericNoLimitSentinel(s)).toBe(true);
    }
  });
  it('matches case-insensitively after trim', () => {
    expect(isNumericNoLimitSentinel('  None ')).toBe(true);
    expect(isNumericNoLimitSentinel('NO_CAP')).toBe(true);
  });
  it('does not match real numbers', () => {
    expect(isNumericNoLimitSentinel('45')).toBe(false);
    expect(isNumericNoLimitSentinel('1000')).toBe(false);
    expect(isNumericNoLimitSentinel('')).toBe(false);
  });
});

describe('isNoLimitMarker', () => {
  it('recognises the canonical marker shape', () => {
    expect(isNoLimitMarker(NO_LIMIT_MARKER)).toBe(true);
    expect(isNoLimitMarker({ __noLimit: true })).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isNoLimitMarker(null)).toBe(false);
    expect(isNoLimitMarker(45)).toBe(false);
    expect(isNoLimitMarker('999')).toBe(false);
    expect(isNoLimitMarker({ __noLimit: false })).toBe(false);
    expect(isNoLimitMarker([])).toBe(false);
  });
});

describe('normalizeRawValue — sentinel handling for min_max / z_score', () => {
  it('"999" returns the no-limit marker for min_max', () => {
    const result = normalizeRawValue('999', minMaxDef);
    expect(isNoLimitMarker(result)).toBe(true);
  });
  it('"none" returns the no-limit marker', () => {
    expect(isNoLimitMarker(normalizeRawValue('none', minMaxDef))).toBe(true);
  });
  it('"no_cap" returns the no-limit marker', () => {
    expect(isNoLimitMarker(normalizeRawValue('no_cap', minMaxDef))).toBe(true);
  });
  it('"no_limit" returns the no-limit marker', () => {
    expect(isNoLimitMarker(normalizeRawValue('no_limit', minMaxDef))).toBe(true);
  });
  it('a real numeric string still parses to a number', () => {
    expect(normalizeRawValue('45', minMaxDef)).toBe(45);
  });
});

describe('runScoringEngine — sentinel short-circuits min_max', () => {
  const ageDef: FieldDefinitionRecord = {
    id: 'def-a33',
    key: 'A.3.3',
    pillar: 'A',
    subFactor: 'A.3',
    normalizationFn: 'min_max',
    direction: 'higher_is_better',
    weightWithinSubFactor: 0.25,
    scoringRubricJsonb: null,
  };
  const realAgeFv: FieldValueRecord = {
    id: 'fv-real',
    fieldDefinitionId: 'def-a33',
    valueNormalized: 45,
    status: 'approved',
  };
  const sentinelFv: FieldValueRecord = {
    id: 'fv-no-cap',
    fieldDefinitionId: 'def-a33',
    valueNormalized: { __noLimit: true },
    status: 'approved',
  };
  function makeInput(
    fieldValues: FieldValueRecord[],
    direction: 'higher_is_better' | 'lower_is_better' = 'higher_is_better'
  ): ScoringInput {
    return {
      programId: 'p',
      methodologyVersionId: 'm',
      scoredAt: new Date(),
      cmeScore: 50,
      fieldDefinitions: [{ ...ageDef, direction }],
      normalizationParams: { 'A.3.3': { min: 25, max: 65 } },
      activeFieldKeys: ['A.3.3'],
      fieldValues,
    };
  }

  it('sentinel valueNormalized → indicator score 100 (higher_is_better)', () => {
    const out = runScoringEngine(makeInput([sentinelFv]));
    expect(out.pillarScores['A']).toBe(100);
  });
  it('real numeric valueNormalized still uses min_max normally', () => {
    const out = runScoringEngine(makeInput([realAgeFv]));
    // (45 - 25) / (65 - 25) * 100 = 50
    expect(out.pillarScores['A']).toBeCloseTo(50, 1);
  });
  it('lower_is_better with sentinel → score 0', () => {
    const out = runScoringEngine(makeInput([sentinelFv], 'lower_is_better'));
    expect(out.pillarScores['A']).toBe(0);
  });
});
