'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { RankedProgramsFilters } from '@/lib/queries/types';
import { CountryFlag } from './country-flag';

export interface RankingsFiltersProps {
  filters: RankedProgramsFilters;
  onChange: (next: RankedProgramsFilters) => void;
  facets: {
    countries: { iso: string; name: string; region: string }[];
    regions: string[];
    categories: string[];
  };
  totalCount: number;
  scoredCount: number;
  className?: string;
}

/**
 * Editorial filter bar (Phase 4-B / analyst Q4). Category chips sit
 * front-of-stage — the design's primary affordance — with country, region,
 * score-range, and search tucked behind a "More filters" disclosure.
 *
 * Search is debounced (300ms) so each keystroke doesn't fire a server
 * roundtrip; the disclosure is uncontrolled local state because URL state
 * already captures the active filter values.
 */
export function RankingsFilters({
  filters,
  onChange,
  facets,
  totalCount,
  scoredCount,
  className,
}: RankingsFiltersProps) {
  const [searchValue, setSearchValue] = React.useState(filters.search ?? '');
  const [moreOpen, setMoreOpen] = React.useState(false);

  const filtersRef = React.useRef(filters);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    filtersRef.current = filters;
    onChangeRef.current = onChange;
  });
  React.useEffect(() => {
    const id = setTimeout(() => {
      if ((filtersRef.current.search ?? '') !== searchValue) {
        onChangeRef.current({ ...filtersRef.current, search: searchValue });
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchValue]);

  const toggleInArray = <T,>(arr: T[] | undefined, value: T): T[] => {
    const set = new Set(arr ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return Array.from(set);
  };

  const selectedCategorySet = new Set(filters.categories ?? []);
  const selectedRegionSet = new Set(filters.regions ?? []);
  const selectedCountrySet = new Set(filters.countryIsos ?? []);

  const advancedCount =
    (filters.countryIsos?.length ?? 0) +
    (filters.regions?.length ?? 0) +
    (filters.scoredOnly ? 1 : 0) +
    (filters.scoreRange && (filters.scoreRange[0] !== null || filters.scoreRange[1] !== null)
      ? 1
      : 0) +
    ((filters.search ?? '').trim().length > 0 ? 1 : 0);

  const totalActive = advancedCount + selectedCategorySet.size;

  const allCategoriesActive = selectedCategorySet.size === 0;

  return (
    <section
      aria-label="Filters"
      className={cn('flex flex-col gap-3 border-y py-4', className)}
      style={{ borderColor: 'var(--rule)' }}
      data-testid="rankings-filters"
    >
      {/* Front-of-stage: category chip strip + advisor entry-point. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Filter</span>
          <button
            type="button"
            onClick={() => onChange({ ...filters, categories: [] })}
            aria-pressed={allCategoriesActive}
            className={cn('chip cursor-pointer h-[26px]', allCategoriesActive && 'chip-ink')}
            data-testid="filter-chip-all-categories"
          >
            All categories
          </button>
          {facets.categories.map((c) => {
            const active = selectedCategorySet.has(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({ ...filters, categories: toggleInArray(filters.categories, c) })
                }
                className={cn('chip cursor-pointer h-[26px]', active && 'chip-ink')}
                data-testid="filter-chip-category"
                data-category={c}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-data-sm">
          <span className="text-ink-4">
            <span className="num text-ink">{scoredCount}</span> scored ·{' '}
            <span className="num">{totalCount}</span> total
          </span>
          <span className="block h-5 w-px bg-rule" aria-hidden />
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="btn-link text-data-sm"
            aria-expanded={moreOpen}
            aria-controls="rankings-more-filters"
            data-testid="more-filters-toggle"
          >
            {moreOpen ? 'Hide filters' : 'More filters'}
            {advancedCount > 0 && !moreOpen && (
              <span
                className="ml-1.5 num"
                style={{ color: 'var(--accent)', fontWeight: 600 }}
                aria-label={`${advancedCount} additional filters active`}
              >
                {advancedCount}
              </span>
            )}
          </button>
          {totalActive > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchValue('');
                onChange({});
              }}
              className="btn-link text-data-sm"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Disclosed: country/region/search/score range. */}
      {moreOpen && (
        <div
          id="rankings-more-filters"
          className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2"
          style={{ borderColor: 'var(--rule-soft)' }}
          data-testid="more-filters"
        >
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Search</span>
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Programme name, country, keyword"
              className="num border bg-paper px-3 py-2 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ borderColor: 'var(--rule)' }}
              aria-label="Search programmes"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="eyebrow">Country</span>
            <select
              multiple
              value={filters.countryIsos ?? []}
              onChange={(e) => {
                const next = Array.from(e.target.selectedOptions, (o) => o.value);
                onChange({ ...filters, countryIsos: next });
              }}
              className="h-24 border bg-paper px-2 py-1 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ borderColor: 'var(--rule)' }}
              aria-label="Filter by country"
            >
              {facets.countries.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.name} ({c.iso})
                </option>
              ))}
            </select>
          </label>

          <ChipGroup
            label="Region"
            items={facets.regions}
            selected={selectedRegionSet}
            onToggle={(v) => onChange({ ...filters, regions: toggleInArray(filters.regions, v) })}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow">Composite score range</legend>
            <div className="flex items-center gap-3">
              <ScoreRangeInput
                value={filters.scoreRange?.[0] ?? null}
                placeholder="Min"
                onChange={(min) =>
                  onChange({
                    ...filters,
                    scoreRange: [min, filters.scoreRange?.[1] ?? null],
                  })
                }
              />
              <span aria-hidden className="text-ink-4">
                —
              </span>
              <ScoreRangeInput
                value={filters.scoreRange?.[1] ?? null}
                placeholder="Max"
                onChange={(max) =>
                  onChange({
                    ...filters,
                    scoreRange: [filters.scoreRange?.[0] ?? null, max],
                  })
                }
              />
              <span className="ml-2 text-data-sm text-ink-4">
                {scoredCount} scored programmes in cohort
              </span>
            </div>
          </fieldset>

          <label className="inline-flex w-fit items-center gap-2 text-data-md">
            <input
              type="checkbox"
              checked={filters.scoredOnly ?? false}
              onChange={(e) => onChange({ ...filters, scoredOnly: e.target.checked })}
              className="h-4 w-4 accent-accent"
            />
            Scored programmes only
          </label>

          {selectedCountrySet.size > 0 && (
            <SelectedChipRow
              label="Selected countries"
              items={Array.from(selectedCountrySet)}
              onClear={(iso) =>
                onChange({
                  ...filters,
                  countryIsos: (filters.countryIsos ?? []).filter((i) => i !== iso),
                })
              }
            />
          )}
        </div>
      )}
    </section>
  );
}

function ChipGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((v) => {
          const active = selected.has(v);
          return (
            <li key={v}>
              <button
                type="button"
                onClick={() => onToggle(v)}
                aria-pressed={active}
                className={cn('chip cursor-pointer', active && 'chip-ink')}
              >
                {v}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreRangeInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={100}
      step={0.5}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return onChange(null);
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        onChange(Math.max(0, Math.min(100, n)));
      }}
      className="num w-20 border bg-paper px-2 py-1 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ borderColor: 'var(--rule)' }}
      aria-label={placeholder}
    />
  );
}

function SelectedChipRow({
  label,
  items,
  onClear,
}: {
  label: string;
  items: string[];
  onClear: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="eyebrow">{label}</p>
      {items.map((i) => (
        <SelectedCountryChip key={i} iso={i} onClear={() => onClear(i)} />
      ))}
    </div>
  );
}

function SelectedCountryChip({ iso, onClear }: { iso: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="chip chip-ink inline-flex items-center gap-1.5 cursor-pointer"
    >
      <CountryFlag iso={iso} size="sm" />
      {iso}
      <span aria-hidden>×</span>
    </button>
  );
}
