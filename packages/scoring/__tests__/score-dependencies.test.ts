import { describe, expect, it } from 'vitest';
import { runScoringEngine, scoreSingleIndicator } from '../src/engine';
import { SCORE_DEPENDENCIES } from '../src/score-dependencies';
import { normalizeRawValue } from '../src/normalize-raw';
import { isNotApplicableMarker } from '../src/sentinels';
import type { FieldDefinitionRecord, FieldValueRecord, ScoringInput } from '../src/types';

// Methodology v5.0.0 / ADR-031 — conditional zero-scoring for
// pathway-dependent numerics. SCORE_DEPENDENCIES forces D.1.2 → 0
// when D.1.1 = false, and D.2.2 → 0 when D.2.1 = false. The dispatch
// also requires virtual zero synthesis: a child with no field_values
// row at all still scores 0 if the parent gate fires.

const SCORED_AT = new Date('2026-05-06T00:00:00.000Z');

describe('SCORE_DEPENDENCIES — config sanity', () => {
  it('contains exactly the two Pillar D pathway-dependent numerics', () => {
    expect(Object.keys(SCORE_DEPENDENCIES).sort()).toEqual(['D.1.2', 'D.2.2']);
  });

  it('every entry gates on parent === false → score 0', () => {
    for (const dep of Object.values(SCORE_DEPENDENCIES)) {
      expect(dep.whenParentIs).toBe(false);
      expect(dep.score).toBe(0);
    }
  });
});

describe('scoreSingleIndicator — conditional zero (parent boolean explicit)', () => {
  function defOf(key: string, normalizationFn: 'min_max' | 'boolean'): FieldDefinitionRecord {
    return {
      id: 'def-' + key,
      key,
      label: key,
      pillar: key.charAt(0),
      subFactor: key.slice(0, 3),
      weightWithinSubFactor: 0.5,
      direction: 'lower_is_better',
      normalizationFn,
      scoringRubricJsonb: null,
    } as FieldDefinitionRecord;
  }

  it('D.1.2 with parentValue=false → score 0 regardless of child value', () => {
    const score = scoreSingleIndicator({
      fieldDefinition: defOf('D.1.2', 'min_max'),
      valueNormalized: 5,
      normalizationParams: { 'D.1.2': { min: 0, max: 50 } },
      parentValue: false,
    });
    expect(score).toBe(0);
  });

  it('D.1.2 with parentValue=false ignores even the notApplicable marker', () => {
    const score = scoreSingleIndicator({
      fieldDefinition: defOf('D.1.2', 'min_max'),
      valueNormalized: { notApplicable: true, reason: 'pathway unavailable' },
      normalizationParams: { 'D.1.2': { min: 0, max: 50 } },
      parentValue: false,
    });
    expect(score).toBe(0);
  });

  it('D.1.2 with parentValue=true scores normally via min_max', () => {
    const score = scoreSingleIndicator({
      fieldDefinition: defOf('D.1.2', 'min_max'),
      valueNormalized: 5,
      normalizationParams: { 'D.1.2': { min: 0, max: 50 } },
      parentValue: true,
    });
    // 5 within [0..50] lower_is_better → (50 - 5) / 50 * 100 = 90
    expect(score).toBe(90);
  });

  it('D.1.2 with parentValue=undefined falls back to legacy behaviour', () => {
    // No parent context (e.g. /review action that didn't fetch the
    // parent). The dependency check skips; child scores normally.
    const score = scoreSingleIndicator({
      fieldDefinition: defOf('D.1.2', 'min_max'),
      valueNormalized: 5,
      normalizationParams: { 'D.1.2': { min: 0, max: 50 } },
    });
    expect(score).toBe(90);
  });

  it('D.2.2 with parentValue=false → score 0', () => {
    const score = scoreSingleIndicator({
      fieldDefinition: defOf('D.2.2', 'min_max'),
      valueNormalized: 7,
      normalizationParams: { 'D.2.2': { min: 0, max: 50 } },
      parentValue: false,
    });
    expect(score).toBe(0);
  });

  it('A non-dependent key (e.g. C.2.2) ignores parentValue entirely', () => {
    const score = scoreSingleIndicator({
      fieldDefinition: defOf('C.2.2', 'min_max'),
      valueNormalized: 18,
      normalizationParams: { 'C.2.2': { min: 0, max: 30 } },
      parentValue: false, // ignored — C.2.2 has no SCORE_DEPENDENCIES entry
    });
    // 18 within [0..30] lower_is_better → (30 - 18) / 30 * 100 = 40
    expect(score).toBe(40);
  });
});

describe('normalizeRawValue — "not_applicable" token (ADR-031)', () => {
  function minMaxDef() {
    return { normalizationFn: 'min_max', scoringRubricJsonb: null };
  }

  it('converts "not_applicable" to the notApplicable marker for min_max fields', () => {
    const result = normalizeRawValue('not_applicable', minMaxDef());
    expect(isNotApplicableMarker(result)).toBe(true);
    expect((result as { reason: string }).reason).toBe('pathway unavailable');
  });

  it('accepts the token regardless of casing or surrounding whitespace', () => {
    const r1 = normalizeRawValue('  Not_Applicable  ', minMaxDef());
    const r2 = normalizeRawValue('NOT_APPLICABLE', minMaxDef());
    expect(isNotApplicableMarker(r1)).toBe(true);
    expect(isNotApplicableMarker(r2)).toBe(true);
  });

  it('still throws for genuinely unparseable strings', () => {
    expect(() => normalizeRawValue('not a number', minMaxDef())).toThrow(/Cannot parse/);
  });
});

