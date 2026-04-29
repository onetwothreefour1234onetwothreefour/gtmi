import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CountryFlag } from './country-flag';
import { CompositeScoreDisplay } from './composite-score-display';
import { CoverageChip } from './coverage-chip';

export interface ProgramHeaderProps {
  countryIso: string;
  countryName: string;
  programName: string;
  programCategory: string;
  programStatus: string;
  programDescriptionMd: string | null;
  composite: number | null;
  cme: number | null;
  paq: number | null;
  rank: number | null;
  scoredCount: number;
  fieldsPopulated: number;
  fieldsTotal: number;
  phase2Placeholder: boolean;
  className?: string;
}

/**
 * Editorial program-detail header. Translates docs/design/screen-program.jsx:
 * ProgramHeader.
 *
 * 1.6fr / 1fr split: left column has the breadcrumb, country eyebrow + chips,
 * the Fraunces serif programme name, and the description paragraph; right
 * column is the paper-2 composite-score plate (rebuilt in Phase A).
 */
export function ProgramHeader({
  countryIso,
  countryName,
  programName,
  programCategory,
  programStatus,
  programDescriptionMd,
  composite,
  cme,
  paq,
  rank,
  scoredCount,
  fieldsPopulated,
  fieldsTotal,
  phase2Placeholder,
  className,
}: ProgramHeaderProps) {
  return (
    <section
      className={cn('border-b px-12 pb-0 pt-12', className)}
      style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
      data-testid="program-header"
    >
      <div className="mx-auto max-w-page">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-data-sm text-ink-4"
        >
          <Link href="/programs" className="hover:text-ink">
            Programmes
          </Link>
          <span aria-hidden>›</span>
          <Link href={`/countries/${countryIso}`} className="hover:text-ink">
            {countryName}
          </Link>
          <span aria-hidden>›</span>
          <span className="text-ink">{programName}</span>
        </nav>

        <div className="grid items-start gap-16 md:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <CountryFlag iso={countryIso} countryName={countryName} size="sm" />
              <p className="eyebrow" style={{ margin: 0 }}>
                {countryName} · {programCategory}
              </p>
              <span className="chip chip-mute" data-testid="program-status-chip">
                {programStatus}
              </span>
              {composite !== null && (
                <CoverageChip populated={fieldsPopulated} total={fieldsTotal} />
              )}
            </div>
            <h1
              className="serif text-ink"
              style={{
                fontSize: 56,
                fontWeight: 400,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                margin: 0,
              }}
              data-testid="program-name"
            >
              {programName}
            </h1>
            {programDescriptionMd && programDescriptionMd.trim().length > 0 && (
              <p
                className="mt-5 max-w-[640px] text-ink-3"
                style={{
                  fontSize: 17,
                  lineHeight: 1.55,
                  fontFamily: 'var(--font-serif), Georgia, serif',
                }}
              >
                {programDescriptionMd}
              </p>
            )}
          </div>

          <CompositeScoreDisplay
            composite={composite}
            cme={cme}
            paq={paq}
            phase2Placeholder={phase2Placeholder}
            rank={rank}
            scoredCount={scoredCount}
          />
        </div>
      </div>
    </section>
  );
}
