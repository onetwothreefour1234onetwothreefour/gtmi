import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CountryFlag } from './country-flag';

export interface CountryHeaderProps {
  iso: string;
  name: string;
  region: string;
  imdRank: number | null;
  imdAppealScore: number | null;
  programmesScored: number;
  programmesTotal: number;
  /** Top-scoring programme name (used as the "Top programme" cell). */
  topProgrammeName: string | null;
  /** Top-scoring programme rank within country (1 = highest composite). */
  topProgrammeRank: number | null;
  /** Average composite across scored programmes — null when nothing is scored. */
  averageComposite: number | null;
  /** Average coverage (0–1) across this country's scored programmes. */
  averageCoverage: number | null;
  className?: string;
}

/**
 * Editorial country header. Translates docs/design/screen-country-changes.jsx:
 * CountryHeader.
 *
 * 1.4fr / 1fr split: left column has the breadcrumb, ISO eyebrow, large
 * Fraunces country name, and a one-line standfirst; right column is a
 * 3-cell stat grid (top programme / avg composite / coverage).
 */
export function CountryHeader({
  iso,
  name,
  region,
  imdRank,
  imdAppealScore,
  programmesScored,
  programmesTotal,
  topProgrammeName,
  topProgrammeRank,
  averageComposite,
  averageCoverage,
  className,
}: CountryHeaderProps) {
  return (
    <section
      className={cn('px-12 pt-12', className)}
      style={{ background: 'var(--paper)' }}
      data-testid="country-header"
    >
      <div className="mx-auto max-w-page">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-data-sm text-ink-4"
        >
          <Link href="/programs" className="hover:text-ink">
            Countries
          </Link>
          <span aria-hidden>›</span>
          <span className="text-ink">{name}</span>
        </nav>

        <div className="grid items-end gap-16 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <CountryFlag iso={iso} countryName={name} size="md" />
              <p className="eyebrow" style={{ margin: 0 }}>
                Country profile · {region}
              </p>
            </div>
            <h1
              className="serif text-ink"
              style={{
                fontSize: 64,
                fontWeight: 400,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                margin: 0,
              }}
              data-testid="country-name"
            >
              {name}
            </h1>
            <p className="mt-4 max-w-[640px] text-ink-3" style={{ fontSize: 16 }}>
              <span className="num text-ink">{programmesScored}</span> of{' '}
              <span className="num">{programmesTotal}</span> programmes scored
              {topProgrammeName && (
                <>
                  . Top scoring: <span className="serif italic">{topProgrammeName}</span>
                  {topProgrammeRank !== null && (
                    <span className="num text-ink-4"> · #{topProgrammeRank}</span>
                  )}
                </>
              )}
              {imdRank !== null && (
                <>
                  . IMD World Talent Ranking <span className="num text-ink">Appeal #{imdRank}</span>
                  {imdAppealScore !== null && (
                    <span className="num text-ink-4"> · {imdAppealScore.toFixed(2)}</span>
                  )}
                  .
                </>
              )}
            </p>
          </div>

          <div
            className="grid grid-cols-3 border"
            style={{ borderColor: 'var(--rule)' }}
            data-testid="country-header-stats"
          >
            <StatCell
              label="Top programme"
              value={topProgrammeRank !== null ? `#${topProgrammeRank}` : '—'}
              sub={topProgrammeName ?? 'No scored programmes'}
            />
            <StatCell
              label="Avg. composite"
              value={averageComposite !== null ? averageComposite.toFixed(1) : '—'}
              sub={`across ${programmesScored} scored`}
              borderLeft
            />
            <StatCell
              label="Coverage"
              value={averageCoverage !== null ? `${Math.round(averageCoverage * 100)}%` : '—'}
              sub="weighted, all programmes"
              borderLeft
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCell({
  label,
  value,
  sub,
  borderLeft = false,
}: {
  label: string;
  value: string;
  sub: string;
  borderLeft?: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderLeft: borderLeft ? '1px solid var(--rule)' : undefined,
      }}
    >
      <p className="eyebrow" style={{ fontSize: 10 }}>
        {label}
      </p>
      <p className="num-l mt-1" style={{ fontSize: 24 }}>
        {value}
      </p>
      <p className="mt-1 text-ink-4" style={{ fontSize: 11 }}>
        {sub}
      </p>
    </div>
  );
}
