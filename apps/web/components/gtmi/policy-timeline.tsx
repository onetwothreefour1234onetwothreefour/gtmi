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
  className?: string;
}

const SEVERITY_STYLE: Record<PolicyTimelineSeverity, string> = {
  minor: 'chip chip-mute',
  material: 'chip chip-amber',
  breaking: 'chip chip-accent',
  url_broken: 'chip chip-amber',
};

/**
 * Vertical timeline of policy-change events on a programme detail page.
 * Phase 4 reality: empty (RLS gates `summary_human_approved = true`); the
 * EmptyState placeholder ships in production until Phase 5/6 populates
 * the table.
 *
 * Editorial restyle (Phase 4-A): rule-soft spine, chip atoms for severity,
 * Fraunces summary, mono date.
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
      className={cn('relative border-l border-rule pl-5', className)}
      data-testid="policy-timeline"
    >
      {events.map((event) => (
        <li key={event.id} className="mb-6 last:mb-0">
          <span className="absolute -left-1.5 mt-1 inline-block h-3 w-3 bg-accent" aria-hidden />
          <div className="flex flex-wrap items-baseline gap-2">
            <time dateTime={event.detectedAt} className="num text-data-sm text-ink-4">
              {event.detectedAt.slice(0, 10)}
            </time>
            <span className={SEVERITY_STYLE[event.severity]}>{event.severity}</span>
            <span className="num text-data-sm">{event.fieldKey}</span>
            <span className="text-data-sm text-ink-3">{event.fieldLabel}</span>
            {typeof event.paqDelta === 'number' && (
              <span className="num ml-auto text-data-sm text-ink-4">
                Δ PAQ {event.paqDelta > 0 ? '+' : ''}
                {event.paqDelta.toFixed(2)}
              </span>
            )}
          </div>
          <p
            className="mt-1 text-data-md text-ink-2"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
          >
            {event.summary}
          </p>
        </li>
      ))}
    </ol>
  );
}
