import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CoverageChipProps {
  populated: number;
  total: number;
  /** Display style. 'percent' (design default) or 'fraction' ("30/48"). */
  format?: 'percent' | 'fraction';
  className?: string;
}

/**
 * Coverage chip — programmes below 70% on any pillar are flagged
 * "insufficient disclosure" by the scoring engine; this chip surfaces the
 * same posture at a glance.
 *
 * Editorial restyle (Phase 4-A): default render switches to the design's
 * percent format (`92%`); fraction stays on the title attribute for hover.
 * Pass `format="fraction"` to keep the absolute "30/48" rendering when
 * needed.
 */
export function CoverageChip({
  populated,
  total,
  format = 'percent',
  className,
}: CoverageChipProps) {
  const ratio = total === 0 ? 0 : populated / total;
  const isLow = ratio < 0.7;
  const fraction = `${populated}/${total}`;
  const percent = `${Math.round(ratio * 100)}%`;
  const display = format === 'fraction' ? fraction : percent;
  const titleLabel = `${fraction} fields populated`;
  return (
    <span
      title={titleLabel}
      aria-label={titleLabel}
      className={cn('chip', isLow ? 'chip-amber' : 'chip-mute', 'tnum', className)}
      data-testid="coverage-chip"
      data-low-coverage={isLow ? 'true' : 'false'}
    >
      {display}
    </span>
  );
}
