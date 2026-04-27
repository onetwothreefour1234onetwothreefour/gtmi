import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CoverageChipProps {
  populated: number;
  total: number;
  className?: string;
}

/**
 * "30/48" style chip. Color shifts from muted to attention as coverage drops.
 * Programs below 70% on any pillar are flagged "insufficient disclosure" by
 * the scoring engine — this chip surfaces the same posture at a glance.
 */
export function CoverageChip({ populated, total, className }: CoverageChipProps) {
  const ratio = total === 0 ? 0 : populated / total;
  const isLow = ratio < 0.7;
  const label = `${populated}/${total} fields populated`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-5 items-center rounded-button border px-1.5 font-mono text-[10px] font-medium tnum',
        isLow
          ? 'border-precalib-fg/40 bg-precalib-bg text-precalib-fg'
          : 'border-border bg-muted text-muted-foreground',
        className
      )}
      data-testid="coverage-chip"
    >
      {populated}/{total}
    </span>
  );
}
