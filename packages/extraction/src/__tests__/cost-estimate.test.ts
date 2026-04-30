import { describe, expect, it } from 'vitest';
import { COST_MODEL, estimateCanaryCost, planCanaryCost } from '../utils/cost-estimate';
import type { DiscoveredUrl } from '../types/extraction';

describe('estimateCanaryCost', () => {
  it('returns zero total when nothing runs', () => {
    const e = estimateCanaryCost({
      llmExtractionUrls: 0,
      fieldCount: 0,
      runsDiscovery: false,
    });
    expect(e.total).toBe(0);
    expect(e.breakdown.batchExtraction).toBe(0);
    expect(e.warning).toMatch(/Zero LLM extraction work/);
  });

  it('charges discovery when Stage 0 runs', () => {
    const e = estimateCanaryCost({
      llmExtractionUrls: 0,
      fieldCount: 0,
      runsDiscovery: true,
    });
    expect(e.total).toBe(COST_MODEL.perplexityDiscovery);
    expect(e.warning).toBeNull();
  });

  it('charges per LLM-extraction URL × batch cost', () => {
    const e = estimateCanaryCost({
      llmExtractionUrls: 5,
      fieldCount: 30,
      runsDiscovery: true,
    });
    expect(e.breakdown.batchExtraction).toBeCloseTo(5 * COST_MODEL.batchExtraction);
    expect(e.breakdown.validation).toBeCloseTo(30 * COST_MODEL.validation);
  });

  it('warns when total exceeds $10', () => {
    // ~250 URLs × $0.04 = $10. Bump well past to make the assertion robust.
    const e = estimateCanaryCost({
      llmExtractionUrls: 300,
      fieldCount: 100,
      runsDiscovery: true,
    });
    expect(e.total).toBeGreaterThan(10);
    expect(e.warning).toMatch(/exceeds \$10/);
  });

  it('respects optional tier2FallbackUrls + translationUrls', () => {
    const baseline = estimateCanaryCost({
      llmExtractionUrls: 5,
      fieldCount: 10,
      runsDiscovery: false,
    });
    const withFallbacks = estimateCanaryCost({
      llmExtractionUrls: 5,
      fieldCount: 10,
      tier2FallbackUrls: 3,
      translationUrls: 2,
      runsDiscovery: false,
    });
    expect(withFallbacks.total).toBeGreaterThan(baseline.total);
    expect(withFallbacks.breakdown.tier2Fallback).toBeCloseTo(3 * COST_MODEL.tier2Fallback);
    expect(withFallbacks.breakdown.translation).toBeCloseTo(2 * COST_MODEL.translation);
  });
});

describe('planCanaryCost', () => {
  const url = (u: string): DiscoveredUrl => ({
    url: u,
    tier: 1,
    geographicLevel: 'national',
    reason: '',
    isOfficial: true,
  });

  it('subtracts archive hits in archive-first mode', () => {
    const fresh = planCanaryCost({
      mode: 'full',
      mergedUrls: [url('a'), url('b'), url('c')],
      archiveHitUrls: 0,
      llmFieldCount: 30,
      tier2EligibleFields: 0,
      translationCandidateUrls: 0,
    });
    const archived = planCanaryCost({
      mode: 'archive-first',
      mergedUrls: [url('a'), url('b'), url('c')],
      archiveHitUrls: 2,
      llmFieldCount: 30,
      tier2EligibleFields: 0,
      translationCandidateUrls: 0,
    });
    // archive-first only charges for the 1 URL not in archive.
    expect(archived.breakdown.batchExtraction).toBeLessThan(fresh.breakdown.batchExtraction);
  });

  it('disables discovery cost for narrow / gate-failed / rubric-changed / field modes', () => {
    for (const m of ['narrow', 'gate-failed', 'rubric-changed', 'field']) {
      const e = planCanaryCost({
        mode: m,
        mergedUrls: [url('a')],
        archiveHitUrls: 0,
        llmFieldCount: 10,
        tier2EligibleFields: 0,
        translationCandidateUrls: 0,
      });
      expect(e.breakdown.discovery).toBe(0);
    }
  });

  it('archive-only with 100% archive hit produces zero LLM cost', () => {
    const e = planCanaryCost({
      mode: 'archive-only',
      mergedUrls: [url('a'), url('b'), url('c')],
      archiveHitUrls: 3,
      llmFieldCount: 30,
      tier2EligibleFields: 0,
      translationCandidateUrls: 0,
    });
    expect(e.breakdown.batchExtraction).toBe(0);
    // Validation cost depends on field count, not URLs — still has some.
    expect(e.breakdown.validation).toBeGreaterThan(0);
  });
});
