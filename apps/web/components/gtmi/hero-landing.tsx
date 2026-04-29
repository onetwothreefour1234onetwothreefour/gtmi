import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CohortStats } from '@/lib/queries/cohort-stats';

export interface HeroLandingProps {
  /** Live cohort stats — drives the stat strip. */
  stats: CohortStats;
  /** CME/PAQ split as fractions, read from the live methodology version. */
  cmePaqSplit: { cme: number; paq: number };
  className?: string;
}

function formatRefreshDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

/**
 * Editorial hero — translates docs/design/screen-rankings.jsx:HeroLanding.
 *
 * 1.4fr / 1fr split: large Fraunces headline + dek + CTAs on the left,
 * 30/70 split block on the right. Stats strip (5 live cells) underneath.
 *
 * Every numeric on the page is live-computed (analyst decision: stat
 * strip values must come from the DB). The CME/PAQ split reads from
 * `methodology_versions` so a methodology bump auto-rolls the rendering.
 */
export function HeroLanding({ stats, cmePaqSplit, className }: HeroLandingProps) {
  const cmePct = Math.round(cmePaqSplit.cme * 100);
  const paqPct = Math.round(cmePaqSplit.paq * 100);
  const coveragePct = Math.round(stats.coverageAvg * 100);
  const refresh = formatRefreshDate(stats.lastVerifiedAt);

  return (
    <section
      className={cn('paper-grain px-12 pb-10 pt-16', className)}
      style={{ background: 'var(--paper)' }}
      data-testid="hero-landing"
    >
      <div className="mx-auto grid max-w-page items-end gap-16 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow mb-6">The Global Talent Mobility Index</p>
          <h1
            className="serif"
            style={{
              fontSize: 72,
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              margin: 0,
              fontWeight: 400,
            }}
          >
            A primary-source measure of how the world&rsquo;s talent visa programmes{' '}
            <em style={{ color: 'var(--accent)', fontStyle: 'italic' }} data-testid="hero-actually">
              actually
            </em>{' '}
            work.
          </h1>
          <p
            className="mt-7 max-w-[620px] text-dek"
            style={{ color: 'var(--ink-3)', lineHeight: 1.55 }}
          >
            <span className="num">{stats.indicatorsTotal}</span> indicators across 5 pillars. Every
            number traceable to a primary source &mdash; sentence, character offsets, hash, scrape
            time. No marketing copy. No country pride.
          </p>
          <div className="mt-9 flex items-center gap-4">
            <Link href="/programs" className="btn">
              Browse the rankings →
            </Link>
            <Link href="/methodology" className="btn btn-ghost">
              Read the methodology
            </Link>
          </div>
        </div>

        <div className="border-l border-rule pl-8">
          <p className="eyebrow mb-4">How GTMI is computed</p>
          <div className="flex h-[140px] items-end">
            <div
              className="relative h-full"
              style={{ flex: cmePct, background: 'var(--ink)' }}
              aria-label={`CME ${cmePct}% — Comparative Mobility Engine`}
            >
              <div className="absolute left-3 top-3" style={{ color: 'var(--paper)' }}>
                <p className="serif" style={{ fontSize: 32, fontWeight: 500, lineHeight: 1 }}>
                  {cmePct}%
                </p>
                <p
                  className="mt-1"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  CME
                </p>
                <p className="mt-1" style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.3 }}>
                  Comparative
                  <br />
                  Mobility Engine
                </p>
              </div>
            </div>
            <div
              className="relative h-full border border-rule"
              style={{ flex: paqPct, background: 'var(--paper-3)' }}
              aria-label={`PAQ ${paqPct}% — Programme Architecture and Quality`}
            >
              <div className="absolute left-3 top-3 text-ink">
                <p className="serif" style={{ fontSize: 32, fontWeight: 500, lineHeight: 1 }}>
                  {paqPct}%
                </p>
                <p
                  className="mt-1"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  PAQ
                </p>
                <p className="mt-1 text-ink-3" style={{ fontSize: 11, lineHeight: 1.3 }}>
                  Programme Architecture
                  <br />
                  &amp; Quality
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-data-sm leading-relaxed text-ink-4">
            CME measures comparative outcomes — wage uplift, route-to-PR, cost-to-applicant. PAQ
            measures programme architecture — predictability, transparency, fairness, family rights,
            recourse.
          </p>
        </div>
      </div>

      {/* Live-computed stat strip. Five cells, all DB-derived (Q-add). */}
      <div
        className="mx-auto mt-16 grid max-w-page grid-cols-1 gap-px border md:grid-cols-5"
        style={{ background: 'var(--rule)', borderColor: 'var(--rule)' }}
        data-testid="stats-strip"
      >
        <StatCell
          label="Programmes scored"
          value={String(stats.programmesActive)}
          sub={`across the cohort (${stats.programmesTotal} total seeded)`}
        />
        <StatCell
          label="Indicators"
          value={String(stats.indicatorsTotal)}
          sub="5 pillars · 30/70 weighted"
        />
        <StatCell
          label="Source documents"
          value={stats.sourcesTotal.toLocaleString('en-US')}
          sub="primary, hashed, archived"
        />
        <StatCell
          label="Provenance coverage"
          value={`${coveragePct}%`}
          sub="of weighted indicators"
        />
        <StatCell label="Last updated" value={refresh} sub="" />
      </div>
    </section>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: 'var(--paper)', padding: '20px 20px 22px' }}>
      <p className="eyebrow" style={{ fontSize: 10 }}>
        {label}
      </p>
      <p className="num-l mt-2 text-ink" style={{ fontSize: 32 }}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-ink-4" style={{ fontSize: 11 }}>
          {sub}
        </p>
      )}
    </div>
  );
}
