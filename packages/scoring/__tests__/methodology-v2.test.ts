import { describe, expect, it } from 'vitest';
import {
  methodologyV1,
  methodologyV2,
  PHASE_3_5_INDICATOR_RESTRUCTURES,
  PHASE_3_5_RESTRUCTURED_KEYS,
} from '@gtmi/db';

// Phase 3.5 / ADR-014 — Methodology V2 weight-sum & restructure invariants.

const EPSILON = 0.0001;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

describe('Methodology V2 — arithmetic invariants (must match V1)', () => {
  it('pillar_weights sum to 1.0', () => {
    const sum = Object.values(methodologyV2.pillar_weights).reduce((a, b) => a + b, 0);
    expect(approxEqual(sum, 1.0)).toBe(true);
  });

  it('within each pillar, sub_factor_weights sum to 1.0', () => {
    const pillars = Object.keys(methodologyV2.framework_structure);
    for (const pillar of pillars) {
      const subFactors = Object.keys(
        (methodologyV2.framework_structure as Record<string, Record<string, string[]>>)[pillar]!
      );
      let sum = 0;
      for (const sf of subFactors) {
        sum += (methodologyV2.sub_factor_weights as Record<string, number>)[sf]!;
      }
      expect(approxEqual(sum, 1.0)).toBe(true);
    }
  });

  it('within each sub_factor, indicator_weights sum to 1.0', () => {
    const subFactors = Object.keys(methodologyV2.sub_factor_weights);
    for (const sf of subFactors) {
      const indicatorKeys = methodologyV2.indicators
        .filter((i) => i.subFactor === sf)
        .map((i) => i.key);
      let sum = 0;
      for (const key of indicatorKeys) {
        sum += (methodologyV2.indicator_weights as Record<string, number>)[key]!;
      }
      expect(approxEqual(sum, 1.0)).toBe(true);
    }
  });

  it('cme_paq_split sums to 1.0', () => {
    const sum = methodologyV2.cme_paq_split.cme + methodologyV2.cme_paq_split.paq;
    expect(approxEqual(sum, 1.0)).toBe(true);
  });

  it('total indicator count is exactly 45 (unchanged from v1; methodology v3.0.0)', () => {
    expect(methodologyV2.indicators.length).toBe(45);
  });

  it('every v1 indicator weight is preserved in v2 (Phase 3.5 changes data-type only)', () => {
    for (const v1ind of methodologyV1.indicators) {
      const v2ind = methodologyV2.indicators.find((i) => i.key === v1ind.key);
      expect(v2ind).toBeDefined();
      expect(v2ind!.weightWithinSubFactor).toBe(v1ind.weightWithinSubFactor);
      expect(v2ind!.subFactor).toBe(v1ind.subFactor);
      expect(v2ind!.pillar).toBe(v1ind.pillar);
    }
  });
});

describe('Methodology V2 — Phase 3.5 indicator restructures', () => {
  it('PHASE_3_5_RESTRUCTURED_KEYS contains exactly 3 entries (methodology v3.0.0; B.2.3/B.2.4 retired)', () => {
    expect(PHASE_3_5_RESTRUCTURED_KEYS).toEqual(['D.1.3', 'D.1.4', 'C.3.2']);
  });

  it('D.1.3 / D.1.4 use boolean_with_annotation + lower_is_better', () => {
    for (const k of ['D.1.3', 'D.1.4']) {
      const ind = methodologyV2.indicators.find((i) => i.key === k);
      expect(ind).toBeDefined();
      expect(ind!.normalizationFn).toBe('boolean_with_annotation');
      expect(ind!.direction).toBe('lower_is_better');
      expect(ind!.dataType).toBe('json');
    }
  });

  it('C.3.2 uses country_substitute_regional + higher_is_better + categorical dataType', () => {
    const ind = methodologyV2.indicators.find((i) => i.key === 'C.3.2');
    expect(ind).toBeDefined();
    expect(ind!.normalizationFn).toBe('country_substitute_regional');
    expect(ind!.direction).toBe('higher_is_better');
    expect(ind!.dataType).toBe('categorical');
  });

  it('every restructured indicator has a non-null scoringRubricJsonb', () => {
    for (const k of PHASE_3_5_RESTRUCTURED_KEYS) {
      const ind = methodologyV2.indicators.find((i) => i.key === k);
      expect(ind!.scoringRubricJsonb).toBeTruthy();
    }
  });

  it('non-restructured indicators retain v1 normalizationFn', () => {
    for (const v1ind of methodologyV1.indicators) {
      if (PHASE_3_5_RESTRUCTURED_KEYS.includes(v1ind.key)) continue;
      const v2ind = methodologyV2.indicators.find((i) => i.key === v1ind.key);
      expect(v2ind!.normalizationFn).toBe(v1ind.normalizationFn);
      expect(v2ind!.dataType).toBe(v1ind.dataType);
      expect(v2ind!.direction).toBe(v1ind.direction);
    }
  });

  it('PHASE_3_5_INDICATOR_RESTRUCTURES extractionPromptMd is non-empty per restructured field', () => {
    for (const k of PHASE_3_5_RESTRUCTURED_KEYS) {
      const r = PHASE_3_5_INDICATOR_RESTRUCTURES[k]!;
      expect(r.extractionPromptMd.length).toBeGreaterThan(100);
    }
  });

  it('version_tag bumped to 2.0.0', () => {
    expect(methodologyV2.version_tag).toBe('2.0.0');
  });
});
