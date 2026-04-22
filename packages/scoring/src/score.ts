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
 * Scales the weights of present keys to sum to 1.0.
 * Throws ScoringError if presentKeys is empty — missing all indicators in a
 * sub-factor is a data integrity problem, not a scoring outcome.
 */
export function reNormalizeWeights(
  allWeights: Record<string, number>,
  presentKeys: Set<string>,
  subFactor: string,
): Record<string, number> {
  if (presentKeys.size === 0) {
    throw new ScoringError(`No indicators present for sub-factor ${subFactor} — cannot score`);
  }
  const totalWeight = Array.from(presentKeys).reduce((sum, key) => sum + (allWeights[key] ?? 0), 0);
  if (totalWeight === 0) {
    throw new ScoringError(
      `Present indicators for sub-factor ${subFactor} have total weight 0 — cannot score`,
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
