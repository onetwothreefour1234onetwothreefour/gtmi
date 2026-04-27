'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { RankedProgramsFilters } from '@/lib/queries/types';

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
 * Filter bar for the rankings table. Country multi-select, region chips,
 * category chips, score range (min/max numeric inputs — a slider primitive
 * exists but two text inputs are clearer for the editorial tone), scored-only
 * toggle, and a free-text search input wired to the FTS query.
 *
 * Search is debounced (300ms) so each keystroke doesn't fire a server
 * roundtrip.
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

  // Capture latest filters/onChange in refs so the debounce only fires on
  // searchValue changes, not on every parent re-render. Avoids the lint
  // disable while keeping the debounce semantics correct.
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

  const activeCount =
    (filters.countryIsos?.length ?? 0) +
    (filters.regions?.length ?? 0) +
    (filters.categories?.length ?? 0) +
    (filters.scoredOnly ? 1 : 0) +
    (filters.scoreRange && (filters.scoreRange[0] !== null || filters.scoreRange[1] !== null)
      ? 1
      : 0);

  const selectedCountrySet = new Set(filters.countryIsos ?? []);
  const selectedRegionSet = new Set(filters.regions ?? []);
  const selectedCategorySet = new Set(filters.categories ?? []);

  return (
    <section
      aria-label="Filters"
      className={cn(
        'flex flex-col gap-4 rounded-card border border-border bg-surface p-4',
        className
      )}
      data-testid="rankings-filters"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">Filters</p>
        <p className="text-data-sm text-muted-foreground">
          <span className="font-mono text-foreground tnum">{scoredCount}</span> scored ·{' '}
          <span className="font-mono text-foreground tnum">{totalCount}</span> total
          {activeCount > 0 && (
            <button
              type="button"
              className="ml-3 text-accent underline-offset-4 hover:underline"
              onClick={() => onChange({})}
            >
              Reset
            </button>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-data-sm text-muted-foreground">Search</span>
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Program name, country, keyword"
            className="rounded-button border border-border bg-paper px-3 py-2 font-mono text-data-md tnum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Search programs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-data-sm text-muted-foreground">Country</span>
          <select
            multiple
            value={filters.countryIsos ?? []}
            onChange={(e) => {
              const next = Array.from(e.target.selectedOptions, (o) => o.value);
              onChange({ ...filters, countryIsos: next });
            }}
            className="h-24 rounded-button border border-border bg-paper px-2 py-1 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Filter by country"
          >
            {facets.countries.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} ({c.iso})
              </option>
            ))}
          </select>
        </label>
      </div>

      <ChipGroup
        label="Region"
        items={facets.regions}
        selected={selectedRegionSet}
        onToggle={(v) => onChange({ ...filters, regions: toggleInArray(filters.regions, v) })}
      />

      <ChipGroup
        label="Category"
        items={facets.categories}
        selected={selectedCategorySet}
        onToggle={(v) => onChange({ ...filters, categories: toggleInArray(filters.categories, v) })}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-data-sm text-muted-foreground">Composite score range</legend>
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
          <span aria-hidden className="text-muted-foreground">
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
          <span className="ml-3 text-data-sm text-muted-foreground">
            {scoredCount} scored programs in cohort
          </span>
        </div>
      </fieldset>

      <label className="inline-flex w-fit items-center gap-2 text-data-md">
        <input
          type="checkbox"
          checked={filters.scoredOnly ?? false}
          onChange={(e) => onChange({ ...filters, scoredOnly: e.target.checked })}
          className="h-4 w-4 rounded-sm accent-accent"
        />
        Scored programs only
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
      <p className="text-data-sm text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((v) => {
          const active = selected.has(v);
          return (
            <li key={v}>
              <button
                type="button"
                onClick={() => onToggle(v)}
                aria-pressed={active}
                className={cn(
                  'rounded-button border px-2 py-1 text-data-sm transition-colors',
                  active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-paper text-muted-foreground hover:text-foreground'
                )}
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
      className="w-20 rounded-button border border-border bg-paper px-2 py-1 font-mono text-data-md tnum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      <p className="text-data-sm text-muted-foreground">{label}:</p>
      {items.map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onClear(i)}
          className="inline-flex items-center gap-1 rounded-button border border-accent bg-accent px-2 py-0.5 text-data-sm text-accent-foreground hover:opacity-80"
        >
          {i}
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}
