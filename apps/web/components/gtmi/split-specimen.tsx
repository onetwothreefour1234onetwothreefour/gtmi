import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SplitSpecimenProps {
  /** CME/PAQ split as fractions (must sum to 1). */
  cmePaqSplit?: { cme: number; paq: number };
  /** Diameter in pixels. Default: 360. */
  size?: number;
  className?: string;
}

/**
 * 30/70 SVG donut + side legend. The PAQ arc is oxblood (heavier weight),
 * the CME arc is navy. Translates docs/design/screen-rankings-v2.jsx:
 * SplitSpecimen.
 *
 * Visualises the composite-score split for the landing page and
 * /methodology. Reads weights live so the seeded methodology version
 * drives the rendering.
 */
export function SplitSpecimen({
  cmePaqSplit = { cme: 0.3, paq: 0.7 },
  size = 360,
  className,
}: SplitSpecimenProps) {
  const r = 90;
  const circumference = 2 * Math.PI * r; // 565.48 at r=90
  const cmePct = Math.round(cmePaqSplit.cme * 100);
  const paqPct = Math.round(cmePaqSplit.paq * 100);

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      data-testid="split-specimen"
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        role="img"
        aria-label={`Composite split: ${paqPct}% PAQ, ${cmePct}% CME`}
        style={{ display: 'block' }}
      >
        {/* PAQ — oxblood arc */}
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="22"
          strokeDasharray={`${cmePaqSplit.paq * circumference} ${circumference}`}
          transform="rotate(-90 100 100)"
        />
        {/* CME — navy arc */}
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--navy)"
          strokeWidth="22"
          strokeDasharray={`${cmePaqSplit.cme * circumference} ${circumference}`}
          strokeDashoffset={-cmePaqSplit.paq * circumference}
          transform="rotate(-90 100 100)"
        />
        <text
          x="100"
          y="92"
          textAnchor="middle"
          fontFamily="var(--font-serif), Georgia, serif"
          fontSize="30"
          fontWeight="500"
          fill="var(--ink)"
        >
          100
        </text>
        <text
          x="100"
          y="112"
          textAnchor="middle"
          fontFamily="var(--font-mono), ui-monospace, monospace"
          fontSize="9"
          fill="var(--ink-3)"
          letterSpacing="2"
        >
          COMPOSITE
        </text>
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 28,
          right: -110,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          width: 110,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, background: 'var(--accent)' }} />
            <div className="num-l" style={{ fontSize: 22 }}>
              {paqPct}%
            </div>
          </div>
          <div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>
            PAQ
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-4)',
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            Programme architecture &amp; quality
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, background: 'var(--navy)' }} />
            <div className="num-l" style={{ fontSize: 22 }}>
              {cmePct}%
            </div>
          </div>
          <div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>
            CME
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-4)',
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            Comparative mobility engine
          </div>
        </div>
      </div>
    </div>
  );
}
