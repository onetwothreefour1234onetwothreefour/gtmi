import { describe, expect, it } from 'vitest';
import {
  normalizeBoolean,
  normalizeCategorical,
  normalizeMinMax,
  normalizeZScore,
  parseIndicatorValue,
} from '../src/normalize';
import {
  CME_WEIGHT,
  INSUFFICIENT_DISCLOSURE_THRESHOLD,
  PAQ_WEIGHT,
  PILLAR_WEIGHTS,
  SUB_FACTOR_WEIGHTS,
  aggregateWeightedMean,
  applyMissingDataPenalty,
  computeDataCoverage,
  reNormalizeWeights,
} from '../src/score';
import { runScoringEngine } from '../src/engine';
import { ScoringError, ScoringInput } from '../src/types';

// ---------------------------------------------------------------------------
// Weight integrity
// ---------------------------------------------------------------------------

describe('weight integrity', () => {
  const TOLERANCE = 1e-10;

  it('pillar weights sum to 1.0', () => {
    const sum = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(TOLERANCE);
  });

  it('each pillar sub-factor weights sum to 1.0', () => {
    for (const [pillar, weights] of Object.entries(SUB_FACTOR_WEIGHTS)) {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(TOLERANCE);
      // Label the assertion for clarity
      expect({ pillar, sum }).toMatchObject({ pillar, sum: expect.closeTo(1.0, 10) });
    }
  });

  it('CME + PAQ weights sum to 1.0', () => {
    expect(Math.abs(CME_WEIGHT + PAQ_WEIGHT - 1.0)).toBeLessThan(TOLERANCE);
  });

  it('indicator weights per sub-factor from METHODOLOGY sum to 1.0', () => {
    // Hard-coded per METHODOLOGY.md — these are the definitive weight checks.
    const indicators: Record<string, number[]> = {
      'A.1': [0.5, 0.3, 0.2],
      'A.2': [0.35, 0.35, 0.3],
      'A.3': [0.4, 0.35, 0.25],
      'B.1': [0.5, 0.3, 0.2],
      'B.2': [0.4, 0.25, 0.2, 0.15],
      'B.3': [0.4, 0.35, 0.25],
      'C.1': [0.3, 0.3, 0.25, 0.15],
      'C.2': [0.4, 0.25, 0.2, 0.15],
      'C.3': [0.5, 0.5],
      'D.1': [0.3, 0.3, 0.2, 0.2],
      'D.2': [0.3, 0.3, 0.2, 0.2],
      'D.3': [0.36, 0.44, 0.2],
      'E.1': [0.5, 0.3, 0.2],
      'E.2': [0.4, 0.3, 0.3],
      'E.3': [0.5, 0.5],
    };
    for (const [sf, weights] of Object.entries(indicators)) {
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(TOLERANCE);
      expect({ subFactor: sf, sum }).toMatchObject({ subFactor: sf, sum: expect.closeTo(1.0, 10) });
    }
  });
});

// ---------------------------------------------------------------------------
// parseIndicatorValue
// ---------------------------------------------------------------------------

describe('parseIndicatorValue', () => {
  it('accepts number for min_max', () => {
    expect(parseIndicatorValue(42.5, 'min_max')).toBe(42.5);
  });

  it('accepts number for z_score', () => {
    expect(parseIndicatorValue(0, 'z_score')).toBe(0);
  });

  it('rejects string for min_max', () => {
    expect(() => parseIndicatorValue('42', 'min_max')).toThrow(ScoringError);
  });

  it('accepts string for categorical', () => {
    expect(parseIndicatorValue('degree', 'categorical')).toBe('degree');
  });

  it('rejects number for categorical', () => {
    expect(() => parseIndicatorValue(1, 'categorical')).toThrow(ScoringError);
  });

  it('accepts boolean for boolean', () => {
    expect(parseIndicatorValue(true, 'boolean')).toBe(true);
  });

  it('rejects number for boolean', () => {
    expect(() => parseIndicatorValue(1, 'boolean')).toThrow(ScoringError);
  });

  it('rejects boolean for categorical', () => {
    expect(() => parseIndicatorValue(true, 'categorical')).toThrow(ScoringError);
  });
});

