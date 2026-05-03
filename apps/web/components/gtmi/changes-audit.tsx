'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import type { PolicyChangeRow } from '@/lib/queries/policy-changes';

export type ChangesFilterTab = 'all' | 'data' | 'methodology' | 'provenance' | 'countries';

export interface ChangesAuditProps {
  /** Approved policy_changes rows ordered by detected_at DESC. May be []. */
  events: PolicyChangeRow[];
  /** Optional override empty-state body (Markdown HTML from content/). */
  emptyHtml?: string | null;
  className?: string;
}

const TABS: { id: ChangesFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'data', label: 'Data' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'provenance', label: 'Provenance' },
  { id: 'countries', label: 'Countries' },
];

const SEVERITY_COLOR: Record<string, string> = {
  breaking: 'var(--accent)',
  material: 'var(--navy)',
  minor: 'var(--ink-4)',
  url_broken: 'var(--warning)',
  // Phase 3.10c.9 — IMD Appeal annual refresh marker. Cohort-wide
  // event distinct from per-programme breaking/material changes.
  imd_refresh: 'var(--accent-oxblood)',
};

const SEVERITY_LABEL: Record<string, string> = {
  breaking: 'Breaking change',
  material: 'Material revision',
  minor: 'Minor revision',
  url_broken: 'Source URL drift',
  imd_refresh: 'IMD Appeal refresh',
};

/**
 * Editorial changes audit log (I-02). Translates docs/design/screen-country-
 * changes.jsx:ChangesScreen.
 *
 * Filter tabs are local UI state — they re-bucket the events array client-
 * side rather than re-querying. The bucket assignment is heuristic against
 * the existing `policy_changes` schema (which only has severity, not a
 * "kind" column): see `bucketForEvent`.
 *
 * Renders the design-aligned empty state when events is empty AND the active
 * tab is "all". For non-"all" tabs that filter to zero rows, shows a tighter
 * "no events match this filter" placeholder so the analyst can see the tab
 * UI is functional even when the table is empty.
 */
export function ChangesAudit({ events, emptyHtml, className }: ChangesAuditProps) {
  const [tab, setTab] = React.useState<ChangesFilterTab>('all');

  const counts = React.useMemo(() => {
    const out: Record<ChangesFilterTab, number> = {
      all: events.length,
      data: 0,
      methodology: 0,
      provenance: 0,
      countries: 0,
    };
    for (const e of events) {
      const bucket = bucketForEvent(e);
      out[bucket] += 1;
    }
    return out;
  }, [events]);

  const visible = React.useMemo(() => {
    if (tab === 'all') return events;
    return events.filter((e) => bucketForEvent(e) === tab);
  }, [events, tab]);

  return (
    <div
      className={cn('flex flex-col gap-6', className)}
      data-testid="changes-audit"
      data-tab={tab}
    >
      <nav
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Changes log filter"
        data-testid="changes-filter-tabs"
      >
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.id)}
              className={cn('chip cursor-pointer h-7', isActive && 'chip-ink')}
              data-testid={`changes-filter-${t.id}`}
            >
              {t.label}
              <span
                className="ml-1 num"
                style={{
                  fontSize: 11,
                  color: isActive ? 'var(--paper)' : 'var(--ink-4)',
                }}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </nav>

      {events.length === 0 ? (
        <EmptyState
          title="Phase 5 lights up the timeline"
          body={
            emptyHtml ? (
              <span dangerouslySetInnerHTML={{ __html: emptyHtml }} />
            ) : (
              'Policy change detection ships in Phase 5. Once live, every Tier 1 source we track will be re-scraped weekly. Detected changes appear here within 24 hours, classified by severity, with diffs and Wayback-archived snapshots.'
            )
          }
          ctaHref="/about"
          ctaLabel="See the build plan"
        />
      ) : visible.length === 0 ? (
        <p className="italic text-ink-4" data-testid="changes-tab-empty">
          No events match this filter.
        </p>
      ) : (
        <ChangesTimeline events={visible} />
      )}
    </div>
  );
}

