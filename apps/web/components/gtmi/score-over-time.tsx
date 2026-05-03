import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ProgramDetailScoreHistoryPoint } from '@/lib/queries/program-detail-types';

export interface ScoreOverTimeProps {
  /** Oldest → newest, as returned by program-detail.ts. */
  history: ProgramDetailScoreHistoryPoint[];
  className?: string;
}

const CHART_W = 640;
const CHART_H = 160;
const MARGIN = { top: 16, right: 28, bottom: 28, left: 36 };
const INNER_W = CHART_W - MARGIN.left - MARGIN.right;
const INNER_H = CHART_H - MARGIN.top - MARGIN.bottom;

const Y_MIN = 0;
const Y_MAX = 100;
const Y_TICKS = [0, 25, 50, 75, 100];

/**
 * Phase 3.10d / E.2 — full-width score-over-time panel for the
 * programme detail page. Plots composite + PAQ + CME from
 * `score_history` with x-axis dates, y-axis 0–100, and explicit
 * markers for the first / latest / methodology-version-bump points.
 *
 * Server-rendered SVG (no client JS) so the page stays fast and
 * deep-linkable. Tooltips are pure title attrs — accessible by
 * default, no hover state required.
 *
 * Falls back to an empty state when fewer than 2 history points
 * exist, since one point is just a value, not a trajectory.
 */
