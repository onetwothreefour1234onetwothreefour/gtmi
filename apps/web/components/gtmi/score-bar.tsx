import * as React from 'react';
import { cn } from '@/lib/utils';
import { scoreColor } from '@/lib/theme';
import { PreCalibrationChip } from './pre-calibration-chip';

export interface ScoreBarProps {
  /** 0-100 score, or null/undefined when the program is not scored. */
  value: number | null | undefined;
  /** Render the pre-calibration chip when the source row has phase2Placeholder=true. */
  phase2Placeholder?: boolean;
  /** Visual size of the bar. Defaults to md. */
  width?: 'sm' | 'md' | 'lg';
  /** Show the numeric label alongside the bar. Defaults to true. */
  showLabel?: boolean;
  /** Override aria-label; default reads "Score: X.XX out of 100". */
  ariaLabel?: string;
  className?: string;
}

const HEIGHT_BY_WIDTH = {
  sm: 'h-[3px]',
  md: 'h-1',
  lg: 'h-1.5',
} as const;

const TEXT_SIZE_BY_WIDTH = {
  sm: 'text-data-sm',
  md: 'text-data-md',
  lg: 'text-data-lg',
} as const;

/**
 * 0-100 score rendered as a numeric label + sequential-color bar.
 * Higher is better. Sequential scale defined in lib/theme.ts.
 *
 * Editorial restyle (Phase 4-A): hard-edged track, rule-soft background,
 * tighter heights to read closer to the design's `score-bar` atom.
 *
 * When `phase2Placeholder` is true, renders <PreCalibrationChip> inline.
 * When `value` is null/undefined, renders the muted "Not yet scored" state
 * with a greyed bar — never silently a 0.
 */
export function ScoreBar({
  value,
  phase2Placeholder = false,
  width = 'md',
  showLabel = true,
  ariaLabel,
  className,
}: ScoreBarProps) {
  const isUnscored = value === null || value === undefined;
  const clamped = isUnscored ? 0 : Math.max(0, Math.min(100, value));
  const fill = scoreColor(value);
  const label = isUnscored ? 'Not yet scored' : clamped.toFixed(2);
  const computedAriaLabel =
    ariaLabel ?? (isUnscored ? 'Not yet scored' : `Score: ${clamped.toFixed(2)} out of 100`);

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      data-testid="score-bar"
      data-unscored={isUnscored ? 'true' : 'false'}
    >
      {showLabel && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'tnum font-mono font-semibold',
              TEXT_SIZE_BY_WIDTH[width],
              isUnscored && 'italic text-muted-foreground'
            )}
            data-testid="score-bar-label"
          >
            {label}
          </span>
          {phase2Placeholder && !isUnscored && <PreCalibrationChip />}
        </div>
      )}
      <div
        className={cn('w-full bg-rule-soft', HEIGHT_BY_WIDTH[width])}
        role="img"
        aria-label={computedAriaLabel}
        data-testid="score-bar-track"
      >
        <div
          className="h-full transition-all duration-200"
          style={{
            width: `${clamped}%`,
            backgroundColor: isUnscored ? 'transparent' : fill,
          }}
          data-testid="score-bar-fill"
        />
      </div>
    </div>
  );
}
