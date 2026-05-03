import { describe, expect, it } from 'vitest';
import { aggregateWeightedGeometricMean, aggregateWeightedMean } from '../src/score';

// Phase 3.10d / B.3 — weighted geometric mean for sensitivity analysis.

describe('aggregateWeightedGeometricMean', () => {
  it('returns 0 for empty input', () => {
    expect(aggregateWeightedGeometricMean([])).toBe(0);
  });

  it('returns 0 when all weights are 0', () => {
    expect(aggregateWeightedGeometricMean([{ score: 80, weight: 0 }])).toBe(0);
  });

  it('returns 0 when ANY non-zero-weight item has score 0', () => {
    expect(
      aggregateWeightedGeometricMean([
        { score: 80, weight: 0.5 },
        { score: 0, weight: 0.5 },
      ])
    ).toBe(0);
  });

  it('matches arithmetic mean when all scores equal', () => {
    const items = [
      { score: 70, weight: 0.4 },
      { score: 70, weight: 0.6 },
    ];
    expect(aggregateWeightedGeometricMean(items)).toBeCloseTo(70, 5);
    expect(aggregateWeightedMean(items)).toBeCloseTo(70, 5);
  });

  it('produces a value below the arithmetic mean for unequal scores', () => {
    const items = [
      { score: 90, weight: 0.5 },
      { score: 50, weight: 0.5 },
    ];
    const arith = aggregateWeightedMean(items);
    const geom = aggregateWeightedGeometricMean(items);
    expect(geom).toBeLessThan(arith);
    // Hand-calc: exp(0.5*ln(90) + 0.5*ln(50)) = sqrt(90*50) ≈ 67.08
    expect(geom).toBeCloseTo(Math.sqrt(90 * 50), 4);
  });

  it('weights items proportionally to their weight share', () => {
    const items = [
      { score: 90, weight: 0.8 },
      { score: 50, weight: 0.2 },
    ];
    // 0.8/1.0 * ln(90) + 0.2/1.0 * ln(50)
    const expected = Math.exp(0.8 * Math.log(90) + 0.2 * Math.log(50));
    expect(aggregateWeightedGeometricMean(items)).toBeCloseTo(expected, 4);
  });

  it('renormalises across non-1 weight totals', () => {
    const items = [
      { score: 70, weight: 2 },
      { score: 50, weight: 2 },
    ];
    expect(aggregateWeightedGeometricMean(items)).toBeCloseTo(Math.sqrt(70 * 50), 4);
  });

  it('skips items with weight 0 without collapsing to zero', () => {
    expect(
      aggregateWeightedGeometricMean([
        { score: 70, weight: 0.5 },
        { score: 0, weight: 0 },
        { score: 50, weight: 0.5 },
      ])
    ).toBeCloseTo(Math.sqrt(70 * 50), 4);
  });
});
