import { describe, expect, it } from 'vitest';
import {
  COUNTRY_REGIONS,
  REGIONAL_SUBSTITUTES,
  getRegionalSubstitute,
  normalizeBooleanWithAnnotation,
  parseIndicatorValue,
} from '../src/normalize';
import { ScoringError } from '../src/types';

// Phase 3.5 / ADR-014 — normalizer tests for boolean_with_annotation
// and country_substitute_regional.

describe('Phase 3.5 — normalizeBooleanWithAnnotation', () => {
  // B.2.3 / B.2.4 / D.1.3 / D.1.4 all use direction='lower_is_better'
  // (presence of levy / cost / requirement is a penalty), so true → 0
  // and false → 100.

  it('B.2.3 hasLevy=true → 0 (lower_is_better)', () => {
    const score = normalizeBooleanWithAnnotation(
      { hasLevy: true, notes: 'SAF AUD 1,800/yr small employer' },
      'B.2.3',
      'lower_is_better'
    );
    expect(score).toBe(0);
  });

  it('B.2.3 hasLevy=false → 100 (lower_is_better; no levy is best case)', () => {
    const score = normalizeBooleanWithAnnotation(
      { hasLevy: false, notes: 'no employer sponsorship requirement' },
      'B.2.3',
      'lower_is_better'
    );
    expect(score).toBe(100);
  });

  it('B.2.4 hasMandatoryNonGovCosts=true → 0', () => {
    expect(
      normalizeBooleanWithAnnotation(
        { hasMandatoryNonGovCosts: true, notes: 'medical exam, police certificate' },
        'B.2.4',
        'lower_is_better'
      )
    ).toBe(0);
  });

  it('B.2.4 hasMandatoryNonGovCosts=false → 100', () => {
    expect(
      normalizeBooleanWithAnnotation(
        { hasMandatoryNonGovCosts: false, notes: null },
        'B.2.4',
        'lower_is_better'
      )
    ).toBe(100);
  });

  it('D.1.3 required=true (with daysPerYear) → 0', () => {
    expect(
      normalizeBooleanWithAnnotation(
        { required: true, daysPerYear: 219, notes: '1,095 days in 5 years' },
        'D.1.3',
        'lower_is_better'
      )
    ).toBe(0);
  });

  it('D.1.3 required=false → 100', () => {
    expect(
      normalizeBooleanWithAnnotation(
        { required: false, daysPerYear: null, notes: null },
        'D.1.3',
        'lower_is_better'
      )
    ).toBe(100);
  });

  it('D.1.4 required=true → 0', () => {
    expect(
      normalizeBooleanWithAnnotation(
        { required: true, daysPerYear: 146, notes: '730 days in 5 years (rolling)' },
        'D.1.4',
        'lower_is_better'
      )
    ).toBe(0);
  });

  it('D.1.4 required=false → 100', () => {
    expect(
      normalizeBooleanWithAnnotation(
        { required: false, daysPerYear: null, notes: 'PR not available from this track' },
        'D.1.4',
        'lower_is_better'
      )
    ).toBe(100);
  });

  it('respects higher_is_better direction (sanity check)', () => {
    expect(
      normalizeBooleanWithAnnotation({ hasLevy: true, notes: null }, 'B.2.3', 'higher_is_better')
    ).toBe(100);
    expect(
      normalizeBooleanWithAnnotation({ hasLevy: false, notes: null }, 'B.2.3', 'higher_is_better')
    ).toBe(0);
  });

  it('throws when fieldKey is not registered', () => {
    expect(() =>
      normalizeBooleanWithAnnotation({ value: true }, 'X.0.0', 'lower_is_better')
    ).toThrow(ScoringError);
  });

  it('throws when the registered boolean key is missing from the parsed object', () => {
    expect(() =>
      normalizeBooleanWithAnnotation({ notes: 'orphan' }, 'B.2.3', 'lower_is_better')
    ).toThrow(/expects "hasLevy: boolean"/);
  });

  it('throws when the registered boolean key is non-boolean', () => {
    expect(() =>
      normalizeBooleanWithAnnotation({ hasLevy: 'yes', notes: null }, 'B.2.3', 'lower_is_better')
    ).toThrow(/expects "hasLevy: boolean"/);
  });
});