// ---------------------------------------------------------------------------
// normalizeMinMax
// ---------------------------------------------------------------------------

describe('normalizeMinMax', () => {
  const params = { min: 0, max: 100 };

  it('midpoint higher_is_better', () => {
    expect(normalizeMinMax(60, params, 'higher_is_better')).toBe(60);
  });

  it('midpoint lower_is_better', () => {
    expect(normalizeMinMax(60, params, 'lower_is_better')).toBe(40);
  });

  it('minimum value → 0 for higher_is_better', () => {
    expect(normalizeMinMax(0, params, 'higher_is_better')).toBe(0);
  });

  it('maximum value → 100 for higher_is_better', () => {
    expect(normalizeMinMax(100, params, 'higher_is_better')).toBe(100);
  });

  it('clamps above max to 100', () => {
    expect(normalizeMinMax(150, params, 'higher_is_better')).toBe(100);
  });

  it('clamps below min to 0', () => {
    expect(normalizeMinMax(-10, params, 'higher_is_better')).toBe(0);
  });

  it('throws when min === max', () => {
    expect(() => normalizeMinMax(50, { min: 50, max: 50 }, 'higher_is_better')).toThrow(
      ScoringError
    );
  });

  it('throws when min is missing', () => {
    expect(() => normalizeMinMax(50, { max: 100 }, 'higher_is_better')).toThrow(ScoringError);
  });

  it('throws when max is missing', () => {
    expect(() => normalizeMinMax(50, { min: 0 }, 'higher_is_better')).toThrow(ScoringError);
  });

  it('non-symmetric range lower_is_better', () => {
    // value=30, min=10, max=110 → raw=(110-30)/(110-10)=80/100=0.80 → 80
    const result = normalizeMinMax(30, { min: 10, max: 110 }, 'lower_is_better');
    expect(result).toBeCloseTo(80, 10);
  });
});

// ---------------------------------------------------------------------------
// normalizeZScore
// ---------------------------------------------------------------------------

