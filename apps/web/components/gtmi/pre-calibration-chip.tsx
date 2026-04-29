'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

const POPOVER_COPY = `Pre-calibration scores use engineer-chosen normalization parameters because cohort-wide calibration requires at least 5 scored programs. Calibration completes in Phase 5. These scores are correct in their relative methodology application but their absolute values will shift once calibrated against the full pilot cohort.`;

export interface PreCalibrationChipProps {
  size?: 'sm' | 'md';
  /** Compact label "Pre-cal" (used in dense table cells); full label "Pre-calibration"
   *  on detail headers. Default: 'sm' → "Pre-cal", 'md' → "Pre-calibration". */
  label?: string;
  className?: string;
}

/**
 * Renders next to any score derived from a row with
 * `scores.metadata.phase2Placeholder = true`. Mandatory per dispatch §4.
 *
 * Editorial restyle (Phase 4-A): chip rule from docs/design/styles.css —
 * amber-on-cream, hard corners, uppercase tracking.
 */
export function PreCalibrationChip({ size = 'sm', label, className }: PreCalibrationChipProps) {
  const text = label ?? (size === 'sm' ? 'Pre-cal' : 'Pre-calibration');
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Pre-calibration score, click for explanation"
          className={cn(
            'chip chip-amber inline-flex cursor-help items-center gap-1',
            size === 'md' && 'h-6 text-[12px]',
            className
          )}
          data-testid="pre-calibration-chip"
        >
          {text}
          <span aria-hidden className="text-[9px] leading-none">
            ?
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 max-w-sm border border-rule bg-popover px-4 py-3 text-data-sm leading-relaxed text-popover-foreground shadow-lg"
          sideOffset={6}
          collisionPadding={12}
        >
          {POPOVER_COPY}
          <Popover.Arrow className="fill-rule" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
