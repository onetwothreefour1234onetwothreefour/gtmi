import { describe, it, expect } from 'vitest';
import { computeMedianPillarScores, pillarContribution } from './program-detail-helpers';
import type { PillarScores } from './program-detail-types';

describe('computeMedianPillarScores', () => {
  it('returns null on an empty cohort', () => {
    expect(computeMedianPillarScores([])).toBeNull();
  });

  it('returns the input pillar scores verbatim for a cohort of one', () => {
    const single: PillarScores = { A: 18, B: 12, C: 16, D: 10, E: 14 };
    expect(computeMedianPillarScores([single])).toEqual(single);
  });

  it('averages the two middle values for an even-sized cohort (the Phase 4.3 case)', () => {
    // Phase 4.3 reality: AUS + SGP only.
    const aus: PillarScores = { A: 18, B: 12, C: 16, D: 10, E: 14 };
    const sgp: PillarScores = { A: 24, B: 19, C: 17, D: 13, E: 16 };
    expect(computeMedianPillarScores([aus, sgp])).toEqual({
      A: 21,
      B: 15.5,
      C: 16.5,
      D: 11.5,
      E: 15,
    });
  });

  it('returns the middle value for an odd-sized cohort', () => {
    const c1: PillarScores = { A: 10, B: 10, C: 10, D: 10, E: 10 };
    const c2: PillarScores = { A: 20, B: 20, C: 20, D: 20, E: 20 };
    const c3: PillarScores = { A: 30, B: 30, C: 30, D: 30, E: 30 };
    expect(computeMedianPillarScores([c1, c2, c3])).toEqual({
      A: 20,
      B: 20,
      C: 20,
      D: 20,
      E: 20,
    });
  });

  it('is order-independent', () => {
    const a: PillarScores = { A: 10, B: 90, C: 50, D: 50, E: 50 };
    const b: PillarScores = { A: 50, B: 10, C: 50, D: 50, E: 50 };
    const c: PillarScores = { A: 90, B: 50, C: 50, D: 50, E: 50 };
    const m1 = computeMedianPillarScores([a, b, c]);
    const m2 = computeMedianPillarScores([c, a, b]);
    const m3 = computeMedianPillarScores([b, c, a]);
    expect(m1).toEqual(m2);
    expect(m2).toEqual(m3);
  });

  it('does not mutate the input cohort', () => {
    const cohort: PillarScores[] = [
      { A: 30, B: 30, C: 30, D: 30, E: 30 },
      { A: 10, B: 10, C: 10, D: 10, E: 10 },
    ];
    const before = JSON.stringify(cohort);
    computeMedianPillarScores(cohort);
    expect(JSON.stringify(cohort)).toBe(before);
  });

  it('handles negative scores (defensive — the engine does not produce them but the type permits)', () => {
    const a: PillarScores = { A: -10, B: 0, C: 10, D: 20, E: 30 };
    const b: PillarScores = { A: -20, B: 0, C: 20, D: 40, E: 60 };
    expect(computeMedianPillarScores([a, b])).toEqual({
      A: -15,
      B: 0,
      C: 15,
      D: 30,
      E: 45,
    });
  });
});

describe('pillarContribution', () => {
  // Pillar contribution = pillar score × pillar's weight within PAQ.
  // Used by the pillar breakdown table next to the radar.
  it('returns 0 when the pillar score is 0', () => {
    expect(pillarContribution(0, 0.28)).toBe(0);
  });

  it('returns the pillar score when weight is 1.0', () => {
    expect(pillarContribution(18.4, 1)).toBe(18.4);
  });

  it('multiplies pillar score by pillar weight', () => {
    // Pillar A (weight 0.28) score 18 → contributes 5.04 to PAQ.
    expect(pillarContribution(18, 0.28)).toBeCloseTo(5.04, 9);
  });

  it('the five default pillar contributions sum to PAQ', () => {
    // METHODOLOGY §1.1 default weights.
    const weights = { A: 0.28, B: 0.15, C: 0.2, D: 0.22, E: 0.15 };
    const scores = { A: 18, B: 12, C: 16, D: 10, E: 14 };
    const total =
      pillarContribution(scores.A, weights.A) +
      pillarContribution(scores.B, weights.B) +
      pillarContribution(scores.C, weights.C) +
      pillarContribution(scores.D, weights.D) +
      pillarContribution(scores.E, weights.E);
    // 18*0.28 + 12*0.15 + 16*0.20 + 10*0.22 + 14*0.15 = 14.34
    expect(total).toBeCloseTo(14.34, 4);
  });
});
