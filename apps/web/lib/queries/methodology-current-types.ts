/**
 * Shapes for the public /methodology page.
 *
 * The page renders entirely from these types — every weight, every
 * indicator, every normalisation choice arrives in a single payload.
 * No component reaches into the database directly; no weight is
 * hardcoded. When the methodology version increments, the page
 * re-renders against the new payload with zero code change.
 */

import type { PillarKey } from '@/lib/theme';

export interface MethodologyIndicator {
  key: string;
  label: string;
  pillar: PillarKey;
  subFactor: string;
  weightWithinSubFactor: number;
  dataType: string;
  normalizationFn: string;
  direction: string;
  sourceTierRequired: number;
}

export interface MethodologySubFactor {
  code: string;
  weightWithinPillar: number;
  indicators: MethodologyIndicator[];
}

export interface MethodologyPillar {
  key: PillarKey;
  weightWithinPaq: number;
  subFactors: MethodologySubFactor[];
  indicatorCount: number;
}

export interface MethodologyVersionEntry {
  versionTag: string;
  publishedAt: string | null;
  changeNotes: string | null;
}

export interface MethodologyCurrent {
  versionTag: string;
  publishedAt: string | null;
  cmePaqSplit: { cme: number; paq: number };
  pillars: MethodologyPillar[];
  history: MethodologyVersionEntry[];
}
