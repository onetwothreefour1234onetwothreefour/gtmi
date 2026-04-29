import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import type { PolicyChangeRow } from '@/lib/queries/policy-changes';

export interface ThisEditionProps {
  /** Up to 3 most-recent approved policy changes. Empty array renders the
   *  Phase 5 placeholder per the analyst-decision contract — no mock data. */
  events: PolicyChangeRow[];
  className?: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  minor: 'Minor revision',
  material: 'Material revision',
  breaking: 'Breaking change',
  url_broken: 'Source URL drift',
};

function severityDeltaColor(delta: number | null, severity: string): string {
  if (delta === null) {
    return severity === 'breaking' ? 'var(--accent)' : 'var(--ink-3)';
  }
  if (delta > 0) return 'var(--positive)';
  if (delta < 0) return 'var(--negative)';
  return 'var(--ink-3)';
}

function formatDelta(delta: number | null, severity: string): string {
  if (delta === null) return SEVERITY_LABEL[severity] ?? severity.toUpperCase();
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta).toFixed(1)}`;
}

/**
 * "The index is alive" strip — three most-recent approved policy changes,
 * one per cell, with the composite-impact delta rendered large in oxblood
 * or moss-green. Phase 4 reality: `policy_changes` is empty (RLS-gated on
 * `summary_human_approved=true`); the strip renders the Phase 5 empty state.
 *
 * Translates docs/design/screen-rankings-v2.jsx:ThisEdition with the
 * critical change that no mock entries are hardcoded — the empty state
 * is the truthful render until Phase 5/6 lights up the table.
 */
export function ThisEdition({ events, className }: ThisEditionProps) {
  const visible = events.slice(0, 3);

  return (
    <section
      className={cn('border-b px-12 py-14', className)}
      style={{ borderColor: 'var(--rule)' }}
      data-testid="this-edition"
    >
      <div className="mx-auto max-w-page">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow mb-2">Recent activity · last approved changes</p>
            <h2
              className="serif"
              style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              The index is alive. Scores update as policy moves.
            </h2>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Awaiting Phase 5 — policy change tracking"
            body={
              <>
                Live monitoring of Tier 1 government sources surfaces policy revisions to scored
                programmes within 24 hours of detection, classified by severity. No approved changes
                have been published yet — the strip will populate as Phase 5 brings the{' '}
                <code className="num text-data-sm">policy_changes</code> table online.
              </>
            }
            ctaHref="/changes"
            ctaLabel="See the changes log"
          />
        ) : (
          <div
            className="grid grid-cols-1 gap-px border md:grid-cols-3"
            style={{ background: 'var(--rule)', borderColor: 'var(--rule)' }}
          >
            {visible.map((e) => (
              <article key={e.id} className="relative p-7" style={{ background: 'var(--paper)' }}>
                <p className="eyebrow mb-4" style={{ fontSize: 10 }}>
                  {SEVERITY_LABEL[e.severity] ?? e.severity}
                </p>
                <div className="flex items-baseline gap-3">
                  <span
                    className="num-l"
                    style={{
                      fontSize: 44,
                      lineHeight: 1,
                      color: severityDeltaColor(e.paqDelta, e.severity),
                    }}
                  >
                    {formatDelta(e.paqDelta, e.severity)}
                  </span>
                  <span className="num text-data-sm text-ink-4">
                    {e.paqDelta !== null ? 'Δ PAQ' : ''}
                  </span>
                </div>
                <p
                  className="serif mt-4"
                  style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em' }}
                >
                  <Link href={`/programs/${e.programId}`} className="hover:text-accent">
                    {e.countryName} · {e.programName}
                  </Link>
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="num text-data-sm">{e.fieldKey}</span>
                  <span className="text-data-sm text-ink-4">
                    <time dateTime={e.detectedAt}>{e.detectedAt.slice(0, 10)}</time>
                  </span>
                </p>
                <p className="mt-3 text-data-md leading-relaxed text-ink-3">{e.summary}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
