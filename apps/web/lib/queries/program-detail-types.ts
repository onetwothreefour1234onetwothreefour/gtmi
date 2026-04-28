/**
 * Denormalised payload that drives the entire `/programs/[id]` route.
 * Keep this shape stable — the server component, the radar, the accordion,
 * the policy timeline, and the editorial panel all read from a single
 * object, with no further DB round-trips after the initial server fetch.
 */

import type { PillarKey } from '@/lib/theme';
import type { FieldValueStatus } from '@/lib/provenance';

export type PillarScores = Record<PillarKey, number>;

export interface ProgramDetailHeader {
  programId: string;
  programName: string;
  programCategory: string;
  programStatus: string;
  programDescriptionMd: string | null;
  launchYear: number | null;
  closureYear: number | null;
  countryIso: string;
  countryName: string;
  countryRegion: string;
}

export interface ProgramDetailScore {
  composite: number | null;
  cme: number | null;
  paq: number | null;
  pillarScores: PillarScores | null;
  /** Sub-factor scores keyed by sub-factor code (e.g. "A.1", "B.2"). */
  subFactorScores: Record<string, number> | null;
  phase2Placeholder: boolean;
  flaggedInsufficientDisclosure: boolean;
  scoredAt: string | null;
  methodologyVersion: string | null;
}

export interface ProgramDetailLongSummary {
  /** Markdown body (server-rendered to HTML by the page). */
  bodyMd: string | null;
  updatedAt: string | null;
  reviewer: string | null;
}

export interface ProgramDetailFieldValue {
  fieldDefinitionId: string;
  fieldKey: string;
  fieldLabel: string;
  pillar: PillarKey;
  /** Sub-factor code, e.g. "A.1". */
  subFactor: string;
  /** Indicator weight within its sub-factor (0-1). */
  weightWithinSubFactor: number;
  dataType: string;
  normalizationFn: string;
  direction: string;
  valueRaw: string | null;
  valueIndicatorScore: number | null;
  status: FieldValueStatus;
  /** ADR-007 provenance JSONB; consumers run readProvenance() on this. */
  provenance: unknown;
  extractedAt: string | null;
  reviewedAt: string | null;
}

export interface ProgramDetailSource {
  id: string;
  url: string;
  tier: number;
  sourceCategory: string;
  isPrimary: boolean;
  lastScrapedAt: string | null;
}

export interface ProgramDetailPolicyChange {
  id: string;
  detectedAt: string;
  severity: 'minor' | 'material' | 'breaking' | 'url_broken';
  fieldKey: string;
  fieldLabel: string;
  summary: string;
  paqDelta: number | null;
}

export interface ProgramDetail {
  header: ProgramDetailHeader;
  score: ProgramDetailScore | null;
  longSummary: ProgramDetailLongSummary;
  fieldValues: ProgramDetailFieldValue[];
  sources: ProgramDetailSource[];
  policyChanges: ProgramDetailPolicyChange[];
  /**
   * Cohort metadata for the radar overlay. Phase 4.3 reality: 2 scored
   * programs (AUS, SGP). The radar uses this to render the "n=2" caveat.
   */
  cohort: {
    scoredCount: number;
    medianPillarScores: PillarScores | null;
    /** Other scored programs the user can pick from in the "Compare to..." dropdown. */
    compareCandidates: { programId: string; programName: string; pillarScores: PillarScores }[];
  };
}
