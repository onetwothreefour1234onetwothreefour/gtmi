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

/**
 * Tax treatment aggregated across programs in this country.
 * Reads D.3.3 (territorial vs worldwide) and D.3.2 (special regime
 * available) from the field_values rows. When no approved values exist
 * for the relevant indicators, both fields are null and the page renders
 * the "Data not yet collected" placeholder.
 */
export interface CountryTaxTreatment {
  /**
   * Distribution of D.3.3 raw values across the country's programmes.
   * E.g. { territorial: 2, worldwide: 1 } when 3 programmes have a
   * D.3.3 value extracted. Null when no programmes have a D.3.3 value.
   */
  taxationModel: Record<string, number> | null;
  /**
   * Distribution of D.3.2 raw values. Null when no programmes have it.
   */
  specialRegime: Record<string, number> | null;
  /** Total programmes in this country (for the "n of N have data" line). */
  totalProgramsInCountry: number;
}

export interface CountryDetail {
  header: CountryHeader;
  programs: CountryProgramRow[];
  tax: CountryTaxTreatment;
}
