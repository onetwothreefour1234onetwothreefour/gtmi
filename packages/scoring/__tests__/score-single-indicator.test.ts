import { describe, expect, it } from 'vitest';
import { scoreSingleIndicator } from '../src/engine';
import { NO_LIMIT_MARKER } from '../src/sentinels';
import type { FieldDefinitionRecord, NormalizationParams } from '../src/types';
import { ScoringError } from '../src/types';

// Phase 3.7 / ADR-019 — exposed scoring helper. Pure: no DB, no I/O.
// These tests cover one branch per `normalizationFn` plus the two
// sentinel markers (no-limit + not-applicable).

const NO_PARAMS: NormalizationParams = {};

const PARAMS_WITH_BOUNDS: NormalizationParams = {
  'A.2.2': { min: 0, max: 10 },
  'B.2.1': { mean: 1000, stddev: 250 },
};

function defOf(
  partial: Partial<FieldDefinitionRecord> & Pick<FieldDefinitionRecord, 'key' | 'normalizationFn'>
): FieldDefinitionRecord {
  const { key, normalizationFn, ...rest } = partial;
  return {
    id: 'def-' + key,
    key,
    label: key,
    pillar: key.charAt(0),
    subFactor: key.slice(0, 3),
    weightWithinSubFactor: 0.25,
    direction: 'higher_is_better',
    normalizationFn,
    scoringRubricJsonb: null,
    ...rest,
  } as FieldDefinitionRecord;
}

describe('scoreSingleIndicator — null / sentinel guards', () => {
  it('returns null when valueNormalized is null', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({ key: 'A.2.2', normalizationFn: 'min_max' }),
      valueNormalized: null,
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    expect(r).toBeNull();
  });

  it('returns null when valueNormalized is undefined', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({ key: 'A.2.2', normalizationFn: 'min_max' }),
      valueNormalized: undefined,
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    expect(r).toBeNull();
  });

  it('returns null on the notApplicable marker (FIX 1 honoured)', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({ key: 'A.1.2', normalizationFn: 'min_max' }),
      valueNormalized: { notApplicable: true, reason: 'Points-based programme' },
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    expect(r).toBeNull();
  });
});

describe('scoreSingleIndicator — min_max', () => {
  it('returns 100 for the no-limit marker on higher_is_better', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'A.3.3',
        normalizationFn: 'min_max',
        direction: 'higher_is_better',
      }),
      valueNormalized: NO_LIMIT_MARKER,
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    expect(r).toBe(100);
  });

  it('returns 0 for the no-limit marker on lower_is_better', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'B.1.1',
        normalizationFn: 'min_max',
        direction: 'lower_is_better',
      }),
      valueNormalized: NO_LIMIT_MARKER,
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    expect(r).toBe(0);
  });

  it('returns the min_max-normalised score for a numeric value', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'A.2.2',
        normalizationFn: 'min_max',
        direction: 'lower_is_better',
      }),
      valueNormalized: 2,
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    // bounds 0..10, lower-is-better: 2 → (10 - 2) / 10 * 100 = 80
    expect(r).toBeCloseTo(80, 5);
  });
});

describe('scoreSingleIndicator — z_score', () => {
  it('uses the cohort mean / stdev', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'B.2.1',
        normalizationFn: 'z_score',
        direction: 'lower_is_better',
      }),
      valueNormalized: 1000,
      normalizationParams: PARAMS_WITH_BOUNDS,
    });
    // z = 0; lower-is-better → 50
    expect(r).toBeCloseTo(50, 5);
  });
});

describe('scoreSingleIndicator — categorical', () => {
  it('looks up the rubric score for the matching value', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'C.1.1',
        normalizationFn: 'categorical',
        scoringRubricJsonb: {
          categories: [
            { value: 'not_required', score: 100, description: '' },
            { value: 'required_if_under_threshold', score: 60, description: '' },
            { value: 'required_throughout', score: 30, description: '' },
          ],
        },
      }),
      valueNormalized: 'not_required',
      normalizationParams: NO_PARAMS,
    });
    expect(r).toBe(100);
  });

  it('throws when the rubric is missing', () => {
    expect(() =>
      scoreSingleIndicator({
        fieldDefinition: defOf({
          key: 'C.1.1',
          normalizationFn: 'categorical',
          scoringRubricJsonb: null,
        }),
        valueNormalized: 'whatever',
        normalizationParams: NO_PARAMS,
      })
    ).toThrow(ScoringError);
  });
});