describe('normalizeZScore', () => {
  it('z=0 → 50 (median of standard normal)', () => {
    const result = normalizeZScore(5, { mean: 5, stddev: 1 }, 'higher_is_better');
    expect(result).toBeCloseTo(50, 3);
  });

  it('z=1.96 higher_is_better → ~97.5', () => {
    const result = normalizeZScore(6.96, { mean: 5, stddev: 1 }, 'higher_is_better');
    expect(result).toBeCloseTo(97.5, 0);
  });

  it('z=1.96 lower_is_better → ~2.5 (inverted)', () => {
    const result = normalizeZScore(6.96, { mean: 5, stddev: 1 }, 'lower_is_better');
    expect(result).toBeCloseTo(2.5, 0);
  });

  it('throws when stddev === 0', () => {
    expect(() => normalizeZScore(5, { mean: 5, stddev: 0 }, 'higher_is_better')).toThrow(
      ScoringError
    );
  });

  it('throws when mean is missing', () => {
    expect(() => normalizeZScore(5, { stddev: 1 }, 'higher_is_better')).toThrow(ScoringError);
  });

  it('throws when stddev is missing', () => {
    expect(() => normalizeZScore(5, { mean: 5 }, 'higher_is_better')).toThrow(ScoringError);
  });

  it('result is clamped to [0, 100]', () => {
    // Extreme z → should be 100 not >100
    const result = normalizeZScore(1000, { mean: 5, stddev: 1 }, 'higher_is_better');
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeCategorical
// ---------------------------------------------------------------------------

describe('normalizeCategorical', () => {
  const rubric = { bachelor: 60, master: 80, phd: 100, none: 20 };

  it('returns correct score for known value', () => {
    expect(normalizeCategorical('master', rubric)).toBe(80);
  });

  it('returns 0 score when rubric score is 0', () => {
    const r = { low: 0, high: 100 };
    expect(normalizeCategorical('low', r)).toBe(0);
  });

  it('throws ScoringError for unknown value', () => {
    expect(() => normalizeCategorical('diploma', rubric)).toThrow(ScoringError);
  });

  it('throw message names the invalid value', () => {
    expect(() => normalizeCategorical('diploma', rubric)).toThrow('diploma');
  });
});

// ---------------------------------------------------------------------------
// normalizeBoolean
// ---------------------------------------------------------------------------

describe('normalizeBoolean', () => {
  it('true + higher_is_better → 100', () => {
    expect(normalizeBoolean(true, 'higher_is_better')).toBe(100);
  });

  it('false + higher_is_better → 0', () => {
    expect(normalizeBoolean(false, 'higher_is_better')).toBe(0);
  });

  it('true + lower_is_better → 0', () => {
    expect(normalizeBoolean(true, 'lower_is_better')).toBe(0);
  });

  it('false + lower_is_better → 100', () => {
    expect(normalizeBoolean(false, 'lower_is_better')).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// applyMissingDataPenalty
// ---------------------------------------------------------------------------

describe('applyMissingDataPenalty', () => {
  it('no penalty when present === total', () => {
    expect(applyMissingDataPenalty(80, 5, 5)).toBe(80);
  });

  it('penalty of sqrt(3/5) when 3 of 5 present', () => {
    const raw = 100;
    const expected = raw * Math.sqrt(3 / 5);
    expect(applyMissingDataPenalty(raw, 3, 5)).toBeCloseTo(expected, 10);
  });

  it('penalty of sqrt(1/4) when 1 of 4 present', () => {
    const expected = 60 * Math.sqrt(1 / 4);
    expect(applyMissingDataPenalty(60, 1, 4)).toBeCloseTo(expected, 10);
  });
});

// ---------------------------------------------------------------------------
// reNormalizeWeights
// ---------------------------------------------------------------------------

describe('reNormalizeWeights', () => {
  it('unchanged proportions when all present', () => {
    const weights = { a: 0.5, b: 0.3, c: 0.2 };
    const result = reNormalizeWeights(weights, new Set(['a', 'b', 'c']), 'X.1');
    expect(result['a']).toBeCloseTo(0.5, 10);
    expect(result['b']).toBeCloseTo(0.3, 10);
    expect(result['c']).toBeCloseTo(0.2, 10);
  });

  it('re-normalizes when one key is absent', () => {
    const weights = { a: 0.5, b: 0.3, c: 0.2 };
    const result = reNormalizeWeights(weights, new Set(['a', 'b']), 'X.1');
    // remaining total = 0.8; a → 0.5/0.8 = 0.625; b → 0.3/0.8 = 0.375
    expect(result['a']).toBeCloseTo(0.625, 10);
    expect(result['b']).toBeCloseTo(0.375, 10);
    expect(result['c']).toBeUndefined();
  });

  it('re-normalized weights sum to 1.0', () => {
    const weights = { a: 0.4, b: 0.35, c: 0.25 };
    const result = reNormalizeWeights(weights, new Set(['b', 'c']), 'X.1');
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('throws ScoringError when presentKeys is empty', () => {
    const weights = { a: 0.5, b: 0.5 };
    expect(() => reNormalizeWeights(weights, new Set(), 'A.2')).toThrow(ScoringError);
  });

  it('throw message names the sub-factor', () => {
    const weights = { a: 0.5, b: 0.5 };
    expect(() => reNormalizeWeights(weights, new Set(), 'B.3')).toThrow('B.3');
  });
});

// ---------------------------------------------------------------------------
// computeDataCoverage
// ---------------------------------------------------------------------------

describe('computeDataCoverage', () => {
  it('full coverage → 1.0', () => {
    expect(computeDataCoverage(5, 5)).toBe(1.0);
  });

  it('partial coverage', () => {
    expect(computeDataCoverage(3, 5)).toBeCloseTo(0.6, 10);
  });

  it('zero total → 0 (not NaN)', () => {
    expect(computeDataCoverage(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Insufficient disclosure threshold
// ---------------------------------------------------------------------------

describe('insufficient disclosure threshold', () => {
  it('INSUFFICIENT_DISCLOSURE_THRESHOLD is 0.70', () => {
    expect(INSUFFICIENT_DISCLOSURE_THRESHOLD).toBe(0.7);
  });

  it('2/5 indicators present → below threshold', () => {
    expect(computeDataCoverage(2, 5) < INSUFFICIENT_DISCLOSURE_THRESHOLD).toBe(true);
  });

  it('4/5 indicators present → above threshold', () => {
    expect(computeDataCoverage(4, 5) < INSUFFICIENT_DISCLOSURE_THRESHOLD).toBe(false);
  });

  it('exactly 70% coverage → not flagged (boundary)', () => {
    expect(computeDataCoverage(7, 10) < INSUFFICIENT_DISCLOSURE_THRESHOLD).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// aggregateWeightedMean
// ---------------------------------------------------------------------------

describe('aggregateWeightedMean', () => {
  it('equal weights → simple mean', () => {
    const items = [
      { score: 40, weight: 0.5 },
      { score: 80, weight: 0.5 },
    ];
    expect(aggregateWeightedMean(items)).toBeCloseTo(60, 10);
  });

  it('skewed weights emphasize higher-weight item', () => {
    const items = [
      { score: 100, weight: 0.9 },
      { score: 0, weight: 0.1 },
    ];
    expect(aggregateWeightedMean(items)).toBeCloseTo(90, 10);
  });
});

// ---------------------------------------------------------------------------
// Full engine: validation errors
// ---------------------------------------------------------------------------

describe('runScoringEngine — validation', () => {
  it('throws when a field_value is not approved', () => {
    const input = makeMinimalInput();
    input.fieldValues[0].status = 'pending';
    expect(() => runScoringEngine(input)).toThrow(ScoringError);
  });

  it('throws when normalizationFn is unknown', () => {
    const input = makeMinimalInput();
    // Force an invalid fn via type cast
    (input.fieldDefinitions[0] as unknown as Record<string, unknown>)['normalizationFn'] =
      'polynomial';
    expect(() => runScoringEngine(input)).toThrow(ScoringError);
  });

  it('throws when categorical value is missing from rubric', () => {
    const input = makeMinimalInput();
    const def = input.fieldDefinitions[0];
    def.normalizationFn = 'categorical';
    def.scoringRubricJsonb = { yes: 100, no: 0 };
    input.fieldValues[0].valueNormalized = 'maybe'; // not in rubric
    expect(() => runScoringEngine(input)).toThrow(ScoringError);
  });

  it('throws when categorical field has no rubric', () => {
    const input = makeMinimalInput();
    input.fieldDefinitions[0].normalizationFn = 'categorical';
    input.fieldDefinitions[0].scoringRubricJsonb = null;
    input.fieldValues[0].valueNormalized = 'some_value';
    expect(() => runScoringEngine(input)).toThrow(ScoringError);
  });
});

// ---------------------------------------------------------------------------
// Full engine: determinism
// ---------------------------------------------------------------------------

describe('runScoringEngine — determinism', () => {
  it('produces byte-identical output on two consecutive runs', () => {
    const input = makeFullInput();
    const out1 = runScoringEngine(input);
    const out2 = runScoringEngine(input);
    expect(out1).toEqual(out2);
  });

  it('scoredAt in output equals scoredAt from input', () => {
    const input = makeFullInput();
    const out = runScoringEngine(input);
    expect(out.scoredAt).toBe(input.scoredAt);
  });
});

// ---------------------------------------------------------------------------
// Full engine: composite score bounds and structure
// ---------------------------------------------------------------------------

describe('runScoringEngine — composite score', () => {
  it('compositeScore is in [0, 100]', () => {
    const out = runScoringEngine(makeFullInput());
    expect(out.compositeScore).toBeGreaterThanOrEqual(0);
    expect(out.compositeScore).toBeLessThanOrEqual(100);
  });

  it('compositeScore = 0.30 × cme + 0.70 × paq', () => {
    const out = runScoringEngine(makeFullInput());
    expect(out.compositeScore).toBeCloseTo(
      CME_WEIGHT * out.cmeScore + PAQ_WEIGHT * out.paqScore,
      10
    );
  });

  it('all five pillarScores are present in output', () => {
    const out = runScoringEngine(makeFullInput());
    expect(Object.keys(out.pillarScores).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('dataCoverageByPillar has entry for every pillar', () => {
    const out = runScoringEngine(makeFullInput());
    expect(Object.keys(out.dataCoverageByPillar).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('full-coverage input is not flagged for insufficient disclosure', () => {
    const out = runScoringEngine(makeFullInput());
    expect(out.flaggedInsufficientDisclosure).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full engine: missing data behaviour
// ---------------------------------------------------------------------------

describe('runScoringEngine — missing data', () => {
  it('sub-factor score is penalized when some indicators are missing', () => {
    const full = runScoringEngine(makeFullInput());
    const partial = runScoringEngine(makePartialInput());
    // The partial input is missing one indicator; the penalized sub-factor score
    // must be strictly lower than the equivalent full-coverage score.
    expect(partial.paqScore).toBeLessThan(full.paqScore);
  });

  it('flags insufficient disclosure when a pillar is below 70% coverage', () => {
    const input = makeLowCoverageInput();
    const out = runScoringEngine(input);
    expect(out.flaggedInsufficientDisclosure).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalInput(): ScoringInput {
  const scoredAt = new Date('2026-01-01T00:00:00.000Z');
  return {
    programId: 'prog-1',
    methodologyVersionId: 'meth-1',
    scoredAt,
    cmeScore: 50,
    fieldDefinitions: [
      {
        id: 'def-a1-1',
        key: 'A.1.1',
        pillar: 'A',
        subFactor: 'A.1',
        weightWithinSubFactor: 1.0,
        scoringRubricJsonb: null,
        normalizationFn: 'min_max',
        direction: 'higher_is_better',
      },
    ],
    fieldValues: [
      {
        id: 'val-1',
        fieldDefinitionId: 'def-a1-1',
        valueNormalized: 50,
        status: 'approved',
      },
    ],
    normalizationParams: {
      'A.1.1': { min: 0, max: 100 },
    },
  };
}

/**
 * A fully-covered input across all 5 pillars (one sub-factor per pillar with
 * one indicator each, all with known min_max params).
 */
function makeFullInput(): ScoringInput {
  const scoredAt = new Date('2026-01-01T00:00:00.000Z');

  const defs = [
    { id: 'd-a1', key: 'A.1.1', pillar: 'A', subFactor: 'A.1', w: 1.0, fn: 'min_max' as const },
    { id: 'd-a2', key: 'A.2.1', pillar: 'A', subFactor: 'A.2', w: 1.0, fn: 'min_max' as const },
    { id: 'd-a3', key: 'A.3.1', pillar: 'A', subFactor: 'A.3', w: 1.0, fn: 'min_max' as const },
    { id: 'd-b1', key: 'B.1.1', pillar: 'B', subFactor: 'B.1', w: 1.0, fn: 'min_max' as const },
    { id: 'd-b2', key: 'B.2.1', pillar: 'B', subFactor: 'B.2', w: 1.0, fn: 'min_max' as const },
    { id: 'd-b3', key: 'B.3.1', pillar: 'B', subFactor: 'B.3', w: 1.0, fn: 'min_max' as const },
    { id: 'd-c1', key: 'C.1.1', pillar: 'C', subFactor: 'C.1', w: 1.0, fn: 'min_max' as const },
    { id: 'd-c2', key: 'C.2.1', pillar: 'C', subFactor: 'C.2', w: 1.0, fn: 'min_max' as const },
    { id: 'd-c3', key: 'C.3.1', pillar: 'C', subFactor: 'C.3', w: 1.0, fn: 'min_max' as const },
    { id: 'd-d1', key: 'D.1.1', pillar: 'D', subFactor: 'D.1', w: 1.0, fn: 'min_max' as const },
    { id: 'd-d2', key: 'D.2.1', pillar: 'D', subFactor: 'D.2', w: 1.0, fn: 'min_max' as const },
    { id: 'd-d3', key: 'D.3.1', pillar: 'D', subFactor: 'D.3', w: 1.0, fn: 'min_max' as const },
    { id: 'd-e1', key: 'E.1.1', pillar: 'E', subFactor: 'E.1', w: 1.0, fn: 'min_max' as const },
    { id: 'd-e2', key: 'E.2.1', pillar: 'E', subFactor: 'E.2', w: 1.0, fn: 'min_max' as const },
    { id: 'd-e3', key: 'E.3.1', pillar: 'E', subFactor: 'E.3', w: 1.0, fn: 'min_max' as const },
  ];

  return {
    programId: 'prog-full',
    methodologyVersionId: 'meth-1',
    scoredAt,
    cmeScore: 75,
    fieldDefinitions: defs.map((d) => ({
      id: d.id,
      key: d.key,
      pillar: d.pillar,
      subFactor: d.subFactor,
      weightWithinSubFactor: d.w,
      scoringRubricJsonb: null,
      normalizationFn: d.fn,
      direction: 'higher_is_better' as const,
    })),
    fieldValues: defs.map((d) => ({
      id: `val-${d.id}`,
      fieldDefinitionId: d.id,
      valueNormalized: 70,
      status: 'approved',
    })),
    normalizationParams: Object.fromEntries(defs.map((d) => [d.key, { min: 0, max: 100 }])),
  };
}

/**
 * Same as makeFullInput but missing one indicator in A.1 → triggers penalty.
 * A.1 has two indicators; we only supply one value.
 */
function makePartialInput(): ScoringInput {
  const base = makeFullInput();
  // Add a second def for A.1 without a corresponding value
  const extraDef = {
    id: 'd-a1-extra',
    key: 'A.1.2',
    pillar: 'A',
    subFactor: 'A.1',
    weightWithinSubFactor: 0.5,
    scoringRubricJsonb: null,
    normalizationFn: 'min_max' as const,
    direction: 'higher_is_better' as const,
  };
  // Rebalance existing A.1.1 weight
  const a11Def = base.fieldDefinitions.find((d) => d.key === 'A.1.1')!;
  a11Def.weightWithinSubFactor = 0.5;

  base.fieldDefinitions.push(extraDef);
  base.normalizationParams['A.1.2'] = { min: 0, max: 100 };
  // No fieldValue for d-a1-extra → it is missing

  return base;
}

/**
 * Input where pillar A has only 1 of 5 indicators → coverage = 0.2 < 0.70.
 */
function makeLowCoverageInput(): ScoringInput {
  const base = makeFullInput();

  // Add 4 more defs for A.1 (total 5), but only one value already exists
  for (let i = 2; i <= 5; i++) {
    const key = `A.1.${i}`;
    const id = `d-a1-${i}`;
    base.fieldDefinitions.push({
      id,
      key,
      pillar: 'A',
      subFactor: 'A.1',
      weightWithinSubFactor: 0.2,
      scoringRubricJsonb: null,
      normalizationFn: 'min_max',
      direction: 'higher_is_better',
    });
    base.normalizationParams[key] = { min: 0, max: 100 };
    // No fieldValue added → missing
  }
  // Rebalance existing A.1.1 weight to 0.2 so all 5 sum to 1.0
  const a11Def = base.fieldDefinitions.find((d) => d.key === 'A.1.1')!;
  a11Def.weightWithinSubFactor = 0.2;

  return base;
}
