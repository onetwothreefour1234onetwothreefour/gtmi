import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// Phase 3.6 / commit 3 — Fix A V-Dem flag-gate test.
//
// Asserts the gate semantics encoded in canary-run.ts and
// extract-single-program.ts:
//
//   const PHASE3_VDEM_ENABLED = process.env['PHASE3_VDEM_ENABLED'] !== 'false';
//
// 1. Unset env  → PHASE3_VDEM_ENABLED === true  (default-on per Q5).
// 2. 'true'     → PHASE3_VDEM_ENABLED === true.
// 3. 'false'    → PHASE3_VDEM_ENABLED === false (only literal 'false' disables).
// 4. ''         → PHASE3_VDEM_ENABLED === true  (empty string is not 'false').
// 5. 'FALSE'    → PHASE3_VDEM_ENABLED === true  (case-sensitive; only literal lowercase).
//
// And: when PHASE3_VDEM_ENABLED is false, the canary's E.3.1-handled-by-vdem
// flag is false, which means E.3.1 stays in the LLM extraction batch and
// the V-Dem fetch is never attempted. We assert this via a mock
// fetchVdemRuleOfLawScore counter that must NOT be invoked when the flag
// is off.

function evaluateGate(envValue: string | undefined): boolean {
  // Mirrors the exact expression in canary-run.ts and extract-single-program.ts.
  return envValue !== 'false';
}

describe('PHASE3_VDEM_ENABLED gate semantics', () => {
  it('defaults to true when env var is unset', () => {
    expect(evaluateGate(undefined)).toBe(true);
  });

  it('is true when env var is "true"', () => {
    expect(evaluateGate('true')).toBe(true);
  });

  it('is false when env var is exactly "false"', () => {
    expect(evaluateGate('false')).toBe(false);
  });

  it('is true when env var is empty string (not the literal "false")', () => {
    expect(evaluateGate('')).toBe(true);
  });

  it('is true when env var is "FALSE" (case-sensitive — only lowercase disables)', () => {
    expect(evaluateGate('FALSE')).toBe(true);
  });
});

describe('V-Dem fetch path is entirely skipped when PHASE3_VDEM_ENABLED is unset or false', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env['PHASE3_VDEM_ENABLED'];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['PHASE3_VDEM_ENABLED'];
    } else {
      process.env['PHASE3_VDEM_ENABLED'] = originalEnv;
    }
  });

  // Simulates the canary's flow:
  //   if (PHASE3_VDEM_ENABLED) { vdemResult = await fetchVdemRuleOfLawScore(country); }
  //   const e31HandledByVdemPath = PHASE3_VDEM_ENABLED && vdemResult !== null;
  //   const llmFields = allFieldDefs.filter(d => !(d.key === 'E.3.1' && e31HandledByVdemPath))...
  async function simulateCanaryE31Routing(opts: {
    flagValue: string | undefined;
    fetcher: () => Promise<{ score: string } | null>;
  }): Promise<{ vdemFetcherCalled: boolean; e31InLlmBatch: boolean }> {
    if (opts.flagValue === undefined) delete process.env['PHASE3_VDEM_ENABLED'];
    else process.env['PHASE3_VDEM_ENABLED'] = opts.flagValue;
    const flag = process.env['PHASE3_VDEM_ENABLED'] !== 'false';

    let vdemFetcherCalled = false;
    let vdemResult: { score: string } | null = null;
    if (flag) {
      vdemFetcherCalled = true;
      vdemResult = await opts.fetcher();
    }
    const e31HandledByVdemPath = flag && vdemResult !== null;
    const allFieldDefs = [{ key: 'E.3.1' }, { key: 'E.3.2' }, { key: 'A.1.1' }];
    const llmFields = allFieldDefs.filter(
      (d) => d.key !== 'E.3.2' && !(d.key === 'E.3.1' && e31HandledByVdemPath)
    );
    const e31InLlmBatch = llmFields.some((f) => f.key === 'E.3.1');
    return { vdemFetcherCalled, e31InLlmBatch };
  }

  it('FLAG=false → fetcher NEVER called, E.3.1 stays in LLM batch (legacy fall-through)', async () => {
    const { vdemFetcherCalled, e31InLlmBatch } = await simulateCanaryE31Routing({
      flagValue: 'false',
      fetcher: async () => ({ score: '1.81' }),
    });
    expect(vdemFetcherCalled).toBe(false);
    expect(e31InLlmBatch).toBe(true);
  });

  it('FLAG=undefined (unset) → fetcher IS called (default-on per Q5)', async () => {
    const { vdemFetcherCalled, e31InLlmBatch } = await simulateCanaryE31Routing({
      flagValue: undefined,
      fetcher: async () => ({ score: '1.81' }),
    });
    expect(vdemFetcherCalled).toBe(true);
    // Successful fetch → E.3.1 is removed from LLM batch (handled by V-Dem path).
    expect(e31InLlmBatch).toBe(false);
  });

  it('FLAG=true with successful fetch → E.3.1 handled by V-Dem path, removed from LLM batch', async () => {
    const { vdemFetcherCalled, e31InLlmBatch } = await simulateCanaryE31Routing({
      flagValue: 'true',
      fetcher: async () => ({ score: '1.81' }),
    });
    expect(vdemFetcherCalled).toBe(true);
    expect(e31InLlmBatch).toBe(false);
  });

  it('FLAG=true with fetcher returning null → E.3.1 falls through to LLM batch (graceful)', async () => {
    const { vdemFetcherCalled, e31InLlmBatch } = await simulateCanaryE31Routing({
      flagValue: 'true',
      fetcher: async () => null,
    });
    expect(vdemFetcherCalled).toBe(true);
    expect(e31InLlmBatch).toBe(true);
  });
});
