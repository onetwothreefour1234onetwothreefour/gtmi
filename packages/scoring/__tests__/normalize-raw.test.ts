import { describe, expect, it } from 'vitest';
import { normalizeRawValue } from '../src/normalize-raw.ts';
import { ScoringError } from '../src/types.ts';

const minMaxDef = { normalizationFn: 'min_max', scoringRubricJsonb: null };
const zScoreDef = { normalizationFn: 'z_score', scoringRubricJsonb: null };
const boolDef = { normalizationFn: 'boolean', scoringRubricJsonb: null };

const rubric = { english_required: 100, english_preferred: 60, not_required: 0 };
const catDef = { normalizationFn: 'categorical', scoringRubricJsonb: rubric };

describe('normalizeRawValue — numeric (min_max)', () => {
  it('parses a plain integer string', () => {
    expect(normalizeRawValue('75000', minMaxDef)).toBe(75000);
  });
  it('strips dollar sign and comma', () => {
    expect(normalizeRawValue('$75,000', minMaxDef)).toBe(75000);
  });
  it('strips thousands commas', () => {
    expect(normalizeRawValue('1,500,000', minMaxDef)).toBe(1500000);
  });
  it('strips percentage sign', () => {
    expect(normalizeRawValue('45%', minMaxDef)).toBe(45);
  });
  it('handles decimal values', () => {
    expect(normalizeRawValue('1.75', minMaxDef)).toBe(1.75);
  });
  it('strips mixed symbols', () => {
    expect(normalizeRawValue('$1,200.50', minMaxDef)).toBe(1200.5);
  });
  it('throws ScoringError on non-numeric string', () => {
    expect(() => normalizeRawValue('not a number', minMaxDef)).toThrow(ScoringError);
  });
  it('throws ScoringError on empty string', () => {
    expect(() => normalizeRawValue('', minMaxDef)).toThrow(ScoringError);
  });
});

describe('normalizeRawValue — numeric (z_score)', () => {
  it('parses the same way as min_max', () => {
    expect(normalizeRawValue('$1,200.50', zScoreDef)).toBe(1200.5);
  });
  it('throws on non-numeric', () => {
    expect(() => normalizeRawValue('n/a', zScoreDef)).toThrow(ScoringError);
  });
});

describe('normalizeRawValue — categorical', () => {
  it('returns trimmed string for valid rubric key', () => {
    expect(normalizeRawValue('english_required', catDef)).toBe('english_required');
  });
  it('trims surrounding whitespace', () => {
    expect(normalizeRawValue('  english_preferred  ', catDef)).toBe('english_preferred');
  });
  it('returns zero-score key correctly', () => {
    expect(normalizeRawValue('not_required', catDef)).toBe('not_required');
  });
  it('throws ScoringError for key not in rubric', () => {
    expect(() => normalizeRawValue('some_unknown_value', catDef)).toThrow(ScoringError);
  });
  it('throws ScoringError when scoringRubricJsonb is null', () => {
    const noRubric = { normalizationFn: 'categorical', scoringRubricJsonb: null };
    expect(() => normalizeRawValue('english_required', noRubric)).toThrow(ScoringError);
  });
  it('throws ScoringError when scoringRubricJsonb is not an object', () => {
    const badRubric = { normalizationFn: 'categorical', scoringRubricJsonb: 'oops' };
    expect(() => normalizeRawValue('english_required', badRubric)).toThrow(ScoringError);
  });
});

describe('normalizeRawValue — boolean', () => {
  it('yes → true', () => expect(normalizeRawValue('yes', boolDef)).toBe(true));
  it('no → false', () => expect(normalizeRawValue('no', boolDef)).toBe(false));
  it('true → true', () => expect(normalizeRawValue('true', boolDef)).toBe(true));
  it('false → false', () => expect(normalizeRawValue('false', boolDef)).toBe(false));
  it('1 → true', () => expect(normalizeRawValue('1', boolDef)).toBe(true));
  it('0 → false', () => expect(normalizeRawValue('0', boolDef)).toBe(false));
  it('case-insensitive YES → true', () => expect(normalizeRawValue('YES', boolDef)).toBe(true));
  it('trims whitespace before parsing', () => {
    expect(normalizeRawValue('  yes  ', boolDef)).toBe(true);
  });
  it('throws ScoringError for unrecognised value', () => {
    expect(() => normalizeRawValue('maybe', boolDef)).toThrow(ScoringError);
  });
});

describe('normalizeRawValue — unknown normalizationFn', () => {
  it('throws ScoringError', () => {
    const badDef = { normalizationFn: 'not_a_fn', scoringRubricJsonb: null };
    expect(() => normalizeRawValue('any', badDef)).toThrow(ScoringError);
  });
});
