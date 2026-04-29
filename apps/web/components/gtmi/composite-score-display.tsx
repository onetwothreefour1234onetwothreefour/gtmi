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
 *
 * Phase 4-A rebuild — design's `ProgramHeader` right-column plate:
 * paper-2 surface, oxblood ScoreBar, large Fraunces serif numeral,
 * PAQ/CME split below a thin rule. The pre-calibration chip sits beside
 * the rank line so it's never tucked away (dispatch §4 still applies).
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
  const fill = isUnscored ? 'transparent' : scoreColor(composite);
  const pct = isUnscored ? 0 : Math.max(0, Math.min(100, composite));

  return (
    <aside
      className={cn('border border-rule bg-paper-2 px-6 py-6', className)}
      data-testid="composite-score-display"
    >
      <div className="eyebrow" style={{ marginBottom: 16 }}>
        Composite score
      </div>

      <div className="flex items-end justify-between gap-4">
        <span
          className={cn('num-l', isUnscored ? 'text-muted-foreground' : 'text-ink')}
          style={{ fontSize: 56, lineHeight: 1 }}
          data-testid="composite-score-value"
        >
          {isUnscored ? '—' : composite.toFixed(2)}
        </span>
        <div className="text-right">
          {rank && scoredCount && !isUnscored ? (
            <p className="num text-data-sm text-ink-3">
              Rank #{rank} of {scoredCount}
            </p>
          ) : (
            <p className="text-data-sm italic text-muted-foreground">
              {isUnscored ? 'Not yet scored' : null}
            </p>
          )}
          {phase2Placeholder && !isUnscored && (
            <div className="mt-2 inline-flex">
              <PreCalibrationChip />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full bg-rule-soft" aria-hidden>
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: fill }} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-rule pt-5">
        <div>
          <p className="eyebrow" style={{ fontSize: 10 }}>
            PAQ · 70% weight
          </p>
          <p className="num-l mt-1" style={{ fontSize: 22 }}>
            {paq === null ? '—' : paq.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ fontSize: 10 }}>
            CME · 30% weight
          </p>
          <p className="num-l mt-1" style={{ fontSize: 22 }}>
            {cme === null ? '—' : cme.toFixed(2)}
          </p>
        </div>
      </div>
    </aside>
  );
}
