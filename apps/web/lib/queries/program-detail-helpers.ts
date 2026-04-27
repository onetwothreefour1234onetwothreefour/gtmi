/**
 * Pure helpers used by the program-detail query. Split out from
 * `program-detail.ts` so the test suite can import them without dragging
 * in `'server-only'` (which the query module declares for runtime safety).
 */

import type { PillarScores } from './program-detail-types';

const PILLAR_KEYS: readonly (keyof PillarScores)[] = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Median of an arbitrary cohort of PillarScores. Returns null when the
 * cohort is empty. For even cohorts, averages the two middle values
 * (Phase 4.3 reality: cohort size is 2, so this returns the arithmetic
 * mean of AUS + SGP). Pure — does not mutate inputs.
 */
export function computeMedianPillarScores(cohort: PillarScores[]): PillarScores | null {
  if (cohort.length === 0) return null;
  const median = (vals: number[]): number => {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid] as number;
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  };
  const out: Partial<PillarScores> = {};
  for (const k of PILLAR_KEYS) {
    out[k] = median(cohort.map((c) => c[k]));
  }
  return out as PillarScores;
}

/**
 * Pillar contribution math: sub-factor weight × indicator score, summed
 * across the indicators present in a sub-factor. Used by the pillar
 * breakdown table next to the radar.
 */
export function pillarContribution(pillarScore: number, pillarWeightWithinPaq: number): number {
  return pillarScore * pillarWeightWithinPaq;
}
