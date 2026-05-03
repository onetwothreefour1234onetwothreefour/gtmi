/**
 * Phase 3.10d / F.1 — per-LLM-call cost instrumentation.
 *
 * Records token usage from every Anthropic `messages.create` response
 * and translates it into a USD estimate using published per-model
 * pricing. Callers wrap their existing API call with `recordLlmCall`:
 *
 *   const response = await client.messages.create({...});
 *   recordLlmCall({
 *     model: response.model,
 *     stage: 'extract',
 *     usage: response.usage,
 *     programId,
 *   });
 *
 * Logs are emitted as structured JSON on `console.info` so Cloud Run
 * → Cloud Logging picks them up under jsonPayload. An in-process
 * aggregator tracks cumulative cost per run for the
 * MAX_COST_PER_PROGRAM_USD guard and the run-summary report.
 *
 * Pricing source: Anthropic API docs as of 2026-04. Update when models
 * are re-priced.
 */

/**
 * Per-million-tokens pricing in USD. Keys are model IDs returned by
 * the Anthropic API. When a model isn't in the map we fall back to
 * Sonnet 4.6 pricing and log a warning so the gap is visible.
 */
export const LLM_PRICING: Record<
  string,
  {
    inputPer1M: number;
    outputPer1M: number;
    cacheReadPer1M: number;
    cacheWritePer1M: number;
  }
> = {
  'claude-sonnet-4-6': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    cacheReadPer1M: 0.3,
    cacheWritePer1M: 3.75,
  },
  'claude-haiku-4-5-20251001': {
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    cacheReadPer1M: 0.1,
    cacheWritePer1M: 1.25,
  },
  'claude-opus-4-7': {
    inputPer1M: 15.0,
    outputPer1M: 75.0,
    cacheReadPer1M: 1.5,
    cacheWritePer1M: 18.75,
  },
};

const FALLBACK_PRICING_KEY = 'claude-sonnet-4-6';

export interface AnthropicUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface LlmCallRecord {
  /** Stage tag — 'discover' | 'extract' | 'validate' | 'cross-check' | 'translate' | 'derive'. Free-form. */
  stage: string;
  /** Anthropic model ID returned from the response. */
  model: string;
  /** The `usage` object from response.usage. */
  usage: AnthropicUsage | null | undefined;
  /** Optional programme id so cost can be attributed in the run summary. */
  programId?: string | null;
  /** Optional field key for indicator-level cost attribution. */
  fieldKey?: string | null;
}

interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  total: number;
}

export function estimateCallCost(model: string, usage: AnthropicUsage | null | undefined): number {
  if (!usage) return 0;
  return computeBreakdown(model, usage).total;
}

function computeBreakdown(model: string, usage: AnthropicUsage): CostBreakdown {
  const pricing = LLM_PRICING[model] ?? LLM_PRICING[FALLBACK_PRICING_KEY]!;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const inputCost = (input * pricing.inputPer1M) / 1_000_000;
  const outputCost = (output * pricing.outputPer1M) / 1_000_000;
  const cacheReadCost = (cacheRead * pricing.cacheReadPer1M) / 1_000_000;
  const cacheWriteCost = (cacheWrite * pricing.cacheWritePer1M) / 1_000_000;
  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    total: inputCost + outputCost + cacheReadCost + cacheWriteCost,
  };
}

interface RunAggregate {
  totalCost: number;
  callCount: number;
  byStage: Record<string, { cost: number; calls: number }>;
  byProgram: Record<string, { cost: number; calls: number }>;
}

const aggregate: RunAggregate = makeEmptyAggregate();

function makeEmptyAggregate(): RunAggregate {
  return { totalCost: 0, callCount: 0, byStage: {}, byProgram: {} };
}

/**
 * Record one LLM call. Emits a structured JSON log line and updates
 * the in-process aggregate. Always returns the cost in USD so callers
 * can pass it through to per-call telemetry without re-deriving it.
 *
 * Disabled when LLM_COST_INSTRUMENTATION=off (escape hatch for
 * environments where the JSON logging is noisy).
 */
export function recordLlmCall(record: LlmCallRecord): number {
  if (process.env['LLM_COST_INSTRUMENTATION'] === 'off') {
    return 0;
  }
  const usage = record.usage ?? null;
  if (!LLM_PRICING[record.model]) {
    console.warn(
      `[llm-cost] unknown model ${record.model} — falling back to ${FALLBACK_PRICING_KEY} pricing`
    );
  }
  const breakdown = computeBreakdown(record.model, usage ?? {});
  const cost = breakdown.total;

  aggregate.totalCost += cost;
  aggregate.callCount += 1;
  const stageBucket = aggregate.byStage[record.stage] ?? { cost: 0, calls: 0 };
  stageBucket.cost += cost;
  stageBucket.calls += 1;
  aggregate.byStage[record.stage] = stageBucket;
  if (record.programId) {
    const programBucket = aggregate.byProgram[record.programId] ?? { cost: 0, calls: 0 };
    programBucket.cost += cost;
    programBucket.calls += 1;
    aggregate.byProgram[record.programId] = programBucket;
  }

  console.info(
    JSON.stringify({
      msg: 'llm.call',
      stage: record.stage,
      model: record.model,
      programId: record.programId ?? null,
      fieldKey: record.fieldKey ?? null,
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
      costUsd: round4(cost),
      breakdown: {
        inputUsd: round4(breakdown.inputCost),
        outputUsd: round4(breakdown.outputCost),
        cacheReadUsd: round4(breakdown.cacheReadCost),
        cacheWriteUsd: round4(breakdown.cacheWriteCost),
      },
    })
  );

  return cost;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Snapshot the in-process aggregate. Useful for run-end summaries. */
export function getRunCostAggregate(): RunAggregate {
  return {
    totalCost: aggregate.totalCost,
    callCount: aggregate.callCount,
    byStage: { ...aggregate.byStage },
    byProgram: { ...aggregate.byProgram },
  };
}

/** Reset the in-process aggregate. Tests use this between runs. */
export function resetRunCostAggregate(): void {
  aggregate.totalCost = 0;
  aggregate.callCount = 0;
  aggregate.byStage = {};
  aggregate.byProgram = {};
}

/**
 * Pretty-print the aggregate for the run-summary stdout block.
 *
 *   Total LLM cost: $0.4231 across 47 calls
 *     extract  : $0.3210 (32 calls)
 *     validate : $0.0840 (10 calls)
 *     ...
 */
export function formatRunCostSummary(): string {
  if (aggregate.callCount === 0) return 'Total LLM cost: $0.0000 (no calls)';
  const stages = Object.entries(aggregate.byStage).sort((a, b) => b[1].cost - a[1].cost);
  const lines = [
    `Total LLM cost: $${round4(aggregate.totalCost).toFixed(4)} across ${aggregate.callCount} calls`,
  ];
  for (const [stage, bucket] of stages) {
    lines.push(
      `  ${stage.padEnd(12)} : $${round4(bucket.cost).toFixed(4)} (${bucket.calls} calls)`
    );
  }
  return lines.join('\n');
}
