import type { RankedProgramsFilters, SortDirection, SortField } from './types';

const SORT_FIELDS: ReadonlySet<SortField> = new Set([
  'composite',
  'paq',
  'cme',
  'name',
  'country',
  'coverage',
]);

/**
 * Parse Next's `searchParams` into a typed RankedProgramsFilters + sort.
 * Phase 4.2 URL shape:
 *   ?country=AUS,SGP&region=Oceania&cat=Skilled+worker
 *   &scored=1&min=10&max=50&q=482&sort=paq&dir=desc
 *
 * Unknown params are dropped silently — this is a public surface and we
 * accept that link-decay over time will leave malformed older URLs in
 * caches. Anything not present uses sensible defaults.
 */
export function parseRankingsParams(searchParams: Record<string, string | string[] | undefined>): {
  filters: RankedProgramsFilters;
  sort: { field: SortField; direction: SortDirection };
} {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const splitCsv = (key: string): string[] | undefined => {
    const raw = get(key);
    if (!raw) return undefined;
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  };

  const parseNumberParam = (key: string): number | null => {
    const raw = get(key);
    if (raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  };

  const filters: RankedProgramsFilters = {
    countryIsos: splitCsv('country'),
    regions: splitCsv('region'),
    categories: splitCsv('cat'),
    scoredOnly: get('scored') === '1',
    scoreRange: [parseNumberParam('min'), parseNumberParam('max')],
    search: get('q') ?? undefined,
  };

  // Drop scoreRange if both ends are null so we don't carry a no-op filter.
  if (filters.scoreRange?.[0] === null && filters.scoreRange?.[1] === null) {
    delete filters.scoreRange;
  }

  const rawSort = get('sort');
  const rawDir = get('dir');
  const sortField: SortField =
    rawSort && SORT_FIELDS.has(rawSort as SortField) ? (rawSort as SortField) : 'composite';
  const sortDirection: SortDirection = rawDir === 'asc' ? 'asc' : 'desc';

  return {
    filters,
    sort: { field: sortField, direction: sortDirection },
  };
}
