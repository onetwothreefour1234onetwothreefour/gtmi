import type { PillarKey } from './theme';

export type PillarWeights = Record<PillarKey, number>;

const PILLARS: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

/** Default per METHODOLOGY §1.1. */
export const DEFAULT_PILLAR_WEIGHTS: PillarWeights = {
  A: 0.28,
  B: 0.15,
  C: 0.2,
  D: 0.22,
  E: 0.15,
};

/**
 * When the user moves one slider, redistribute the delta proportionally
 * across the other pillars so the total stays at 1.0.
 *
 * If the other pillars sum to 0 (edge case where the user cranks everything
 * else to zero), we split the remainder equally among them.
 */
export function rebalancePillarWeights(
  current: PillarWeights,
  changed: PillarKey,
  newValue: number
): PillarWeights {
  const clamped = Math.max(0, Math.min(1, newValue));
  const others = PILLARS.filter((p) => p !== changed);
  const otherSum = others.reduce((sum, p) => sum + current[p], 0);
  const remainder = 1 - clamped;

  const next: PillarWeights = { ...current, [changed]: clamped };

  if (otherSum > 0) {
    for (const p of others) {
      next[p] = (current[p] / otherSum) * remainder;
    }
  } else {
    const equal = remainder / others.length;
    for (const p of others) {
      next[p] = equal;
    }
  }

  // Numerical correction so the sum is exactly 1.0 modulo float epsilon.
  const sum = PILLARS.reduce((s, p) => s + next[p], 0);
  if (sum !== 0) {
    const correction = 1 / sum;
    for (const p of PILLARS) next[p] *= correction;
  }

  return next;
}

/** Computes a PAQ from per-pillar scores using user-supplied weights. */
export function recomputePaq(
  pillarScores: Record<PillarKey, number>,
  weights: PillarWeights
): number {
  let paq = 0;
  for (const p of PILLARS) {
    paq += pillarScores[p] * weights[p];
  }
  return paq;
}
