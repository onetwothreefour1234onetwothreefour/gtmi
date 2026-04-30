// Phase 3.9 / W6 — dry-run cost estimator for canary re-runs.
//
// Counts the LLM calls that WOULD happen for a planned canary run
// without actually firing them, then multiplies by per-call cost
// estimates derived from claude-sonnet-4-6's published pricing as of
// 2026-04. Output drives the --estimate-only flag and the
// MAX_RERUN_COST_USD guard.
//
// Cost model is intentionally pessimistic — we'd rather over-estimate
// and have the analyst confirm than under-estimate and silently spend
// $50. Real per-canary costs are typically 30-50% lower because of
// extraction_cache hits, early-exit at 0.9 confidence, and unchanged
// short-circuits.

import type { DiscoveredUrl } from '../types/extraction';

/** Per-call USD estimates for claude-sonnet-4-6 as of 2026-04. */
export const COST_MODEL = {
  /** Stage 0 — Perplexity sonar-pro discovery call. ~$0.005 per call. */
  perplexityDiscovery: 0.005,
  /** Stage 2 — claude-sonnet-4-6 batch extraction. ~$0.04 per (URL × batch). */
  batchExtraction: 0.04,
  /** Stage 2 tier-2 fallback — same model, fewer fields, ~$0.02. */
  tier2Fallback: 0.02,
  /** Stage 3 — validation per field. ~$0.005 per field. */
  validation: 0.005,
  /** W2 — translation per non-English page. ~$0.001 per page. */
  translation: 0.001,
} as const;

export interface CostEstimateInput {
  /** Number of URLs that will hit the LLM batch extractor. Skips archive-loaded (unchanged) URLs. */
  llmExtractionUrls: number;
  /** Number of fields the batch will extract. */
  fieldCount: number;
  /** Number of URLs needing Tier-2 fallback (estimate from missing-field set). */
  tier2FallbackUrls?: number;
  /** Number of validation calls (1 per (field × winning URL) typically). */
  validationCalls?: number;
  /** Number of non-English URLs requiring translation. */
  translationUrls?: number;
  /** Whether Stage 0 (Perplexity) will be called. */
  runsDiscovery?: boolean;
}

export interface CostEstimate {
  total: number;
  breakdown: {
    discovery: number;
    batchExtraction: number;
    tier2Fallback: number;
    validation: number;
    translation: number;
  };
  warning: string | null;
}

/**
 * Pure function: input → estimated USD cost. Used by canary-run.ts
 * for the --estimate-only short-circuit and by the
 * MAX_RERUN_COST_USD guard.
 */
export function estimateCanaryCost(input: CostEstimateInput): CostEstimate {
  const breakdown = {
    discovery: input.runsDiscovery ? COST_MODEL.perplexityDiscovery : 0,
    batchExtraction: input.llmExtractionUrls * COST_MODEL.batchExtraction,
    tier2Fallback: (input.tier2FallbackUrls ?? 0) * COST_MODEL.tier2Fallback,
    validation: (input.validationCalls ?? input.fieldCount) * COST_MODEL.validation,
    translation: (input.translationUrls ?? 0) * COST_MODEL.translation,
  };
  const total =
    breakdown.discovery +
    breakdown.batchExtraction +
    breakdown.tier2Fallback +
    breakdown.validation +
    breakdown.translation;
  const warning =
    total > 10
      ? `Estimated cost exceeds $10 — confirm before proceeding`
      : input.llmExtractionUrls === 0 && input.runsDiscovery !== true
        ? 'Zero LLM extraction work planned (likely archive-only with no archive misses)'
        : null;
  return { total, breakdown, warning };
}

/**
 * Convenience: build the input shape from the canary's resolved URL
 * + field set.
 */
export function planCanaryCost(args: {
  mode: string;
  mergedUrls: ReadonlyArray<DiscoveredUrl>;
  archiveHitUrls: number;
  llmFieldCount: number;
  tier2EligibleFields: number;
  translationCandidateUrls: number;
}): CostEstimate {
  const runsDiscovery = !['narrow', 'gate-failed', 'rubric-changed', 'field'].includes(args.mode);
  // archive-first / archive-only: only URLs missed by archive go to LLM.
  const isArchiveMode = args.mode === 'archive-first' || args.mode === 'archive-only';
  const llmExtractionUrls = isArchiveMode
    ? args.mergedUrls.length - args.archiveHitUrls
    : args.mergedUrls.length;
  const tier2FallbackUrls = args.tier2EligibleFields > 0 ? Math.min(5, llmExtractionUrls) : 0;
  return estimateCanaryCost({
    llmExtractionUrls,
    fieldCount: args.llmFieldCount,
    tier2FallbackUrls,
    validationCalls: args.llmFieldCount, // ~1 validation per field
    translationUrls: args.translationCandidateUrls,
    runsDiscovery,
  });
}
