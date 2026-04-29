import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export interface PillarMiniBarsProps {
  /** Map of pillar score 0-100. Null/undefined values render as inactive bars. */
  scores: Record<PillarKey, number | null | undefined> | null;
  /** Bar row height in pixels. Default: 22 (design's PillarMini). */
  height?: number;
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
 * Five 6px-wide vertical pillar bars used in dense rankings rows.
 *
 * Editorial restyle (Phase 4-A): trackless, hard-edged, 6px width per the
 * design's PillarMini atom. Hover reveals the pillar name + numeric score
 * via the native title attribute.
 */
export function PillarMiniBars({ scores, height = 22, className }: PillarMiniBarsProps) {
  return (
    <div
      className={cn('flex items-end gap-[3px]', className)}
      style={{ height }}
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
        const barHeight = isUnscored ? 2 : Math.max(2, (v / 100) * height);
        return (
          <span
            key={k}
            title={`${PILLAR_LABEL[k]}: ${isUnscored ? '—' : v.toFixed(0)}`}
            style={{
              width: 6,
              height: `${barHeight}px`,
              background: isUnscored ? 'var(--rule)' : PILLAR_COLORS[k],
              opacity: isUnscored ? 1 : 0.85,
              display: 'block',
            }}
          />
        );
      })}
    </div>
  );
}