export function ScoreOverTime({ history, className }: ScoreOverTimeProps) {
  if (history.length < 2) {
    return (
      <div
        className={cn('px-12 py-12', className)}
        style={{ borderTop: '1px solid var(--rule)', background: 'var(--paper)' }}
        data-testid="score-over-time-empty"
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Score over time</p>
          <h2
            className="serif text-ink"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Awaiting history.
          </h2>
          <p className="mt-4 max-w-prose italic text-ink-4" style={{ fontSize: 14 }}>
            {history.length === 0
              ? "This programme hasn't been scored yet, or its score_history rows pre-date the Phase 3.10b.4 timeline column."
              : 'Only one scoring run on file — at least two are needed to plot a trajectory.'}
          </p>
        </div>
      </div>
    );
  }

  const xs = history.map((p) => new Date(p.scoredAt).getTime());
  const xMin = xs[0]!;
  const xMax = xs[xs.length - 1]!;
  const xRange = xMax - xMin || 1;

  const projectX = (t: number) => MARGIN.left + ((t - xMin) / xRange) * INNER_W;
  const projectY = (v: number) =>
    MARGIN.top +
    INNER_H -
    ((Math.max(Y_MIN, Math.min(Y_MAX, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * INNER_H;

  type SeriesKey = 'composite' | 'paq' | 'cme';
  const SERIES: { key: SeriesKey; label: string; color: string; strokeWidth: number }[] = [
    { key: 'composite', label: 'Composite', color: 'var(--ink)', strokeWidth: 1.5 },
    { key: 'paq', label: 'PAQ', color: 'var(--ink-3)', strokeWidth: 1 },
    { key: 'cme', label: 'CME', color: 'var(--accent)', strokeWidth: 1 },
  ];

  const buildPath = (key: SeriesKey): string => {
    const segments: string[] = [];
    let pendingMove = true;
    for (let i = 0; i < history.length; i++) {
      const v = history[i]![key];
      if (v === null) {
        pendingMove = true;
        continue;
      }
      const x = projectX(xs[i]!);
      const y = projectY(v);
      segments.push(`${pendingMove ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      pendingMove = false;
    }
    return segments.join(' ');
  };

  const first = history[0]!;
  const last = history[history.length - 1]!;
  const compositeFirst = first.composite;
  const compositeLast = last.composite;
  const compositeDelta =
    compositeFirst !== null && compositeLast !== null ? compositeLast - compositeFirst : null;

  const versionBumps: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1]!.methodologyVersion;
    const b = history[i]!.methodologyVersion;
    if (a !== b && b !== null) versionBumps.push(i);
  }

  return (
    <section
      className={cn('px-12 py-12', className)}
      style={{ borderTop: '1px solid var(--rule)', background: 'var(--paper)' }}
      data-testid="score-over-time"
    >
      <div className="mx-auto max-w-page">
        <p className="eyebrow mb-3">Score over time</p>
        <h2
          className="serif text-ink"
          style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
        >
          {history.length} scoring run{history.length === 1 ? '' : 's'} on file.
        </h2>
        <p className="mt-4 max-w-prose text-ink-3" style={{ fontSize: 14, lineHeight: 1.55 }}>
          From <DateLabel iso={first.scoredAt} /> to <DateLabel iso={last.scoredAt} />.{' '}
          {compositeDelta !== null && (
            <>
              Composite{' '}
              <span className="num text-ink" style={{ fontWeight: 500 }}>
                {compositeDelta >= 0 ? '+' : ''}
                {compositeDelta.toFixed(1)}
              </span>{' '}
              points across the window.
            </>
          )}
          {versionBumps.length > 0 &&
            ` ${versionBumps.length} methodology bump${versionBumps.length === 1 ? '' : 's'} marked.`}
        </p>

        <figure className="mt-6">
          <svg
            role="img"
            aria-label={`Composite, PAQ, and CME over ${history.length} scoring runs from ${first.scoredAt.slice(0, 10)} to ${last.scoredAt.slice(0, 10)}`}
            width="100%"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block', maxWidth: CHART_W }}
            data-testid="score-over-time-chart"
          >
            {Y_TICKS.map((t) => {
              const y = projectY(t);
              return (
                <g key={`y-${t}`}>
                  <line
                    x1={MARGIN.left}
                    x2={MARGIN.left + INNER_W}
                    y1={y}
                    y2={y}
                    stroke="var(--rule-soft)"
                    strokeWidth="1"
                  />
                  <text
                    x={MARGIN.left - 6}
                    y={y + 3}
                    fontSize="10"
                    textAnchor="end"
                    fill="var(--ink-4)"
                    className="num"
                  >
                    {t}
                  </text>
                </g>
              );
            })}

            {versionBumps.map((idx) => {
              const x = projectX(xs[idx]!);
              return (
                <line
                  key={`v-${idx}`}
                  x1={x}
                  x2={x}
                  y1={MARGIN.top}
                  y2={MARGIN.top + INNER_H}
                  stroke="var(--accent)"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                  opacity="0.5"
                  data-testid="version-bump-line"
                >
                  <title>{`Methodology bump → ${history[idx]!.methodologyVersion ?? 'unknown'}`}</title>
                </line>
              );
            })}

            {SERIES.map((s) => (
              <path
                key={s.key}
                d={buildPath(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                data-series={s.key}
              />
            ))}

            {history.map((p, i) => {
              if (p.composite === null) return null;
              const x = projectX(xs[i]!);
              const y = projectY(p.composite);
              return (
                <circle
                  key={`p-${i}`}
                  cx={x}
                  cy={y}
                  r={i === 0 || i === history.length - 1 ? 3 : 1.6}
                  fill={i === history.length - 1 ? 'var(--ink)' : 'var(--ink-3)'}
                >
                  <title>{`${p.scoredAt.slice(0, 10)}: composite ${p.composite.toFixed(1)}${p.paq !== null ? `, PAQ ${p.paq.toFixed(1)}` : ''}${p.cme !== null ? `, CME ${p.cme.toFixed(1)}` : ''}${p.methodologyVersion ? ` (${p.methodologyVersion})` : ''}`}</title>
                </circle>
              );
            })}

            <text x={MARGIN.left} y={CHART_H - 8} fontSize="10" fill="var(--ink-4)" className="num">
              {first.scoredAt.slice(0, 10)}
            </text>
            <text
              x={MARGIN.left + INNER_W}
              y={CHART_H - 8}
              fontSize="10"
              textAnchor="end"
              fill="var(--ink-4)"
              className="num"
            >
              {last.scoredAt.slice(0, 10)}
            </text>
          </svg>

          <figcaption className="mt-4 flex flex-wrap gap-4 text-data-sm text-ink-3">
            {SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 2,
                    background: s.color,
                  }}
                />
                {s.label}
              </span>
            ))}
            {versionBumps.length > 0 && (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 0,
                    borderTop: '1px dashed var(--accent)',
                    opacity: 0.7,
                  }}
                />
                Methodology bump
              </span>
            )}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function DateLabel({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} className="num text-ink">
      {iso.slice(0, 10)}
    </time>
  );
}
