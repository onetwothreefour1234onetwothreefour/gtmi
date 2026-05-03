import { ScoringError } from './types';

export const PILLAR_WEIGHTS: Record<string, number> = {
  A: 0.28,
  B: 0.15,
  C: 0.2,
  D: 0.22,
  E: 0.15,
};

export const SUB_FACTOR_WEIGHTS: Record<string, Record<string, number>> = {
  A: { 'A.1': 0.4, 'A.2': 0.35, 'A.3': 0.25 },
  B: { 'B.1': 0.4, 'B.2': 0.35, 'B.3': 0.25 },
  C: { 'C.1': 0.45, 'C.2': 0.35, 'C.3': 0.2 },
  D: { 'D.1': 0.5, 'D.2': 0.35, 'D.3': 0.15 },
  E: { 'E.1': 0.5, 'E.2': 0.3, 'E.3': 0.2 },
};

export const CME_WEIGHT = 0.3;
export const PAQ_WEIGHT = 0.7;
export const INSUFFICIENT_DISCLOSURE_THRESHOLD = 0.7;

export function aggregateWeightedMean(items: { score: number; weight: number }[]): number {
  return items.reduce((sum, item) => sum + item.score * item.weight, 0);
}

/**
 * Phase 3.10d / B.3 — weighted geometric mean for sensitivity analysis.
 *
 *   exp( Σ w_i × ln(score_i) )
 *
 * Any zero score collapses the result to 0 (the methodology-aligned
 * "uniformly bad on a pillar can't be papered over" intent). Items
 * with weight 0 are skipped. Negative scores are not expected at the
 * pillar level (range 0–100); we clamp to a tiny epsilon to avoid NaN
 * if upstream rounding produces a slightly-negative value.
 */
export function aggregateWeightedGeometricMean(items: { score: number; weight: number }[]): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((s, item) => s + item.weight, 0);
  if (totalWeight === 0) return 0;
  let logSum = 0;
  for (const item of items) {
    if (item.weight === 0) continue;
    if (item.score <= 0) return 0; // any zero collapses the geom mean
    logSum += (item.weight / totalWeight) * Math.log(item.score);
  }
  return Math.exp(logSum);
}

/**
 * Scales the weights of present keys to sum to 1.0.
 * Throws ScoringError if presentKeys is empty — missing all indicators in a
 * sub-factor is a data integrity problem, not a scoring outcome.
 */
export function reNormalizeWeights(
  allWeights: Record<string, number>,
  presentKeys: Set<string>,
  subFactor: string
): Record<string, number> {
  if (presentKeys.size === 0) {
    throw new ScoringError(`No indicators present for sub-factor ${subFactor} — cannot score`);
  }
  const totalWeight = Array.from(presentKeys).reduce((sum, key) => sum + (allWeights[key] ?? 0), 0);
  if (totalWeight === 0) {
    throw new ScoringError(
      `Present indicators for sub-factor ${subFactor} have total weight 0 — cannot score`
    );
  }
  const result: Record<string, number> = {};
  for (const key of presentKeys) {
    result[key] = (allWeights[key] ?? 0) / totalWeight;
  }
  return result;
}

export function applyMissingDataPenalty(score: number, present: number, total: number): number {
  if (present === total) return score;
  return score * Math.sqrt(present / total);
}

export function computeDataCoverage(present: number, total: number): number {
  if (total === 0) return 0;
  return present / total;
}