describe('scoreSingleIndicator — country_substitute_regional', () => {
  // Phase 3.8 — substitute scoring uses REGIONAL_SUBSTITUTES (region →
  // score), NOT the field rubric. The substitute vocabulary diverges
  // from the rubric vocabulary by design (ADR-014). C.3.2 is the only
  // such field today; OECD_HIGH_INCOME → 100, GCC → 40.
  it('scores the {substituted, value, region} object via REGIONAL_SUBSTITUTES (OECD)', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'C.3.2',
        normalizationFn: 'country_substitute_regional',
        // Note the rubric below uses the FIELD vocabulary (full_access,
        // fee_based) — the substitute path bypasses it entirely.
        scoringRubricJsonb: {
          categories: [
            { value: 'full_access', score: 100, description: '' },
            { value: 'fee_based', score: 60, description: '' },
            { value: 'limited', score: 30, description: '' },
            { value: 'no_access', score: 0, description: '' },
          ],
        },
      }),
      valueNormalized: { substituted: true, value: 'automatic', region: 'OECD_HIGH_INCOME' },
      normalizationParams: NO_PARAMS,
    });
    expect(r).toBe(100);
  });

  it('scores the {substituted, value, region} object via REGIONAL_SUBSTITUTES (GCC)', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'C.3.2',
        normalizationFn: 'country_substitute_regional',
        scoringRubricJsonb: { categories: [{ value: 'full_access', score: 100, description: '' }] },
      }),
      valueNormalized: { substituted: true, value: 'fee_paying', region: 'GCC' },
      normalizationParams: NO_PARAMS,
    });
    expect(r).toBe(40);
  });

  it('reverse-looks-up the substitute map when given a bare string in the substitute vocabulary', () => {
    // Legacy fallback: parseIndicatorValue extracts `.value` in some
    // older code paths, leaving the engine with the bare string.
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'C.3.2',
        normalizationFn: 'country_substitute_regional',
        scoringRubricJsonb: { categories: [{ value: 'full_access', score: 100, description: '' }] },
      }),
      valueNormalized: 'automatic',
      normalizationParams: NO_PARAMS,
    });
    expect(r).toBe(100);
  });

  it('throws when the field has no entry in REGIONAL_SUBSTITUTES', () => {
    expect(() =>
      scoreSingleIndicator({
        fieldDefinition: defOf({
          key: 'X.0.0',
          normalizationFn: 'country_substitute_regional',
          scoringRubricJsonb: null,
        }),
        valueNormalized: { substituted: true, value: 'automatic', region: 'OECD_HIGH_INCOME' },
        normalizationParams: NO_PARAMS,
      })
    ).toThrow(/no entry in REGIONAL_SUBSTITUTES/);
  });

  it('throws when the row carries a region not registered for the field (e.g. OTHER for C.3.2)', () => {
    expect(() =>
      scoreSingleIndicator({
        fieldDefinition: defOf({
          key: 'C.3.2',
          normalizationFn: 'country_substitute_regional',
          scoringRubricJsonb: null,
        }),
        valueNormalized: { substituted: true, value: 'something', region: 'OTHER' },
        normalizationParams: NO_PARAMS,
      })
    ).toThrow(/region "OTHER"/);
  });

  it('throws when the bare-string value is not in any substitute entry for the field', () => {
    expect(() =>
      scoreSingleIndicator({
        fieldDefinition: defOf({
          key: 'C.3.2',
          normalizationFn: 'country_substitute_regional',
          scoringRubricJsonb: null,
        }),
        valueNormalized: 'full_access', // rubric vocabulary, not substitute vocabulary
        normalizationParams: NO_PARAMS,
      })
    ).toThrow(/no matching region in REGIONAL_SUBSTITUTES/);
  });
});

describe('scoreSingleIndicator — boolean', () => {
  it('returns 100 for true on higher_is_better', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'D.1.1',
        normalizationFn: 'boolean',
        direction: 'higher_is_better',
      }),
      valueNormalized: true,
      normalizationParams: NO_PARAMS,
    });
    expect(r).toBe(100);
  });

  it('returns 0 for true on lower_is_better', () => {
    const r = scoreSingleIndicator({
      fieldDefinition: defOf({
        key: 'C.1.4',
        normalizationFn: 'boolean',
        direction: 'lower_is_better',
      }),
      valueNormalized: true,
      normalizationParams: NO_PARAMS,
    });
    expect(r).toBe(0);
  });
});
