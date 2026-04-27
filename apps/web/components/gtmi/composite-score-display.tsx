import * as React from 'react';
import { cn } from '@/lib/utils';
import { scoreColor } from '@/lib/theme';
import { PreCalibrationChip } from './pre-calibration-chip';

export interface CompositeScoreDisplayProps {
  composite: number | null;
  cme: number | null;
  paq: number | null;
  phase2Placeholder?: boolean;
  rank?: number | null;
  scoredCount?: number | null;
  className?: string;
}

/**
 * Headline composite score on the program detail page.
 * 96–120px serif/mono headline + sequential-color bar + CME/PAQ split.
 *
 * Per dispatch §4 the pre-calibration chip must sit *visibly beside* the
 * composite, not tucked away. We keep it on the same baseline as the rank
 * line so it can never be missed.
 */
export function CompositeScoreDisplay({
  composite,
  cme,
  paq,
  phase2Placeholder = false,
  rank,
  scoredCount,
  className,
}: CompositeScoreDisplayProps) {
  const isUnscored = composite === null;
  const fill = scoreColor(composite);

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="composite-score-display">
      <div className="flex items-end gap-6">
        <div className="flex flex-col">
          <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
            Composite score
          </p>
          <div className="flex items-baseline gap-3">
            <span
              className={cn(
                'font-mono font-semibold tnum',
                isUnscored ? 'text-muted-foreground' : 'text-ink',
                'text-[96px] leading-none md:text-[120px]'
              )}
              data-testid="composite-score-value"
            >
              {isUnscored ? '—' : composite.toFixed(2)}
            </span>
            {phase2Placeholder && !isUnscored && <PreCalibrationChip size="md" />}
          </div>
        </div>

        <div className="flex flex-col gap-1 pb-3 text-data-md">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground">CME</span>
            <span className="font-mono tnum">{cme === null ? '—' : cme.toFixed(2)}</span>
            <span className="text-muted-foreground">· 30%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground">PAQ</span>
            <span className="font-mono tnum">{paq === null ? '—' : paq.toFixed(2)}</span>
            <span className="text-muted-foreground">· 70%</span>
          </div>
        </div>
      </div>

      <div className="h-2 w-full max-w-md rounded-table bg-muted" aria-hidden>
        <div
          className="h-full rounded-table"
          style={{
            width: `${isUnscored ? 0 : Math.max(0, Math.min(100, composite))}%`,
            backgroundColor: isUnscored ? 'transparent' : fill,
          }}
        />
      </div>

      <p className="text-data-sm text-muted-foreground">
        {isUnscored
          ? 'Not yet scored — Phase 3'
          : rank && scoredCount
            ? `Rank: #${rank} of ${scoredCount} scored programs`
            : null}
      </p>
    </div>
  );
}
