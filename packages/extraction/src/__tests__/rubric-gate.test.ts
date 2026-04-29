import { describe, expect, it } from 'vitest';
import { isCategoricalRubric, rubricIncludesValue, rubricValues } from '../stages/publish';

// Phase 3.7 / ADR-019 — categorical rubric gate at publish.
// These tests cover the pure rubric helpers used to decide whether a
// raw value falls inside the methodology's allowed categorical set.

const C31_RUBRIC = {
  categories: [
    { value: 'full_access', score: 100, description: 'unconditional public healthcare' },
    { value: 'levy_required', score: 75, description: 'fee-paying access' },
    { value: 'insurance_required', score: 50, description: 'private insurance mandated' },
    { value: 'emergency_only', score: 25, description: 'emergency cover only' },
    { value: 'no_access', score: 0, description: 'excluded from public healthcare' },
  ],
};

describe('isCategoricalRubric', () => {
  it('accepts the wrapped { categories: [{ value }] } shape', () => {
    expect(isCategoricalRubric(C31_RUBRIC)).toBe(true);
  });

  it('rejects null', () => {
    expect(isCategoricalRubric(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isCategoricalRubric(undefined)).toBe(false);
  });

  it('rejects an array', () => {
    expect(isCategoricalRubric([{ value: 'x' }])).toBe(false);
  });

  it('rejects a flat record (legacy shape, not used at publish-time)', () => {
    expect(isCategoricalRubric({ full_access: 100, no_access: 0 })).toBe(false);
  });

  it('rejects an object whose categories key is not an array', () => {
    expect(isCategoricalRubric({ categories: 'oops' })).toBe(false);
  });
});

describe('rubricValues', () => {
  it('extracts every value', () => {
    expect(rubricValues(C31_RUBRIC)).toEqual([
      'full_access',
      'levy_required',
      'insurance_required',
      'emergency_only',
      'no_access',
    ]);
  });

  it('skips entries without a string value', () => {
    const r = {
      categories: [
        { value: 'a', score: 1 },
        { value: 42 as unknown as string, score: 2 },
        { value: 'b', score: 3 },
      ],
    };
    expect(rubricValues(r)).toEqual(['a', 'b']);
  });
});

describe('rubricIncludesValue (the gate predicate)', () => {
  it('returns true for an in-rubric value', () => {
    expect(rubricIncludesValue(C31_RUBRIC, 'full_access')).toBe(true);
    expect(rubricIncludesValue(C31_RUBRIC, 'no_access')).toBe(true);
  });

  it('returns false for a sentinel that should force pending_review (the C.3.1 leak)', () => {
    expect(rubricIncludesValue(C31_RUBRIC, 'not_stated')).toBe(false);
    expect(rubricIncludesValue(C31_RUBRIC, 'not_addressed')).toBe(false);
    expect(rubricIncludesValue(C31_RUBRIC, 'not_found')).toBe(false);
  });

  it('is case-sensitive (the LLM contract is exact-match)', () => {
    expect(rubricIncludesValue(C31_RUBRIC, 'Full_Access')).toBe(false);
    expect(rubricIncludesValue(C31_RUBRIC, 'full_access')).toBe(true);
  });

  it('treats whitespace as a mismatch (publish.ts trims upstream)', () => {
    expect(rubricIncludesValue(C31_RUBRIC, ' full_access')).toBe(false);
    expect(rubricIncludesValue(C31_RUBRIC, 'full_access ')).toBe(false);
  });
});
