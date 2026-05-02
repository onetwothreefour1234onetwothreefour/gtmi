import { describe, expect, it } from 'vitest';
import {
  classifyPolicyChangeSeverity,
  SEVERITY_BREAKING_THRESHOLD,
  SEVERITY_MATERIAL_THRESHOLD,
} from '../src/policy-change-severity';

// Phase 3.10c.2 — severity classifier tests.
//
// Banding behaviour the methodology mandates:
//   Breaking: |Δ PAQ| > 5
//   Material: 1 <= |Δ PAQ| <= 5
//   Minor:    |Δ PAQ| < 1 OR non-scoring field

describe('classifyPolicyChangeSeverity', () => {
  it('Breaking when PAQ delta exceeds 5', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: 56,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('breaking');
    expect(r.paqDelta).toBeCloseTo(6, 5);
    expect(r.reason).toMatch(/above_5/);
  });

  it('Material at the lower edge (delta = 1.0)', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: 51,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('material');
    expect(r.paqDelta).toBeCloseTo(1, 5);
  });

  it('Material at the upper edge (delta = 5.0)', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: 55,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('material');
    expect(r.paqDelta).toBeCloseTo(5, 5);
  });

  it('Minor when PAQ delta is below 1', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: 50.5,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('minor');
    expect(r.paqDelta).toBeCloseTo(0.5, 5);
    expect(r.reason).toMatch(/below_1/);
  });

  it('absolute value handles paqAfter < paqBefore (regressions)', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 60,
      paqAfter: 53,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('breaking');
    expect(r.paqDelta).toBeCloseTo(7, 5);
  });

  it('Minor for non-scoring field changes regardless of PAQ', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: 99,
      scoringFieldChanged: false,
    });
    expect(r.severity).toBe('minor');
    expect(r.paqDelta).toBeNull();
    expect(r.reason).toBe('non_scoring_field');
  });

  it('Minor when paqBefore is null (cannot quantify)', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: null,
      paqAfter: 50,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('minor');
    expect(r.paqDelta).toBeNull();
    expect(r.reason).toBe('paq_unavailable');
  });

  it('Minor when paqAfter is null (cannot quantify)', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: null,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('minor');
    expect(r.paqDelta).toBeNull();
  });

  it('thresholds match the methodology constants', () => {
    expect(SEVERITY_BREAKING_THRESHOLD).toBe(5);
    expect(SEVERITY_MATERIAL_THRESHOLD).toBe(1);
  });

  it('zero delta is Minor', () => {
    const r = classifyPolicyChangeSeverity({
      paqBefore: 50,
      paqAfter: 50,
      scoringFieldChanged: true,
    });
    expect(r.severity).toBe('minor');
    expect(r.paqDelta).toBe(0);
  });
});
