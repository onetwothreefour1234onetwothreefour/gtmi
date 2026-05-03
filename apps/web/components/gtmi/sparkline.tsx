import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SparklineProps {
  /** Time-ordered values (oldest → newest). 2+ points required. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke colour for the polyline. Default: var(--ink-3). */
  color?: string;
  /** End-marker colour when the trend is *down*. Default: var(--accent). */
  highlight?: string;
  /** Optional override for accessible label. Default reads off the values. */
  ariaLabel?: string;
  /**
   * Phase 3.10d / E.1 — disclosure: 'real' when values come from
   * score_history (≥ MIN_REAL_HISTORY points), 'placeholder' when the
   * caller fell back to the deterministic pseudo-walk. Surfaces as a
   * data attribute on the SVG so tests + analyst tooling can tell the
   * two apart without re-deriving from values.
   */
  dataSource?: 'real' | 'placeholder';
  className?: string;
}

/**
 * 12-point editorial sparkline. Small, hairline stroke, first/last point
 * markers; the last point is positive-green when the trend is up,
 * accent-oxblood when down. Translates docs/design/primitives.jsx:Sparkline.
 *
 * Phase 4 reality: the `scores` table has too little history to plot real
 * data. Consumers pass a deterministic pseudo-walk (Q7) until Phase 5/6
 * lights up multi-month history.
 */
export function Sparkline({
  values,
  width = 64,
  height = 18,
  color = 'var(--ink-3)',
  highlight = 'var(--accent)',
  ariaLabel,
  dataSource,
  className,
}: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map<[number, number]>((v, i) => [
    i * stepX,
    height - 2 - ((v - min) / range) * (height - 4),
  ]);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const trendUp = values[values.length - 1] >= values[0];

  const label =
    ariaLabel ??
    `Sparkline: ${values.length} points, trend ${trendUp ? 'up' : 'down'}, latest ${values[values.length - 1].toFixed(1)}.`;

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block overflow-visible', className)}
      data-testid="sparkline"
      data-trend={trendUp ? 'up' : 'down'}
      data-source={dataSource}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx={first[0]} cy={first[1]} r="1.4" fill={color} opacity="0.4" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={trendUp ? 'var(--positive)' : highlight} />
    </svg>
  );
}

/**
 * Deterministic 12-month pseudo-walk used to render trend sparklines on
 * the rankings table while the score-history table is too thin (Q7).
 * Stable per `seed` + `composite`; the last value is pinned to `composite`
 * so the row's right-edge dot matches the displayed score exactly.
 *
 * Documented in DataTableNote on the rankings table — this is a
 * disclosure, not silently faked data.
 */
export function deterministicTrend(seedKey: string, composite: number, points = 12): number[] {
  // FNV-1a 32-bit on the seedKey so trends are stable per programme id.
  let h = 0x811c9dc5;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  let seed = (h % 233280) + 1;
  const arr: number[] = [];
  for (let i = 0; i < points; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const noise = (seed / 233280 - 0.5) * 4;
    const drift = (i - (points - 1) / 2) * 0.15;
    arr.push(Math.max(20, Math.min(95, composite + drift + noise)));
  }
  arr[arr.length - 1] = composite;
  return arr;
}
