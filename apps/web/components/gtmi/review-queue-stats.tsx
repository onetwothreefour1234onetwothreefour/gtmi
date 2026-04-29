import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ReviewQueueStats } from '@/lib/review-queue-stats';

export interface ReviewQueueStatsProps {
  stats: ReviewQueueStats;
  className?: string;
}

/**
 * Four-cell live stats strip for the editorial review queue (I-01).
 * Renders the four queue health indicators side-by-side in the design's
 * hairline grid: in-queue, SLA risk, avg age, high-confidence count.
 */
export function ReviewQueueStats({ stats, className }: ReviewQueueStatsProps) {
  const avgAge =
    stats.avgAgeHours === null
      ? '—'
      : stats.avgAgeHours < 1
        ? '<1h'
        : stats.avgAgeHours < 48
          ? `${Math.round(stats.avgAgeHours)}h`
          : `${Math.round(stats.avgAgeHours / 24)}d`;
  return (
    <div
      className={cn('grid grid-cols-2 gap-px border md:grid-cols-4', className)}
      style={{ background: 'var(--rule)', borderColor: 'var(--rule)' }}
      data-testid="review-queue-stats"
    >
      <Cell label="In queue" value={String(stats.inQueue)} testId="stat-in-queue" />
      <Cell
        label="SLA risk"
        value={String(stats.slaRisk)}
        emphasis={stats.slaRisk > 0 ? 'accent' : 'default'}
        testId="stat-sla-risk"
      />
      <Cell label="Avg age" value={avgAge} testId="stat-avg-age" />
      <Cell
        label="Auto-conf ≥ 0.9"
        value={String(stats.highConfidence)}
        emphasis={stats.highConfidence > 0 ? 'positive' : 'default'}
        testId="stat-high-confidence"
      />
    </div>
  );
}

function Cell({
  label,
  value,
  emphasis = 'default',
  testId,
}: {
  label: string;
  value: string;
  emphasis?: 'default' | 'accent' | 'positive';
  testId: string;
}) {
  const color =
    emphasis === 'accent'
      ? 'var(--accent)'
      : emphasis === 'positive'
        ? 'var(--positive)'
        : 'var(--ink)';
  return (
    <div className="px-5 py-4" style={{ background: 'var(--paper)' }} data-testid={testId}>
      <p className="eyebrow" style={{ fontSize: 10 }}>
        {label}
      </p>
      <p className="num-l mt-1" style={{ fontSize: 30, color }}>
        {value}
      </p>
    </div>
  );
}
