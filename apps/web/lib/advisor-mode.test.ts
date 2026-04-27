import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PILLAR_WEIGHTS,
  rebalancePillarWeights,
  recomputePaq,
  type PillarWeights,
} from './advisor-mode';

const EPSILON = 1e-9;

function sumWeights(w: PillarWeights): number {
  return w.A + w.B + w.C + w.D + w.E;
}

describe('rebalancePillarWeights', () => {
  it('default weights sum to 1.0 exactly', () => {
    expect(sumWeights(DEFAULT_PILLAR_WEIGHTS)).toBeCloseTo(1.0, 9);
  });

  it('keeps the changed pillar at the requested value', () => {
    const next = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'A', 0.5);
    expect(next.A).toBeCloseTo(0.5, 9);
  });

  it('redistributes the delta proportionally to the other pillars', () => {
    // A goes 0.28 → 0.5 (delta -0.22 to spread). Others currently sum to 0.72.
    // Each "other" pillar shrinks by the same ratio: new = old * (0.5 / 0.72).
    const next = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'A', 0.5);
    const ratio = 0.5 / 0.72;
    expect(next.B).toBeCloseTo(0.15 * ratio, 9);
    expect(next.C).toBeCloseTo(0.2 * ratio, 9);
    expect(next.D).toBeCloseTo(0.22 * ratio, 9);
    expect(next.E).toBeCloseTo(0.15 * ratio, 9);
  });

  it('the result always sums to 1.0 within float epsilon', () => {
    for (const target of [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1]) {
      const next = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'C', target);
      expect(Math.abs(sumWeights(next) - 1)).toBeLessThan(EPSILON);
    }
  });

  it('clamps the requested value to [0, 1]', () => {
    const high = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'B', 1.7);
    expect(high.B).toBe(1);
    expect(high.A + high.C + high.D + high.E).toBeCloseTo(0, 9);

    const low = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'B', -0.5);
    expect(low.B).toBe(0);
    expect(sumWeights(low)).toBeCloseTo(1, 9);
  });

  it('handles edge case where other pillars sum to 0 by splitting equally', () => {
    const zeroed: PillarWeights = { A: 1, B: 0, C: 0, D: 0, E: 0 };
    const next = rebalancePillarWeights(zeroed, 'A', 0.4);
    expect(next.A).toBeCloseTo(0.4, 9);
    // Remainder 0.6 split equally across B/C/D/E = 0.15 each.
    expect(next.B).toBeCloseTo(0.15, 9);
    expect(next.C).toBeCloseTo(0.15, 9);
    expect(next.D).toBeCloseTo(0.15, 9);
    expect(next.E).toBeCloseTo(0.15, 9);
  });

  it('preserves the relative ordering of unchanged pillars', () => {
    // D (0.22) > C (0.20) > B (0.15) ≈ E (0.15). After moving A, that
    // ordering between B/C/D/E must be preserved.
    const next = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'A', 0.4);
    expect(next.D).toBeGreaterThan(next.C);
    expect(next.C).toBeGreaterThan(next.B);
    expect(next.B).toBeCloseTo(next.E, 9);
  });

  it('moving a slider to its current value is a no-op (sum still 1)', () => {
    const next = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'A', 0.28);
    expect(next.A).toBeCloseTo(0.28, 9);
    expect(sumWeights(next)).toBeCloseTo(1, 9);
  });

  it('chained rebalances stay normalised', () => {
    let w = { ...DEFAULT_PILLAR_WEIGHTS };
    w = rebalancePillarWeights(w, 'A', 0.4);
    w = rebalancePillarWeights(w, 'E', 0.3);
    w = rebalancePillarWeights(w, 'B', 0.05);
    expect(sumWeights(w)).toBeCloseTo(1, 9);
    expect(w.A).toBeGreaterThan(0);
    expect(w.E).toBeGreaterThan(0);
  });
});

describe('recomputePaq', () => {
  const SAMPLE_PILLARS = { A: 18, B: 12, C: 16, D: 10, E: 14 };

  it('computes PAQ as the weighted sum of pillar scores', () => {
    const paq = recomputePaq(SAMPLE_PILLARS, DEFAULT_PILLAR_WEIGHTS);
    // 18*0.28 + 12*0.15 + 16*0.20 + 10*0.22 + 14*0.15 = 14.34
    expect(paq).toBeCloseTo(14.34, 4);
  });

  it('reweighting changes PAQ accordingly', () => {
    const heavyAccess = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'A', 0.5);
    const paq = recomputePaq(SAMPLE_PILLARS, heavyAccess);
    // A=0.5 weights pulls PAQ toward A's score (18) and away from D's (10).
    expect(paq).toBeGreaterThan(recomputePaq(SAMPLE_PILLARS, DEFAULT_PILLAR_WEIGHTS));
  });

  it('all-zero scores → PAQ = 0', () => {
    const zeros = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    expect(recomputePaq(zeros, DEFAULT_PILLAR_WEIGHTS)).toBe(0);
  });

  it('all-100 scores → PAQ = 100 regardless of weights', () => {
    const max = { A: 100, B: 100, C: 100, D: 100, E: 100 };
    expect(recomputePaq(max, DEFAULT_PILLAR_WEIGHTS)).toBeCloseTo(100, 9);

    const skewed = rebalancePillarWeights(DEFAULT_PILLAR_WEIGHTS, 'B', 0.6);
    expect(recomputePaq(max, skewed)).toBeCloseTo(100, 9);
  });
});
