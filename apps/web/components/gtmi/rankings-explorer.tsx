'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RankingsFilters } from './rankings-filters';
import { RankingsTable } from './rankings-table';
import { AdvisorModeToggle } from './advisor-mode-toggle';
import type {
  RankedProgramRow,
  RankedProgramsFilters,
  SortDirection,
  SortField,
} from '@/lib/queries/types';
import type { PillarWeights } from '@/lib/advisor-mode';

export interface RankingsExplorerProps {
  /** Initial server-rendered rows for first paint. */
  rows: RankedProgramRow[];
  totalCount: number;
  scoredCount: number;
  facets: {
    countries: { iso: string; name: string; region: string }[];
    regions: string[];
    categories: string[];
  };
  /** Initial filter state derived from URL params on the server. */
  initialFilters: RankedProgramsFilters;
  /** Initial sort. */
  initialSort: { field: SortField; direction: SortDirection };
  /** Pathname this component lives on — `/` or `/programs`. Used for URL sync. */
  basePath: '/' | '/programs';
}

function filtersToSearchParams(
  filters: RankedProgramsFilters,
  sort: { field: SortField; direction: SortDirection }
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.countryIsos && filters.countryIsos.length > 0) {
    sp.set('country', filters.countryIsos.join(','));
  }
  if (filters.regions && filters.regions.length > 0) {
    sp.set('region', filters.regions.join(','));
  }
  if (filters.categories && filters.categories.length > 0) {
    sp.set('cat', filters.categories.join(','));
  }
  if (filters.scoredOnly) sp.set('scored', '1');
  if (filters.scoreRange) {
    const [min, max] = filters.scoreRange;
    if (min !== null && min !== undefined) sp.set('min', String(min));
    if (max !== null && max !== undefined) sp.set('max', String(max));
  }
  if (filters.search && filters.search.trim()) sp.set('q', filters.search);
  if (sort.field !== 'composite' || sort.direction !== 'desc') {
    sp.set('sort', sort.field);
    sp.set('dir', sort.direction);
  }
  return sp;
}

/**
 * Client orchestrator that wires the filters, advisor toggle, and rankings
 * table into a single interactive surface. Holds the filter + sort + advisor
 * weight state and pushes filter/sort changes through the URL so the server
 * component can re-render on navigation.
 *
 * Advisor weights stay client-only (no URL state) — they recompute scores
 * locally and don't trigger a server round-trip.
 */
export function RankingsExplorer({
  rows,
  totalCount,
  scoredCount,
  facets,
  initialFilters,
  initialSort,
  basePath,
}: RankingsExplorerProps) {
  const router = useRouter();
  const [filters, setFilters] = React.useState<RankedProgramsFilters>(initialFilters);
  const [sort, setSort] = React.useState(initialSort);
  const [advisorWeights, setAdvisorWeights] = React.useState<PillarWeights | null>(null);

  const pushUrl = React.useCallback(
    (nextFilters: RankedProgramsFilters, nextSort: typeof sort) => {
      const sp = filtersToSearchParams(nextFilters, nextSort);
      const qs = sp.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [router, basePath]
  );

  const handleFiltersChange = (next: RankedProgramsFilters) => {
    setFilters(next);
    pushUrl(next, sort);
  };

  const handleSortChange = (next: typeof sort) => {
    setSort(next);
    pushUrl(filters, next);
  };

  return (
    <div className="flex flex-col gap-6">
      <RankingsFilters
        filters={filters}
        onChange={handleFiltersChange}
        facets={facets}
        totalCount={totalCount}
        scoredCount={scoredCount}
      />
      <AdvisorModeToggle
        weights={advisorWeights}
        onWeightsChange={setAdvisorWeights}
        scoredCount={scoredCount}
      />
      <RankingsTable
        rows={rows}
        scoredCount={scoredCount}
        sort={sort}
        onSortChange={handleSortChange}
        advisorWeights={advisorWeights}
      />
    </div>
  );
}
