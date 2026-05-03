/**
 * Shared types for the public-dashboard query layer.
 *
 * All query functions return these denormalised shapes — never the raw
 * Drizzle row types — so the UI doesn't have to remember which JSONB key
 * lives where, and so the JSON serialisation boundary between server
 * components and client components stays clean.
 */

import type { PillarKey } from '@/lib/theme';

export type PillarScores = Record<PillarKey, number>;

/** One row in the rankings table. */
export interface RankedProgramRow {
  programId: string;
  programName: string;
  programCategory: string;
  programStatus: string;

  countryIso: string;
  countryName: string;
  countryRegion: string;

  /** Latest scores row, or null when the program has never been scored. */
  composite: number | null;
  cme: number | null;
  paq: number | null;
  /** Per-pillar PAQ scores, null when unscored. */
  pillarScores: PillarScores | null;
  /** Sum of approved field_values for the program; null when unscored. */
  fieldsPopulated: number;
  /** Always 48 (full methodology). */
  fieldsTotal: number;
  /** True when the latest scores.metadata.phase2Placeholder is true. */
  phase2Placeholder: boolean;
  /** True when the latest scores.flagged_insufficient_disclosure is true. */
  flaggedInsufficientDisclosure: boolean;
  /** Latest scored_at, or null. Used for the "trend" sparkline (single point in 4.2). */
  scoredAt: string | null;
  /**
   * Phase 3.10d / E.1 — recent composite-score history (oldest → newest, up
   * to ~12 points). Empty array when score_history has < 2 rows for this
   * programme; rankings UI falls back to the deterministic placeholder.
   */
  scoreHistory: number[];
  /** Latest extracted_at across this program's field_values. */
  lastVerifiedAt: string | null;
  /** Optional ts_rank score from FTS — present only when the query carries a search term. */
  searchRank?: number | null;
}

export type SortField = 'composite' | 'paq' | 'cme' | 'name' | 'country' | 'coverage';
export type SortDirection = 'asc' | 'desc';

export interface RankedProgramsFilters {
  countryIsos?: string[];
  regions?: string[];
  categories?: string[];
  /** Min/max composite-score range (null disables a side). */
  scoreRange?: [number | null, number | null];
  scoredOnly?: boolean;
  /** Free-text search — see `lib/queries/search.ts`. */
  search?: string;
}

export interface RankedProgramsQuery {
  filters?: RankedProgramsFilters;
  sort?: { field: SortField; direction: SortDirection };
  limit?: number;
  offset?: number;
}

export interface RankedProgramsResult {
  rows: RankedProgramRow[];
  totalCount: number;
  scoredCount: number;
  /** Distinct facet values for the filter chips. */
  facets: {
    countries: { iso: string; name: string; region: string }[];
    regions: string[];
    categories: string[];
  };
}
