'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

const POPOVER_COPY = `Pre-calibration scores use engineer-chosen normalization parameters because cohort-wide calibration requires at least 5 scored programs. Calibration completes in Phase 3. These scores are correct in their relative methodology application but their absolute values will shift once calibrated against the full pilot cohort.`;

export interface PreCalibrationChipProps {
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Renders next to any score derived from a row with
 * `scores.metadata.phase2Placeholder = true`. Mandatory per dispatch §4.
 *
 * Styling: muted amber on warm cream (light) / cream on dark amber (dark).
 * Hover or focus opens a popover with the canonical pre-calibration copy.
 */
export function PreCalibrationChip({ size = 'sm', className }: PreCalibrationChipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Pre-calibration score, click for explanation"
          className={cn(
            'inline-flex cursor-help items-center gap-1 rounded-button bg-precalib-bg px-1.5 font-sans font-medium text-precalib-fg transition-colors',
            size === 'sm' ? 'h-5 text-[10px]' : 'h-6 text-data-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-precalib-fg focus-visible:ring-offset-1',
            className
          )}
          data-testid="pre-calibration-chip"
        >
          Pre-calibration
          <span aria-hidden className="text-[9px] leading-none">
            ?
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 max-w-sm rounded-card border border-border bg-popover px-4 py-3 text-data-sm leading-relaxed text-popover-foreground shadow-lg"
          sideOffset={6}
          collisionPadding={12}
        >
          {POPOVER_COPY}
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
