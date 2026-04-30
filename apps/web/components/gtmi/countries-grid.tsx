import * as React from 'react';
import Link from 'next/link';
import { CountryFlag } from './country-flag';
import { PreCalibrationChip } from './pre-calibration-chip';
import { EmptyState } from './empty-state';
import { cn } from '@/lib/utils';
import type { CountryIndexRow } from '@/lib/queries/all-countries';

export interface CountriesGridProps {
  rows: CountryIndexRow[];
  className?: string;
}

/**
 * Public `/countries` index — 30-country card grid. Matches the
 * editorial tone of `/programs` (paper-grain header upstream + the
 * existing `<CountryHeader>`, `<RankingsTable>` row treatment): same
 * `var(--rule)` borders, serif numerics, mono eyebrow + region.
 *
 * Each card is a single click target wrapped in a `<Link>` to the
 * country detail page. Unscored cohort countries (`scoredProgrammeCount === 0`)
 * render an `<EmptyState>` in the right-hand block instead of a
 * composite chip so they read distinctly without competing with
 * scored cards.
 */
export function CountriesGrid({ rows, className }: CountriesGridProps) {
  if (rows.length === 0) {
    return (
      <div data-testid="countries-grid-empty">
        <EmptyState
          title="No countries in the cohort yet."
          body="The cohort table is loaded from the seed; if you see this, the seed hasn't run."
        />
      </div>
    );
  }
  return (
    <ul
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3', className)}
      data-testid="countries-grid"
    >
      {rows.map((row) => (
        <li key={row.iso}>
          <CountryCard row={row} />
        </li>
      ))}
    </ul>
  );
}

function CountryCard({ row }: { row: CountryIndexRow }) {
  const scored = row.scoredProgrammeCount > 0;
  return (
    <Link
      href={`/countries/${row.iso}`}
      data-testid="country-card"
      data-iso={row.iso}
      className={cn(
        'group flex h-full flex-col border bg-paper p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(26,26,26,0.18)]'
      )}
      style={{ borderColor: 'var(--rule)' }}
    >
      <header className="flex items-center gap-3">
        <CountryFlag iso={row.iso} countryName={row.name} size="md" />
        <div className="min-w-0 grow">
          <p
            className="serif text-ink"
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {row.name}
          </p>
          <p
            className="num text-ink-4"
            style={{ fontSize: 11, letterSpacing: '0.04em', marginTop: 2 }}
          >
            {row.region.toUpperCase()}
            {row.imdRank !== null && (
              <>
                {' '}
                · IMD #<span className="text-ink-3">{row.imdRank}</span>
              </>
            )}
          </p>
        </div>
      </header>

      <div
        className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-4"
        style={{ borderColor: 'var(--rule)' }}
      >
        <div>
          <p className="eyebrow text-ink-5" style={{ fontSize: 10 }}>
            CME
          </p>
          {row.cmeScore !== null ? (
            <p
              className="num mt-1 text-ink"
              style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.1 }}
              data-testid="country-card-cme"
            >
              {row.cmeScore.toFixed(2)}
            </p>
          ) : (
            <p className="num mt-1 text-ink-4" style={{ fontSize: 14 }}>
              —
            </p>
          )}
        </div>
        <div>
          <p className="eyebrow text-ink-5" style={{ fontSize: 10 }}>
            Top composite
          </p>
          {scored && row.bestComposite !== null ? (
            <div className="mt-1 flex items-baseline gap-2" data-testid="country-card-best">
              <span
                className="num text-ink"
                style={{ fontSize: 24, fontWeight: 500, lineHeight: 1.1 }}
              >
                {row.bestComposite.toFixed(2)}
              </span>
              <PreCalibrationChip />
            </div>
          ) : (
            <p
              className="num mt-1 text-ink-4"
              style={{ fontSize: 12, fontStyle: 'italic' }}
              data-testid="country-card-unscored"
            >
              Not yet scored
            </p>
          )}
        </div>
      </div>

      <footer
        className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-data-sm text-ink-4"
        style={{ borderColor: 'var(--rule)', fontSize: 12 }}
      >
        <span className="num">
          <span className="text-ink-3">{row.programmeCount}</span> programme
          {row.programmeCount === 1 ? '' : 's'}
        </span>
        {scored && (
          <>
            <span aria-hidden>·</span>
            <span className="num">
              <span className="text-ink-3">{row.scoredProgrammeCount}</span> scored
            </span>
          </>
        )}
        {row.averageCoveragePct !== null && (
          <>
            <span aria-hidden>·</span>
            <span className="num">
              <span className="text-ink-3">{row.averageCoveragePct.toFixed(0)}%</span> cov.
            </span>
          </>
        )}
      </footer>

      {scored && row.bestProgrammeName && (
        <p
          className="mt-3 truncate text-data-sm text-ink-3"
          style={{ fontSize: 12 }}
          title={row.bestProgrammeName}
        >
          Top: <span className="serif italic text-ink">{row.bestProgrammeName}</span>{' '}
          <span className="text-accent group-hover:underline">→</span>
        </p>
      )}
    </Link>
  );
}
