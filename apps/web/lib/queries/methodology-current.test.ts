import { describe, it, expect } from 'vitest';
import { groupFieldsByPillar, type FieldDefinitionInput } from './methodology-current-helpers';

function makeField(overrides: Partial<FieldDefinitionInput> = {}): FieldDefinitionInput {
  return {
    key: 'A.1.1',
    label: 'Minimum salary threshold',
    pillar: 'A',
    subFactor: 'A.1',
    weightWithinSubFactor: 0.5,
    dataType: 'numeric',
    normalizationFn: 'z_score',
    direction: 'lower_is_better',
    sourceTierRequired: 1,
    ...overrides,
  };
}

const ALL_PILLAR_WEIGHTS = { A: 0.28, B: 0.15, C: 0.2, D: 0.22, E: 0.15 };

describe('groupFieldsByPillar', () => {
  it('returns five pillar entries in fixed A,B,C,D,E order', () => {
    const out = groupFieldsByPillar([], ALL_PILLAR_WEIGHTS, {});
    expect(out.map((p) => p.key)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('attaches the pillar weight from the methodology_versions payload', () => {
    const out = groupFieldsByPillar([], ALL_PILLAR_WEIGHTS, {});
    expect(out.find((p) => p.key === 'A')?.weightWithinPaq).toBe(0.28);
    expect(out.find((p) => p.key === 'D')?.weightWithinPaq).toBe(0.22);
  });

  it('falls back to 0 when a pillar weight is missing in the payload', () => {
    const out = groupFieldsByPillar([], { A: 0.5 }, {});
    expect(out.find((p) => p.key === 'B')?.weightWithinPaq).toBe(0);
  });

  it('filters out fields with an unknown pillar code', () => {
    const fields = [
      makeField({ pillar: 'A' }),
      makeField({ pillar: 'F', key: 'F.1.1' }),
      makeField({ pillar: 'unknown', key: 'U' }),
    ];
    const out = groupFieldsByPillar(fields, ALL_PILLAR_WEIGHTS, {});
    expect(out.flatMap((p) => p.subFactors).flatMap((sf) => sf.indicators)).toHaveLength(1);
  });

  it('groups indicators by sub-factor and sorts sub-factors lexicographically', () => {
    const fields = [
      makeField({ key: 'A.3.1', subFactor: 'A.3' }),
      makeField({ key: 'A.1.1', subFactor: 'A.1' }),
      makeField({ key: 'A.2.1', subFactor: 'A.2' }),
    ];
    const out = groupFieldsByPillar(fields, ALL_PILLAR_WEIGHTS, {});
    const aPillar = out.find((p) => p.key === 'A')!;
    expect(aPillar.subFactors.map((sf) => sf.code)).toEqual(['A.1', 'A.2', 'A.3']);
  });

  it('attaches sub-factor weights to the right group', () => {
    const fields = [makeField({ subFactor: 'A.1' })];
    const subFactorWeights = { 'A.1': 0.4, 'A.2': 0.35, 'A.3': 0.25 };
    const out = groupFieldsByPillar(fields, ALL_PILLAR_WEIGHTS, subFactorWeights);
    const aPillar = out.find((p) => p.key === 'A')!;
    expect(aPillar.subFactors[0]?.weightWithinPillar).toBe(0.4);
  });

  it('counts indicators per pillar', () => {
    const fields = [
      makeField({ pillar: 'A', key: 'A.1.1', subFactor: 'A.1' }),
      makeField({ pillar: 'A', key: 'A.1.2', subFactor: 'A.1' }),
      makeField({ pillar: 'A', key: 'A.2.1', subFactor: 'A.2' }),
      makeField({ pillar: 'B', key: 'B.1.1', subFactor: 'B.1' }),
    ];
    const out = groupFieldsByPillar(fields, ALL_PILLAR_WEIGHTS, {});
    expect(out.find((p) => p.key === 'A')?.indicatorCount).toBe(3);
    expect(out.find((p) => p.key === 'B')?.indicatorCount).toBe(1);
    expect(out.find((p) => p.key === 'C')?.indicatorCount).toBe(0);
  });

  it('produces the full 45-indicator tree from a methodology-shaped input', () => {
    // Synthetic field set matching the live DB shape: 9 + 7 + 10 + 11 + 8.
    const make = (k: string, p: string, s: string): FieldDefinitionInput =>
      makeField({ key: k, pillar: p, subFactor: s });
    const fields: FieldDefinitionInput[] = [
      // Pillar A — 9 indicators across A.1 (5), A.2 (3), A.3 (1) under methodology v2.0.0
      make('A.1.1', 'A', 'A.1'),
      make('A.1.2', 'A', 'A.1'),
      make('A.1.3', 'A', 'A.1'),
      make('A.1.4', 'A', 'A.1'),
      make('A.1.5', 'A', 'A.1'),
      make('A.2.1', 'A', 'A.2'),
      make('A.2.2', 'A', 'A.2'),
      make('A.2.3', 'A', 'A.2'),
      make('A.3.1', 'A', 'A.3'),
      // Pillar B — 7 indicators across B.1 (2), B.2 (2), B.3 (1), B.4 (2) under methodology v3.0.0
      make('B.1.1', 'B', 'B.1'),
      make('B.1.2', 'B', 'B.1'),
      make('B.2.1', 'B', 'B.2'),
      make('B.2.2', 'B', 'B.2'),
      make('B.3.1', 'B', 'B.3'),
      make('B.4.1', 'B', 'B.4'),
      make('B.4.2', 'B', 'B.4'),
      // Pillar C — 10
      make('C.1.1', 'C', 'C.1'),
      make('C.1.2', 'C', 'C.1'),
      make('C.1.3', 'C', 'C.1'),
      make('C.1.4', 'C', 'C.1'),
      make('C.2.1', 'C', 'C.2'),
      make('C.2.2', 'C', 'C.2'),
      make('C.2.3', 'C', 'C.2'),
      make('C.2.4', 'C', 'C.2'),
      make('C.3.1', 'C', 'C.3'),
      make('C.3.2', 'C', 'C.3'),
      // Pillar D — 11
      make('D.1.1', 'D', 'D.1'),
      make('D.1.2', 'D', 'D.1'),
      make('D.1.3', 'D', 'D.1'),
      make('D.1.4', 'D', 'D.1'),
      make('D.2.1', 'D', 'D.2'),
      make('D.2.2', 'D', 'D.2'),
      make('D.2.3', 'D', 'D.2'),
      make('D.2.4', 'D', 'D.2'),
      make('D.3.1', 'D', 'D.3'),
      make('D.3.2', 'D', 'D.3'),
      make('D.3.3', 'D', 'D.3'),
      // Pillar E — 8
      make('E.1.1', 'E', 'E.1'),
      make('E.1.2', 'E', 'E.1'),
      make('E.1.3', 'E', 'E.1'),
      make('E.2.1', 'E', 'E.2'),
      make('E.2.2', 'E', 'E.2'),
      make('E.2.3', 'E', 'E.2'),
      make('E.3.1', 'E', 'E.3'),
      make('E.3.2', 'E', 'E.3'),
    ];
    const out = groupFieldsByPillar(fields, ALL_PILLAR_WEIGHTS, {});
    const totalIndicators = out.reduce((s, p) => s + p.indicatorCount, 0);
    expect(totalIndicators).toBe(45);
    expect(out.find((p) => p.key === 'A')?.indicatorCount).toBe(9);
    expect(out.find((p) => p.key === 'B')?.indicatorCount).toBe(7);
    expect(out.find((p) => p.key === 'C')?.indicatorCount).toBe(10);
    expect(out.find((p) => p.key === 'D')?.indicatorCount).toBe(11);
    expect(out.find((p) => p.key === 'E')?.indicatorCount).toBe(8);
    // Pillar A/C/D/E each have 3 sub-factors; Pillar B has 4 = 16 sub-factors total.
    const totalSubFactors = out.reduce((s, p) => s + p.subFactors.length, 0);
    expect(totalSubFactors).toBe(16);
  });

  it('preserves indicator order within a sub-factor as inserted', () => {
    const fields = [
      makeField({ key: 'A.1.3', subFactor: 'A.1' }),
      makeField({ key: 'A.1.1', subFactor: 'A.1' }),
      makeField({ key: 'A.1.2', subFactor: 'A.1' }),
    ];
    const out = groupFieldsByPillar(fields, ALL_PILLAR_WEIGHTS, {});
    const a1 = out.find((p) => p.key === 'A')?.subFactors.find((sf) => sf.code === 'A.1');
    expect(a1?.indicators.map((i) => i.key)).toEqual(['A.1.3', 'A.1.1', 'A.1.2']);
  });
});
