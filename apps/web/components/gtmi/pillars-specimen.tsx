import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export interface PillarsSpecimenProps {
  /** Per-pillar weight as fraction of PAQ (must sum to 1). Default: methodology v1. */
  pillarWeights?: Record<PillarKey, number>;
  /** Total artefact width in pixels. Default: 600. */
  width?: number;
  className?: string;
}

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

const DEFAULT_WEIGHTS: Record<PillarKey, number> = {
  A: 0.28,
  B: 0.15,
  C: 0.2,
  D: 0.22,
  E: 0.15,
};

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Five-letter typographic poster: one column per pillar, each with a top
 * accent stripe in the pillar colour, the letter in 56px Fraunces, the
 * methodology label, and the weight rendered as `NN% wt`.
 *
 * Translates docs/design/screen-rankings-v2.jsx:PillarsSpecimen, with the
 * pillar labels mapped to the methodology vocabulary
 * (Access/Process/Rights/Pathway/Stability per analyst Q1).
 */
export function PillarsSpecimen({
  pillarWeights = DEFAULT_WEIGHTS,
  width = 600,
  className,
}: PillarsSpecimenProps) {
  return (
    <div
      className={cn('grid grid-cols-5', className)}
      style={{
        width,
        border: '1px solid var(--rule)',
        background: 'var(--paper)',
      }}
      data-testid="pillars-specimen"
    >
      {PILLAR_ORDER.map((k, i) => {
        const weightPct = Math.round(pillarWeights[k] * 100);
        return (
          <div
            key={k}
            style={{
              padding: '24px 16px',
              borderRight: i < 4 ? '1px solid var(--rule)' : 0,
              textAlign: 'left',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: PILLAR_COLORS[k],
              }}
            />
            <div
              className="serif"
              style={{
                fontSize: 56,
                fontWeight: 400,
                color: PILLAR_COLORS[k],
                lineHeight: 1,
                marginTop: 8,
                letterSpacing: '-0.04em',
              }}
            >
              {k}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                marginTop: 12,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {PILLAR_LABEL[k]}
            </div>
            <div className="num" style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>
              {weightPct}% wt
            </div>
          </div>
        );
      })}
    </div>
  );
}
