import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export interface MethodologyBarProps {
  cmePaqSplit: { cme: number; paq: number };
  pillarWeights: Record<PillarKey, number>;
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
 * Inline composite-structure diagram. Top row: CME 30 / PAQ 70 split.
 * Bottom row: PAQ broken into the 5 pillars by weight. Click any segment
 * to jump to that section in /methodology.
 *
 * Phase 4.1 ships this as visual-only; the linking is wired in 4.4 when
 * /methodology lands.
 */
export function MethodologyBar({ cmePaqSplit, pillarWeights, className }: MethodologyBarProps) {
  const cmePct = Math.round(cmePaqSplit.cme * 100);
  const paqPct = Math.round(cmePaqSplit.paq * 100);

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="methodology-bar">
      <div className="flex h-6 w-full overflow-hidden rounded-table border border-border">
        <div
          className="flex items-center justify-center bg-muted text-data-sm text-muted-foreground"
          style={{ width: `${cmePct}%` }}
        >
          CME · {cmePct}%
        </div>
        <div
          className="flex items-center justify-center bg-accent text-data-sm text-accent-foreground"
          style={{ width: `${paqPct}%` }}
        >
          PAQ · {paqPct}%
        </div>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-table">
        {PILLAR_ORDER.map((p) => (
          <span
            key={p}
            title={`${p} ${PILLAR_LABEL[p]} — ${Math.round(pillarWeights[p] * 100)}% of PAQ`}
            style={{
              width: `${pillarWeights[p] * paqPct}%`,
              backgroundColor: PILLAR_COLORS[p],
            }}
          />
        ))}
        <span className="bg-muted" style={{ width: `${cmePct}%` }} />
      </div>

      <div className="flex flex-wrap gap-3 text-data-sm text-muted-foreground">
        {PILLAR_ORDER.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-table"
              style={{ backgroundColor: PILLAR_COLORS[p] }}
              aria-hidden
            />
            <span className="font-mono">{p}</span> {PILLAR_LABEL[p]}{' '}
            <span className="font-mono tnum">{Math.round(pillarWeights[p] * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
