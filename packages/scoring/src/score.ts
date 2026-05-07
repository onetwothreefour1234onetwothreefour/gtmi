import { ScoringError } from './types';

export const PILLAR_WEIGHTS: Record<string, number> = {
  A: 0.28,
  B: 0.15,
  C: 0.2,
  D: 0.22,
  E: 0.15,
};

// Sub-factor weights — must mirror methodology-v1.ts.sub_factor_weights.
// Methodology v2.0.0 (ADR-028): Pillar A flattened to A.1/A.2/A.3.
// Methodology v3.0.0 (ADR-029): Pillar B expanded to B.1/B.2/B.3/B.4.
// Methodology v4.0.0 (ADR-030): Pillar C unchanged structure.
// Methodology v5.0.0 (ADR-031): Pillar D collapsed to D.1=0.4 / D.2=0.6
// (D.3 tax sub-factor retired); previous score.ts weights here were
// stale (the runtime engine re-normalised in-scope weights so the
// stale entries were not directly load-bearing — see engine.ts pillar
// aggregation — but they were inconsistent with the seed and the
// methodology endpoint).
// Methodology v6.0.0 (ADR-032): Pillar E collapsed to E.1=0.5 / E.2=0.5
// (E.3 institutional-quality retired alongside the WGI / V-Dem path).
export const SUB_FACTOR_WEIGHTS: Record<string, Record<string, number>> = {
  A: { 'A.1': 0.5, 'A.2': 0.3, 'A.3': 0.2 },
  B: { 'B.1': 0.3, 'B.2': 0.2, 'B.3': 0.3, 'B.4': 0.2 },
  C: { 'C.1': 0.4, 'C.2': 0.4, 'C.3': 0.2 },
  D: { 'D.1': 0.4, 'D.2': 0.6 },
  E: { 'E.1': 0.5, 'E.2': 0.5 },
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
