import * as React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';

// Phase 3.6.2 / ITEM 6 — `url_broken` reserved for the (paused) weekly
// maintenance scrape; styled like `material` until Phase 5 designs a
// dedicated chip.
export type PolicyTimelineSeverity = 'minor' | 'material' | 'breaking' | 'url_broken';

export interface PolicyTimelineEvent {
  id: string;
  detectedAt: string;
  severity: PolicyTimelineSeverity;
  fieldKey: string;
  fieldLabel: string;
  summary: string;
  paqDelta?: number | null;
}

export interface PolicyTimelineProps {
  events: PolicyTimelineEvent[];
  /** Phase 4 always passes []. Phase 5 will populate this. */
  className?: string;
}

const SEVERITY_STYLE: Record<PolicyTimelineSeverity, string> = {
  minor: 'bg-muted text-muted-foreground border-border',
  material: 'bg-precalib-bg text-precalib-fg border-precalib-fg/40',
  breaking: 'bg-destructive/10 text-destructive border-destructive/40',
  url_broken: 'bg-precalib-bg text-precalib-fg border-precalib-fg/40',
};

/**
 * Horizontal timeline of policy-change events. Phase 4 reality: the table
 * is empty (and RLS gates `summary_human_approved = true`). Renders the
 * Phase 5 placeholder copy via <EmptyState> when events.length === 0.
 *
 * The component is exercised by tests with mocked events so it activates
 * cleanly when Phase 5 lights up the table — no code change needed.
 */
export function PolicyTimeline({ events, className }: PolicyTimelineProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Policy change tracking ships in Phase 5"
        body="Live monitoring of Tier 1 government sources will surface amendments to this program in real time, classified by severity (minor / material / breaking) with diffs and Wayback archives."
      />
    );
  }

  return (
    <ol
      className={cn('relative border-l border-border pl-5', className)}
      data-testid="policy-timeline"
    >
      {events.map((event) => (
        <li key={event.id} className="mb-6 last:mb-0">
          <span
            className="absolute -left-1.5 mt-1 inline-block h-3 w-3 rounded-full bg-accent"
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-2">
            <time
              dateTime={event.detectedAt}
              className="font-mono text-data-sm text-muted-foreground"
            >
              {event.detectedAt.slice(0, 10)}
            </time>
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-button border px-1.5 font-sans text-[10px] font-medium uppercase tracking-wider',
                SEVERITY_STYLE[event.severity]
              )}
            >
              {event.severity}
            </span>
            <span className="font-mono text-data-sm">{event.fieldKey}</span>
            <span className="text-data-sm">{event.fieldLabel}</span>
            {typeof event.paqDelta === 'number' && (
              <span className="ml-auto font-mono text-data-sm tnum text-muted-foreground">
                Δ PAQ {event.paqDelta > 0 ? '+' : ''}
                {event.paqDelta.toFixed(2)}
              </span>
            )}
          </div>
          <p className="mt-1 text-data-md text-foreground">{event.summary}</p>
        </li>
      ))}
    </ol>
  );
}
