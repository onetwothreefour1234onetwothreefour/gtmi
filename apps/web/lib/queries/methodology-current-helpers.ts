/**
 * Pure helpers used by the /methodology query. Split out so the test
 * suite can import without dragging in 'server-only'.
 */

import type { PillarKey } from '@/lib/theme';
import type {
  MethodologyIndicator,
  MethodologyPillar,
  MethodologySubFactor,
} from './methodology-current-types';

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

export interface FieldDefinitionInput {
  key: string;
  label: string;
  pillar: string;
  subFactor: string;
  weightWithinSubFactor: number;
  dataType: string;
  normalizationFn: string;
  direction: string;
  sourceTierRequired: number;
}

function isPillarKey(s: string): s is PillarKey {
  return s === 'A' || s === 'B' || s === 'C' || s === 'D' || s === 'E';
}

/**
 * Group field definitions into the pillar → sub-factor → indicator tree,
 * applying pillar and sub-factor weights from the methodology_versions
 * payload. Pillar order is fixed at A,B,C,D,E so the page can render
 * deterministically regardless of insertion order in the DB.
 */
export function groupFieldsByPillar(
  fields: FieldDefinitionInput[],
  pillarWeights: Record<string, number>,
  subFactorWeights: Record<string, number>
): MethodologyPillar[] {
  const valid = fields.filter((f) => isPillarKey(f.pillar));
  return PILLAR_ORDER.map((pk) => {
    const fieldsForPillar = valid.filter((f) => f.pillar === pk);
    const subFactorMap = new Map<string, MethodologyIndicator[]>();
    for (const f of fieldsForPillar) {
      const arr = subFactorMap.get(f.subFactor);
      const indicator: MethodologyIndicator = {
        key: f.key,
        label: f.label,
        pillar: pk,
        subFactor: f.subFactor,
        weightWithinSubFactor: f.weightWithinSubFactor,
        dataType: f.dataType,
        normalizationFn: f.normalizationFn,
        direction: f.direction,
        sourceTierRequired: f.sourceTierRequired,
      };
      if (arr) arr.push(indicator);
      else subFactorMap.set(f.subFactor, [indicator]);
    }
    const subFactors: MethodologySubFactor[] = Array.from(subFactorMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, indicators]) => ({
        code,
        weightWithinPillar: subFactorWeights[code] ?? 0,
        indicators,
      }));
    return {
      key: pk,
      weightWithinPaq: pillarWeights[pk] ?? 0,
      subFactors,
      indicatorCount: fieldsForPillar.length,
    };
  });
}
