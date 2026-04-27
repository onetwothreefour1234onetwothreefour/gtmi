import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export interface PillarMiniBarsProps {
  /** Map of pillar score 0-100. Null/undefined values render as inactive bars. */
  scores: Record<PillarKey, number | null | undefined> | null;
  className?: string;
}

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];
const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

/**
 * 5 vertical 8×24px bars used in dense rankings rows. Fully greyed when
 * `scores` is null (unscored program). Hover reveals the pillar name +
 * numeric score via the native title attribute (lightweight; full
 * tooltip with shadcn lands in 4.2 if needed).
 */
export function PillarMiniBars({ scores, className }: PillarMiniBarsProps) {
  return (
    <div
      className={cn('flex items-end gap-1', className)}
      role="img"
      aria-label={
        scores
          ? PILLAR_ORDER.map((k) => `${PILLAR_LABEL[k]}: ${scores[k]?.toFixed?.(0) ?? '—'}`).join(
              ', '
            )
          : 'No pillar scores'
      }
      data-testid="pillar-mini-bars"
    >
      {PILLAR_ORDER.map((k) => {
        const v = scores?.[k];
        const isUnscored = v === null || v === undefined;
        const heightPct = isUnscored ? 8 : Math.max(4, Math.min(100, v));
        return (
          <span
            key={k}
            title={`${PILLAR_LABEL[k]}: ${isUnscored ? '—' : v.toFixed(0)}`}
            className="flex h-6 w-2 items-end overflow-hidden rounded-table bg-muted"
          >
            <span
              className="block w-full rounded-table"
              style={{
                height: `${heightPct}%`,
                backgroundColor: isUnscored ? 'transparent' : PILLAR_COLORS[k],
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