describe('Phase 3.5 — getRegionalSubstitute (C.3.2)', () => {
  it('AUS / CAN / GBR / SGP / HKG → automatic, score 100', () => {
    for (const iso of ['AUS', 'CAN', 'GBR', 'SGP', 'HKG']) {
      const sub = getRegionalSubstitute(iso, 'C.3.2');
      expect(sub.region).toBe('OECD_HIGH_INCOME');
      expect(sub.value).toBe('automatic');
      expect(sub.score).toBe(100);
    }
  });

  it('GCC countries → fee_paying, score 40', () => {
    for (const iso of ['UAE', 'ARE', 'SAU', 'BHR', 'QAT', 'KWT', 'OMN']) {
      const sub = getRegionalSubstitute(iso, 'C.3.2');
      expect(sub.region).toBe('GCC');
      expect(sub.value).toBe('fee_paying');
      expect(sub.score).toBe(40);
    }
  });

  it('unknown country → null, region OTHER (missing data penalty applies)', () => {
    const sub = getRegionalSubstitute('XYZ', 'C.3.2');
    expect(sub.region).toBe('OTHER');
    expect(sub.value).toBeNull();
    expect(sub.score).toBeNull();
  });

  it('unknown field → null, region resolved (no map for that field)', () => {
    const sub = getRegionalSubstitute('AUS', 'X.0.0');
    expect(sub.region).toBe('OECD_HIGH_INCOME');
    expect(sub.value).toBeNull();
    expect(sub.score).toBeNull();
  });

  it('COUNTRY_REGIONS has entries for every 5-pilot ISO3', () => {
    for (const iso of ['AUS', 'CAN', 'GBR', 'SGP', 'HKG']) {
      expect(COUNTRY_REGIONS[iso]).toBe('OECD_HIGH_INCOME');
    }
  });

  it('REGIONAL_SUBSTITUTES["C.3.2"] has both regions defined and OTHER omitted', () => {
    const c32 = REGIONAL_SUBSTITUTES['C.3.2'];
    expect(c32?.OECD_HIGH_INCOME).toEqual({ value: 'automatic', score: 100 });
    expect(c32?.GCC).toEqual({ value: 'fee_paying', score: 40 });
    expect(c32?.OTHER).toBeUndefined();
  });
});

describe('Phase 3.5 — parseIndicatorValue type-narrowing', () => {
  it('boolean_with_annotation accepts a JSON object', () => {
    const v = parseIndicatorValue({ hasLevy: true, notes: 'x' }, 'boolean_with_annotation');
    expect(v).toEqual({ hasLevy: true, notes: 'x' });
  });

  it('boolean_with_annotation rejects non-objects', () => {
    expect(() => parseIndicatorValue(42, 'boolean_with_annotation')).toThrow(ScoringError);
    expect(() => parseIndicatorValue('hi', 'boolean_with_annotation')).toThrow(ScoringError);
    expect(() => parseIndicatorValue(null, 'boolean_with_annotation')).toThrow(ScoringError);
    expect(() => parseIndicatorValue([1, 2], 'boolean_with_annotation')).toThrow(ScoringError);
  });

  it('country_substitute_regional accepts a string and rejects others', () => {
    expect(parseIndicatorValue('automatic', 'country_substitute_regional')).toBe('automatic');
    expect(() => parseIndicatorValue(true, 'country_substitute_regional')).toThrow(ScoringError);
    expect(() => parseIndicatorValue(42, 'country_substitute_regional')).toThrow(ScoringError);
  });

  // Phase 3.8 / shape-mismatch fix — `executeCountrySubstitute` writes
  // value_normalized as `{substituted, value, region}` (an OBJECT). The
  // engine path historically expected a bare string; we now extract the
  // `.value` field from the object so cohort scoring can read C.3.2 rows
  // without throwing.
  describe('country_substitute_regional accepts the substituted-object shape', () => {
    it('extracts `.value` from the {substituted, value, region} write shape', () => {
      const obj = { substituted: true, value: 'automatic', region: 'OECD_HIGH_INCOME' };
      expect(parseIndicatorValue(obj, 'country_substitute_regional')).toBe('automatic');
    });

    it('extracts `.value` even when other keys are missing', () => {
      const obj = { value: 'fee_paying' };
      expect(parseIndicatorValue(obj, 'country_substitute_regional')).toBe('fee_paying');
    });

    it('still throws when the object has no string `.value` field', () => {
      expect(() => parseIndicatorValue({}, 'country_substitute_regional')).toThrow(ScoringError);
      expect(() => parseIndicatorValue({ value: 42 }, 'country_substitute_regional')).toThrow(
        ScoringError
      );
      expect(() => parseIndicatorValue({ value: null }, 'country_substitute_regional')).toThrow(
        ScoringError
      );
    });

    it('arrays are still rejected (sentinel guard)', () => {
      expect(() => parseIndicatorValue([], 'country_substitute_regional')).toThrow(ScoringError);
      expect(() =>
        parseIndicatorValue([{ value: 'automatic' }], 'country_substitute_regional')
      ).toThrow(ScoringError);
    });

    it('the legacy "categorical" branch is unchanged — still string-only', () => {
      expect(parseIndicatorValue('full_access', 'categorical')).toBe('full_access');
      expect(() => parseIndicatorValue({ value: 'full_access' }, 'categorical')).toThrow(
        ScoringError
      );
    });
  });
});
