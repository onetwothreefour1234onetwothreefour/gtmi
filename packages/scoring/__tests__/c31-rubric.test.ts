import { describe, expect, it } from 'vitest';
import { methodologyV1 } from '@gtmi/db';

// Methodology v4.0.0 / ADR-030 — C.3.1 collapsed to a 3-value rubric
// (full / partial / none). Replaces the v3 8-value rubric with RHCA /
// levy / insurance / emergency_only sub-categories.

describe('C.3.1 rubric — methodology v4.0.0 (Benefits)', () => {
  const c31 = methodologyV1.indicators.find((i) => i.key === 'C.3.1');

  it('C.3.1 indicator present in methodology v1', () => {
    expect(c31).toBeDefined();
  });

  it('label is "Public healthcare access"', () => {
    expect(c31!.label).toBe('Public healthcare access');
  });

  it('rubric uses the new 3-value vocabulary', () => {
    const rubric = c31!.scoringRubricJsonb as { categories: { value: string }[] };
    const values = new Set(rubric.categories.map((c) => c.value));
    expect(values).toEqual(new Set(['full', 'partial', 'none']));
  });

  it('rubric has exactly 3 categories', () => {
    const rubric = c31!.scoringRubricJsonb as { categories: { value: string }[] };
    expect(rubric.categories).toHaveLength(3);
  });

  it('extraction prompt mentions the tier-2 escalation route (C.3.1 is on the tier-2 allowlist)', () => {
    expect(c31!.extractionPromptMd).toMatch(/Tier-2/i);
  });

  it('extraction prompt mentions the surcharge / levy / reciprocal-agreement → partial pattern', () => {
    expect(c31!.extractionPromptMd).toMatch(/surcharge|levy|Reciprocal/i);
  });
});
