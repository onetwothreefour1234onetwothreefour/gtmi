import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import { ScoreBar } from './score-bar';
import { formatScore } from '@/lib/format';

export interface PillarStripProps {
  pillarScores: Record<PillarKey, number> | null;
  /** Number of indicators per pillar — typically derived from the methodology query. */
  indicatorCounts?: Record<PillarKey, number>;
  /** Pillar weights within PAQ (defaults to methodology v1). */
  pillarWeights?: Record<PillarKey, number>;
  className?: string;
}

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

const DEFAULT_WEIGHTS: Record<PillarKey, number> = {
  A: 0.28,
  B: 0.15,
  C: 0.2,
  D: 0.22,
  E: 0.15,
};

/**
 * 5-cell pillar strip rendered immediately under the program header.
 * Translates the inline pillar grid in docs/design/screen-program.jsx —
 * each cell shows the pillar letter in serif, "Pillar" eyebrow, the
 * methodology label, the pillar score (large mono), the indicator count,
 * and a score bar in the pillar's colour.
 *
 * Renders a muted version when pillarScores is null (programme not yet
 * scored) so the strip still anchors the page visually.
 */
export function PillarStrip({
  pillarScores,
  indicatorCounts,
  pillarWeights = DEFAULT_WEIGHTS,
  className,
}: PillarStripProps) {
  return (
    <section
      className={cn('px-12 pb-0 pt-10', className)}
      style={{ background: 'var(--paper)' }}
      data-testid="pillar-strip"
    >
      <div
        className="mx-auto grid max-w-page grid-cols-1 gap-px border md:grid-cols-5"
        style={{ background: 'var(--rule)', borderColor: 'var(--rule)' }}
      >
        {PILLAR_ORDER.map((p) => {
          const score = pillarScores?.[p] ?? null;
          const indicators = indicatorCounts?.[p];
          return (
            <article
              key={p}
              className="px-5 pb-6 pt-5"
              style={{ background: 'var(--paper)' }}
              data-testid={`pillar-strip-cell-${p}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="serif"
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    color: PILLAR_COLORS[p],
                    lineHeight: 1,
                  }}
                >
                  {p}
                </span>
                <span className="eyebrow" style={{ fontSize: 10 }}>
                  Pillar · {Math.round(pillarWeights[p] * 100)}%
                </span>
              </div>
              <p className="serif" style={{ fontSize: 17, letterSpacing: '-0.01em', margin: 0 }}>
                {PILLAR_LABEL[p]}
              </p>
              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className="num"
                  style={{ fontSize: 22, fontWeight: 600 }}
                  data-testid={`pillar-strip-score-${p}`}
                >
                  {score === null ? '—' : formatScore(score)}
                </span>
                {indicators !== undefined && (
                  <span className="num text-ink-4" style={{ fontSize: 11 }}>
                    {indicators} ind.
                  </span>
                )}
              </div>
              <div className="mt-2">
                <ScoreBar
                  value={score}
                  showLabel={false}
                  width="md"
                  ariaLabel={`Pillar ${p} score`}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
