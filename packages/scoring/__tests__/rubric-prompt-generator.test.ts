import { describe, expect, it } from 'vitest';
import { renderAllowedValues, withRubricVocab, methodologyV2 } from '@gtmi/db';

// Phase 3.8 / P0.5 — the rubric-driven prompt generator must produce
// an "Allowed values:" block whose tokens equal the rubric vocabulary
// exactly. These tests guard against drift in the generator itself
// (the drift test in rubric-prompt-drift.test.ts already guards
// generator *consumers*).

const SAMPLE_RUBRIC = {
  categories: [
    { value: 'automatic', score: 100, description: 'best case' },
    { value: 'fee_paying', score: 40, description: 'pay-to-access' },
    { value: 'none', score: 0, description: 'no access' },
  ],
};

describe('renderAllowedValues', () => {
  it('renders one quoted token per rubric category', () => {
    const out = renderAllowedValues(SAMPLE_RUBRIC);
    expect(out.startsWith('Allowed values:\n\n')).toBe(true);
    expect(out).toContain('"automatic": best case');
    expect(out).toContain('"fee_paying": pay-to-access');
    expect(out).toContain('"none": no access');
  });

  it('preserves rubric order', () => {
    const out = renderAllowedValues(SAMPLE_RUBRIC);
    const ai = out.indexOf('"automatic"');
    const fi = out.indexOf('"fee_paying"');
    const ni = out.indexOf('"none"');
    expect(ai).toBeLessThan(fi);
    expect(fi).toBeLessThan(ni);
  });

  it('handles missing description as empty string (no "undefined")', () => {
    const out = renderAllowedValues({
      categories: [{ value: 'plain', score: 50 }],
    });
    expect(out).not.toContain('undefined');
    expect(out).toContain('"plain": ');
  });
});

describe('withRubricVocab', () => {
  it('substitutes the {{ALLOWED_VALUES}} marker with the rendered block', () => {
    const out = withRubricVocab(
      'TEST.1',
      SAMPLE_RUBRIC,
      `Extraction Task: example
Question: pick one.

{{ALLOWED_VALUES}}

Edge cases: none.`
    );
    expect(out).toContain('Allowed values:');
    expect(out).toContain('"automatic": best case');
    expect(out).not.toContain('{{ALLOWED_VALUES}}');
    // Preamble (Context / Required fields / Universal rules) is prefixed.
    expect(out.includes('Context')).toBe(true);
  });

  it('throws when the marker is absent (typo prevention)', () => {
    expect(() =>
      withRubricVocab('TEST.2', SAMPLE_RUBRIC, 'Extraction Task: oops, forgot the marker.')
    ).toThrowError(/missing the.*marker/);
  });
});

describe('integration: C.3.2 v2 prompt is generator-built', () => {
  it('contains every C.3.2 rubric value in its "Allowed values" block', () => {
    const ind = methodologyV2.indicators.find((i) => i.key === 'C.3.2')!;
    const cats = (ind.scoringRubricJsonb as { categories: Array<{ value: string }> }).categories;
    for (const c of cats) {
      expect(ind.extractionPromptMd).toContain(`"${c.value}":`);
    }
  });
});
