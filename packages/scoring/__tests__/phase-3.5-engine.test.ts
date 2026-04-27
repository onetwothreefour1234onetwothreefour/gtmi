import { describe, expect, it } from 'vitest';
import { runScoringEngine } from '../src/engine';
import type { ScoringInput } from '../src/types';

// Phase 3.5 / ADR-014 — engine integration tests for boolean_with_annotation
// and country_substitute_regional. Validates that the new normalization
// fns plug into the full scoring pipeline without breaking the existing
// math.

const SCORED_AT = new Date('2026-04-27T00:00:00.000Z');

function buildInput(opts: {
  defKey: string;
  fn: 'boolean_with_annotation' | 'country_substitute_regional';
  direction: 'higher_is_better' | 'lower_is_better';
  rubric: unknown;
  valueNormalized: unknown;
}): ScoringInput {
  return {
    programId: 'prog-test',
    methodologyVersionId: 'meth-2.0.0',
    scoredAt: SCORED_AT,
    cmeScore: 50,
    fieldDefinitions: [
      {
        id: 'def-1',
        key: opts.defKey,
        pillar: 'B',
        subFactor: 'B.2',
        weightWithinSubFactor: 1.0,
        scoringRubricJsonb: opts.rubric as never,
        normalizationFn: opts.fn,
        direction: opts.direction,
      },
    ],
    fieldValues: [
      {
        id: 'val-1',
        fieldDefinitionId: 'def-1',
        valueNormalized: opts.valueNormalized,
        status: 'approved',
      },
    ],
    normalizationParams: {},
  };
}

describe('runScoringEngine — boolean_with_annotation (Phase 3.5)', () => {
  const STRUCTURED_RUBRIC = {
    categories: [
      { value: 'true', score: 0 },
      { value: 'false', score: 100 },
    ],
  };

  it('B.2.3 hasLevy=true (lower_is_better) → indicator score 0', () => {
    const input = buildInput({
      defKey: 'B.2.3',
      fn: 'boolean_with_annotation',
      direction: 'lower_is_better',
      rubric: STRUCTURED_RUBRIC,
      valueNormalized: { hasLevy: true, notes: 'SAF AUD 1,800/yr' },
    });
    const out = runScoringEngine(input);
    expect(out.subFactorScores['B.2']).toBe(0);
  });

  it('B.2.3 hasLevy=false → 100', () => {
    const input = buildInput({
      defKey: 'B.2.3',
      fn: 'boolean_with_annotation',
      direction: 'lower_is_better',
      rubric: STRUCTURED_RUBRIC,
      valueNormalized: { hasLevy: false, notes: null },
    });
    const out = runScoringEngine(input);
    expect(out.subFactorScores['B.2']).toBe(100);
  });

  it('D.1.3 required=true with daysPerYear annotation → 0 (annotation does not affect score)', () => {
    const input = buildInput({
      defKey: 'D.1.3',
      fn: 'boolean_with_annotation',
      direction: 'lower_is_better',
      rubric: STRUCTURED_RUBRIC,
      valueNormalized: { required: true, daysPerYear: 219, notes: '1,095 days in 5 years' },
    });
    const out = runScoringEngine(input);
    expect(out.subFactorScores['B.2']).toBe(0);
  });

  it('D.1.4 required=false → 100 even when daysPerYear is null', () => {
    const input = buildInput({
      defKey: 'D.1.4',
      fn: 'boolean_with_annotation',
      direction: 'lower_is_better',
      rubric: STRUCTURED_RUBRIC,
      valueNormalized: { required: false, daysPerYear: null, notes: null },
    });
    const out = runScoringEngine(input);
    expect(out.subFactorScores['B.2']).toBe(100);
  });
});

describe('runScoringEngine — country_substitute_regional (Phase 3.5)', () => {
  const C32_RUBRIC = {
    categories: [
      { value: 'automatic', score: 100 },
      { value: 'fee_paying', score: 40 },
    ],
  };

  it('C.3.2 "automatic" (OECD high-income default) → 100', () => {
    const input = buildInput({
      defKey: 'C.3.2',
      fn: 'country_substitute_regional',
      direction: 'higher_is_better',
      rubric: C32_RUBRIC,
      valueNormalized: 'automatic',
    });
    const out = runScoringEngine(input);
    expect(out.subFactorScores['B.2']).toBe(100);
  });

  it('C.3.2 "fee_paying" (GCC default) → 40', () => {
    const input = buildInput({
      defKey: 'C.3.2',
      fn: 'country_substitute_regional',
      direction: 'higher_is_better',
      rubric: C32_RUBRIC,
      valueNormalized: 'fee_paying',
    });
    const out = runScoringEngine(input);
    expect(out.subFactorScores['B.2']).toBe(40);
  });

  it('country_substitute_regional without rubric throws', () => {
    const input = buildInput({
      defKey: 'C.3.2',
      fn: 'country_substitute_regional',
      direction: 'higher_is_better',
      rubric: null,
      valueNormalized: 'automatic',
    });
    expect(() => runScoringEngine(input)).toThrow(/no scoringRubricJsonb/);
  });
});