describe('runScoringEngine — virtual zero synthesis (ADR-031)', () => {
  const D11_DEF: FieldDefinitionRecord = {
    id: 'def-d11',
    key: 'D.1.1',
    pillar: 'D',
    subFactor: 'D.1',
    weightWithinSubFactor: 0.5,
    normalizationFn: 'boolean',
    direction: 'higher_is_better',
    scoringRubricJsonb: null,
  };

  const D12_DEF: FieldDefinitionRecord = {
    id: 'def-d12',
    key: 'D.1.2',
    pillar: 'D',
    subFactor: 'D.1',
    weightWithinSubFactor: 0.5,
    normalizationFn: 'min_max',
    direction: 'lower_is_better',
    scoringRubricJsonb: null,
  };

  function buildInput(fvs: FieldValueRecord[]): ScoringInput {
    return {
      programId: 'prog-test',
      methodologyVersionId: 'meth-5',
      scoredAt: SCORED_AT,
      cmeScore: 50,
      fieldDefinitions: [D11_DEF, D12_DEF],
      fieldValues: fvs,
      normalizationParams: { 'D.1.2': { min: 0, max: 50 } },
    };
  }

  it('synthesises a virtual 0 for D.1.2 when D.1.1=false and D.1.2 has NO field_values row', () => {
    // Parent gate fires; child is missing entirely. Engine still
    // produces a 0 score for the child instead of skipping it.
    const fvs: FieldValueRecord[] = [
      {
        id: 'fv-d11',
        fieldDefinitionId: 'def-d11',
        valueNormalized: false,
        status: 'approved',
      },
    ];
    const out = runScoringEngine(buildInput(fvs));
    // D.1.1=false → 0 (boolean, higher_is_better, false=0).
    // D.1.2 missing → synthesised as 0 by the dependency rule.
    // sub-factor average = (0 + 0) / 2 = 0.
    expect(out.subFactorScores['D.1']).toBe(0);
  });

  it('does NOT synthesise when D.1.1 is missing entirely (parent gate cannot fire)', () => {
    // No D.1.1 row at all → parent gate doesn't fire → child is just
    // missing → excluded from cohort scoring (legacy behaviour).
    const fvs: FieldValueRecord[] = [];
    const out = runScoringEngine(buildInput(fvs));
    // Both indicators missing → sub-factor 0 with full coverage penalty
    // (existing all-missing path).
    expect(out.subFactorScores['D.1']).toBe(0);
  });

  it('does NOT synthesise when D.1.1 is true (parent gate stays open)', () => {
    // Parent says PR pathway exists but child is missing → child is
    // excluded normally (no synthesis). The existing missing-data
    // sqrt penalty (Phase 3.5) reduces the single-present value of
    // 100 to 100 / sqrt(2) ≈ 70.71. The key invariant is that the
    // child was NOT synthesised as 0 — a synthesised 0 would drop
    // the sub-factor to (100 + 0) / 2 = 50 with no penalty.
    const fvs: FieldValueRecord[] = [
      {
        id: 'fv-d11',
        fieldDefinitionId: 'def-d11',
        valueNormalized: true,
        status: 'approved',
      },
    ];
    const out = runScoringEngine(buildInput(fvs));
    expect(out.subFactorScores['D.1']).toBeGreaterThan(50);
    expect(out.subFactorScores['D.1']).toBeLessThanOrEqual(100);
  });

  it('uses the present child score when both D.1.1 and D.1.2 are populated', () => {
    const fvs: FieldValueRecord[] = [
      {
        id: 'fv-d11',
        fieldDefinitionId: 'def-d11',
        valueNormalized: true,
        status: 'approved',
      },
      {
        id: 'fv-d12',
        fieldDefinitionId: 'def-d12',
        valueNormalized: 5,
        status: 'approved',
      },
    ];
    const out = runScoringEngine(buildInput(fvs));
    // D.1.1=true → 100. D.1.2=5 within [0..50] lower_is_better → 90.
    // Sub-factor average = (100 + 90) / 2 = 95.
    expect(out.subFactorScores['D.1']).toBe(95);
  });

  it('overrides the present child score when parent fires (parent=false beats child=5)', () => {
    const fvs: FieldValueRecord[] = [
      {
        id: 'fv-d11',
        fieldDefinitionId: 'def-d11',
        valueNormalized: false,
        status: 'approved',
      },
      {
        id: 'fv-d12',
        fieldDefinitionId: 'def-d12',
        valueNormalized: 5, // ignored
        status: 'approved',
      },
    ];
    const out = runScoringEngine(buildInput(fvs));
    // D.1.1=false → 0. D.1.2=5 IGNORED, scored as 0 by dependency override.
    // Sub-factor average = (0 + 0) / 2 = 0.
    expect(out.subFactorScores['D.1']).toBe(0);
  });
});
