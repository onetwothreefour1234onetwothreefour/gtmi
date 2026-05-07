/**
 * Denormalised payload for /countries/[iso].
 *
 * Carries the country header, the per-program rankings list, and the
 * aggregated tax-treatment summary. All three sections render from this
 * single object — no client round-trip.
 */

import type { PillarKey } from '@/lib/theme';

export interface CountryHeader {
  iso: string;
  name: string;
  region: string;
  imdRank: number | null;
  imdAppealScore: number | null;
  imdAppealScoreCmeNormalized: number | null;
  govPortalUrl: string | null;
  taxAuthorityUrl: string | null;
  lastImdRefresh: string | null;
  /** MAX(field_values.extracted_at) across all this country's programs. */
  lastVerifiedAt: string | null;
  /** Distinct sources tracked across this country's programs. */
  sourcesTracked: number;
}

export interface CountryProgramRow {
  programId: string;
  programName: string;
  programCategory: string;
  programStatus: string;
  composite: number | null;
  paq: number | null;
  pillarScores: Record<PillarKey, number> | null;
  fieldsPopulated: number;
  fieldsTotal: number;
  phase2Placeholder: boolean;
}

// CountryTaxTreatment removed in methodology v5.0.0 (ADR-031). Tax
// indicators (D.3.1, D.3.2, D.3.3) are no longer part of the GTMI
// methodology; the tax-treatment widget on /countries/[iso] is gone.

export interface CountryDetail {
  header: CountryHeader;
  programs: CountryProgramRow[];
}