function ChangesTimeline({ events }: { events: PolicyChangeRow[] }) {
  return (
    <ol className="relative" data-testid="changes-timeline">
      <span
        aria-hidden
        className="absolute"
        style={{
          top: 0,
          bottom: 0,
          left: 130,
          width: 1,
          background: 'var(--rule)',
        }}
      />
      {events.map((e) => (
        <li
          key={e.id}
          className="grid items-start"
          style={{
            gridTemplateColumns: '110px 60px 1fr',
            gap: 0,
            marginBottom: 40,
          }}
          data-testid="changes-timeline-row"
          data-severity={e.severity}
        >
          <div style={{ paddingTop: 4 }}>
            <p className="num text-data-sm" style={{ fontSize: 12, fontWeight: 600 }}>
              {e.detectedAt.slice(0, 10)}
            </p>
            <p
              className="eyebrow mt-1"
              style={{ fontSize: 9, color: SEVERITY_COLOR[e.severity] ?? 'var(--ink-4)' }}
            >
              {SEVERITY_LABEL[e.severity] ?? e.severity}
            </p>
          </div>
          <div
            className="flex justify-center"
            style={{ paddingTop: 6, position: 'relative', zIndex: 1 }}
          >
            <span
              aria-hidden
              data-testid="changes-severity-diamond"
              data-severity={e.severity}
              style={{
                width: 12,
                height: 12,
                background: 'var(--paper)',
                border: `2px solid ${SEVERITY_COLOR[e.severity] ?? 'var(--ink-4)'}`,
                transform: 'rotate(45deg)',
              }}
            />
          </div>
          <div style={{ paddingLeft: 8 }}>
            <div className="mb-2 flex flex-wrap items-baseline gap-3">
              <h3
                className="serif"
                style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}
              >
                {e.programName}
              </h3>
              <span className="num text-data-sm">{e.fieldKey}</span>
              {e.severity === 'imd_refresh' && (
                <span
                  className="chip chip-accent"
                  style={{ fontSize: 10 }}
                  data-testid="imd-refresh-cohort-badge"
                  title="IMD Appeal refresh — affects every programme's CME score"
                >
                  All programmes affected
                </span>
              )}
              {typeof e.paqDelta === 'number' && (
                <span
                  className="num ml-auto text-data-sm"
                  style={{
                    color:
                      e.paqDelta > 0
                        ? 'var(--positive)'
                        : e.paqDelta < 0
                          ? 'var(--negative)'
                          : 'var(--ink-4)',
                    fontWeight: 600,
                  }}
                >
                  Δ PAQ {e.paqDelta > 0 ? '+' : ''}
                  {e.paqDelta.toFixed(2)}
                </span>
              )}
            </div>
            <p className="num text-data-sm text-ink-4" style={{ marginBottom: 8 }}>
              <Link href={`/countries/${e.countryIso}`} className="hover:text-ink">
                {e.countryName}
              </Link>{' '}
              ·{' '}
              <Link href={`/programs/${e.programId}`} className="hover:text-ink">
                {e.programName}
              </Link>
            </p>
            <p
              className="text-ink-3"
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                margin: 0,
                fontFamily: 'var(--font-serif), Georgia, serif',
              }}
            >
              {e.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              {e.waybackUrl && (
                <a
                  href={e.waybackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-link text-data-sm"
                >
                  Source ↗
                </a>
              )}
              <Link href={`/programs/${e.programId}`} className="btn-link text-data-sm">
                Affected programme ›
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Heuristic bucket for an event under the existing `policy_changes` schema.
 *  - "url_broken" severity → provenance bucket
 *  - field key in pillar E (governance / stability) → countries bucket
 *  - methodology version change marker (synthetic; events with empty
 *    fieldKey on a future revision-aware row) → methodology bucket
 *  - default → data bucket
 *
 * This is intentionally simple because the schema has no `kind` column.
 * Phase 6+ may add one; until then the heuristic keeps the UI useful.
 */
function bucketForEvent(e: PolicyChangeRow): ChangesFilterTab {
  if (e.severity === 'url_broken') return 'provenance';
  if (e.severity === 'imd_refresh') return 'countries';
  if (typeof e.pillar === 'string' && e.pillar === 'E') return 'countries';
  if (!e.fieldKey || e.fieldKey === 'METHODOLOGY') return 'methodology';
  return 'data';
}
