// Methodology v6.0.0 / ADR-032 — numeric_or_categorical normFn tests.
//
// Covers:
//   1. parseIndicatorValue narrows JSONB to number | string.
//   2. normalizeNumericOrCategorical dispatches:
//        - string form → rubric lookup (categorical bucket)
//        - numeric form → piecewise rubric-anchored interpolation
//   3. normalizeRawValue parses LLM string output:
//        - "23450" → 23450 (numeric form)
//        - "medium" → "medium" (categorical fallback)
//   4. Bucket boundaries are continuous between numeric and categorical.

import { describe, expect, it } from 'vitest';
import { normalizeNumericOrCategorical, parseIndicatorValue } from '../src/normalize';
import { normalizeRawValue } from '../src/normalize-raw';
import { ScoringError } from '../src/types';

const E12_RUBRIC = {
  categories: [
    { value: 'large', score: 100, description: '>50k' },
    { value: 'medium', score: 75, description: '10k–50k' },
    { value: 'small', score: 50, description: '1k–10k' },
    { value: 'marginal', score: 25, description: '<1k' },
    { value: 'no_data', score: 0, description: 'no figure published' },
  ],
};

describe('parseIndicatorValue — numeric_or_categorical', () => {
  it('accepts a JSON number', () => {
    expect(parseIndicatorValue(42, 'numeric_or_categorical')).toBe(42);
  });

  it('accepts a JSON string', () => {
    expect(parseIndicatorValue('medium', 'numeric_or_categorical')).toBe('medium');
  });

  it('rejects a JSON boolean', () => {
    expect(() => parseIndicatorValue(true, 'numeric_or_categorical')).toThrow(ScoringError);
  });

  it('rejects null', () => {
    expect(() => parseIndicatorValue(null, 'numeric_or_categorical')).toThrow(ScoringError);
  });
});

describe('normalizeNumericOrCategorical — string form (rubric lookup)', () => {
  it('large → 100', () => {
    expect(normalizeNumericOrCategorical('large', 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(
      100
    );
  });

  it('no_data → 0', () => {
    expect(normalizeNumericOrCategorical('no_data', 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(
      0
    );
  });

  it('throws when the bucket label is not in the rubric', () => {
    expect(() =>
      normalizeNumericOrCategorical('huge', 'E.1.2', E12_RUBRIC, 'higher_is_better')
    ).toThrow(ScoringError);
  });
});

describe('normalizeNumericOrCategorical — numeric form (piecewise interpolation)', () => {
  it('0 → 0', () => {
    expect(normalizeNumericOrCategorical(0, 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(0);
  });

  it('100 → 25 (marginal lower)', () => {
    expect(normalizeNumericOrCategorical(100, 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(25);
  });

  it('1000 → 50 (small lower)', () => {
    expect(normalizeNumericOrCategorical(1000, 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(50);
  });

  it('10000 → 75 (medium lower)', () => {
    expect(normalizeNumericOrCategorical(10000, 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(75);
  });

  it('50000 → 100 (large lower / ceiling)', () => {
    expect(normalizeNumericOrCategorical(50000, 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(100);
  });

  it('250000 → 100 (above ceiling clamps)', () => {
    expect(normalizeNumericOrCategorical(250000, 'E.1.2', E12_RUBRIC, 'higher_is_better')).toBe(
      100
    );
  });

  it('5000 (mid-bucket) interpolates between 50 and 75', () => {
    // small bucket: 1000..10000 maps 50..75 linearly
    // 5000: frac = (5000-1000)/(10000-1000) = 4000/9000 ≈ 0.444
    // raw = 50 + 0.444 * 25 ≈ 61.11
    const score = normalizeNumericOrCategorical(5000, 'E.1.2', E12_RUBRIC, 'higher_is_better');
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(75);
  });

  it('boundary continuity: numeric 50000 matches categorical large', () => {
    const numeric = normalizeNumericOrCategorical(50000, 'E.1.2', E12_RUBRIC, 'higher_is_better');
    const categorical = normalizeNumericOrCategorical(
      'large',
      'E.1.2',
      E12_RUBRIC,
      'higher_is_better'
    );
    expect(numeric).toBe(categorical);
  });

  it('boundary continuity: numeric 10000 matches categorical medium', () => {
    const numeric = normalizeNumericOrCategorical(10000, 'E.1.2', E12_RUBRIC, 'higher_is_better');
    const categorical = normalizeNumericOrCategorical(
      'medium',
      'E.1.2',
      E12_RUBRIC,
      'higher_is_better'
    );
    expect(numeric).toBe(categorical);
  });

  it('throws when the field has no bucket configuration', () => {
    expect(() =>
      normalizeNumericOrCategorical(5000, 'UNKNOWN.0.0', E12_RUBRIC, 'higher_is_better')
    ).toThrow(ScoringError);
  });
});

describe('normalizeRawValue — numeric_or_categorical LLM-string parsing', () => {
  it('parses "23450" as a number', () => {
    const out = normalizeRawValue('23450', {
      normalizationFn: 'numeric_or_categorical',
      scoringRubricJsonb: E12_RUBRIC,
    });
    expect(out).toBe(23450);
  });

  it('strips $, commas, %, whitespace before numeric parse', () => {
    const out = normalizeRawValue('$ 23,450', {
      normalizationFn: 'numeric_or_categorical',
      scoringRubricJsonb: E12_RUBRIC,
    });
    expect(out).toBe(23450);
  });

  it('parses "medium" as the categorical bucket string', () => {
    const out = normalizeRawValue('medium', {
      normalizationFn: 'numeric_or_categorical',
      scoringRubricJsonb: E12_RUBRIC,
    });
    expect(out).toBe('medium');
  });

  it('parses "no_data" as the no-data bucket', () => {
    const out = normalizeRawValue('no_data', {
      normalizationFn: 'numeric_or_categorical',
      scoringRubricJsonb: E12_RUBRIC,
    });
    expect(out).toBe('no_data');
  });

  it('throws when the LLM returns a string that is neither numeric nor a rubric key', () => {
    expect(() =>
      normalizeRawValue('huge', {
        normalizationFn: 'numeric_or_categorical',
        scoringRubricJsonb: E12_RUBRIC,
      })
    ).toThrow(ScoringError);
  });
});
