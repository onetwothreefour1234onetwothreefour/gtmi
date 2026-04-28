import { describe, expect, it } from 'vitest';
import { methodologyV1 } from '@gtmi/db';

// Phase 3.6.1 / FIX 2 — C.3.1 rubric extension assertions.
// Conservative additive change: existing keys preserved, new keys
// (`automatic`, `conditional_rhca`) added.

describe('C.3.1 rubric — Phase 3.6.1 extension', () => {
  const c31 = methodologyV1.indicators.find((i) => i.key === 'C.3.1');

  it('C.3.1 indicator present in methodology v1', () => {
    expect(c31).toBeDefined();
  });

  it('existing keys preserved (full_access, levy_required, insurance_required, emergency_only, no_access)', () => {
    const rubric = c31!.scoringRubricJsonb as { categories: { value: string; score: number }[] };
    const values = new Set(rubric.categories.map((c) => c.value));
    for (const key of [
      'full_access',
      'levy_required',
      'insurance_required',
      'emergency_only',
      'no_access',
    ]) {
      expect(values.has(key), `existing rubric key "${key}" must remain`).toBe(true);
    }
  });

  it('new key "automatic" present and scored 100 (alias of full_access)', () => {
    const rubric = c31!.scoringRubricJsonb as { categories: { value: string; score: number }[] };
    const automatic = rubric.categories.find((c) => c.value === 'automatic');
    const fullAccess = rubric.categories.find((c) => c.value === 'full_access');
    expect(automatic).toBeDefined();
    expect(automatic!.score).toBe(100);
    expect(automatic!.score).toBe(fullAccess!.score);
  });

  it('new key "conditional_rhca" present and scored 70', () => {
    const rubric = c31!.scoringRubricJsonb as { categories: { value: string; score: number }[] };
    const c = rubric.categories.find((c) => c.value === 'conditional_rhca');
    expect(c).toBeDefined();
    expect(c!.score).toBe(70);
  });

  it('extraction prompt mentions reciprocal/bilateral health agreement pattern', () => {
    expect(c31!.extractionPromptMd).toMatch(/reciprocal|bilateral/i);
  });

  it('extraction prompt mentions not_stated as a sentinel', () => {
    expect(c31!.extractionPromptMd).toMatch(/not_stated/);
  });

  it('extraction prompt does NOT name specific health systems (Medicare/NHS/MediShield)', () => {
    const p = c31!.extractionPromptMd;
    expect(p).not.toMatch(/\bMedicare\b/);
    expect(p).not.toMatch(/\bNHS\b/);
    expect(p).not.toMatch(/\bMediShield\b/);
  });
});
