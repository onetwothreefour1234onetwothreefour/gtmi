import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  MUTED_DOT_COLOR,
  QUINTILE_COLORS,
  WORLD_MAP_DOTS,
  WORLD_MAP_GRID,
  compositeQuintile,
} from '@/lib/data/world-map-coordinates';

export interface WorldMapCountryScore {
  iso: string;
  /** Composite score 0–100. Null/undefined => muted dot. */
  composite: number | null;
}

export interface WorldMapProps {
  /** Per-country composite (top-scoring programme per country). */
  scores: WorldMapCountryScore[];
  className?: string;
}

interface DotResolution {
  fill: string;
  scored: boolean;
  composite: number | null;
}

function resolveDot(iso: string, scoreByIso: Map<string, number>): DotResolution {
  const composite = scoreByIso.get(iso);
  if (composite === undefined || composite === null) {
    return { fill: MUTED_DOT_COLOR, scored: false, composite: null };
  }
  return { fill: QUINTILE_COLORS[compositeQuintile(composite)], scored: true, composite };
}

/**
 * Dot-matrix world map. Translates docs/design/screen-rankings-v2.jsx:WorldMap.
 * Each cohort country's top-scoring composite drives a coloured dot;
 * out-of-cohort dots are drawn muted so the silhouette reads.
 *
 * Coordinates live in `lib/data/world-map-coordinates.ts` so they're
 * trivially tested + edited without touching JSX.
 */
export function WorldMap({ scores, className }: WorldMapProps) {
  const scoreByIso = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scores) {
      if (s.composite !== null && s.composite !== undefined) m.set(s.iso, s.composite);
    }
    return m;
  }, [scores]);

  const { cols, rows, cellSize } = WORLD_MAP_GRID;

  // Quintile counts for the legend.
  const quintileCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const composite of scoreByIso.values()) {
    quintileCounts[compositeQuintile(composite)] += 1;
  }

  return (
    <section
      className={cn('grid gap-12 md:grid-cols-[1fr_240px]', className)}
      data-testid="world-map"
    >
      <div>
        <svg
          viewBox={`0 0 ${cols * cellSize} ${rows * cellSize}`}
          width="100%"
          role="img"
          aria-label="The world by composite — dot matrix scoring map"
          className="block"
        >
          {/* Faint background grid — anchors the eye, not data. */}
          {Array.from({ length: rows * cols }, (_, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            return (
              <circle
                key={`bg-${r}-${c}`}
                cx={c * cellSize + cellSize / 2}
                cy={r * cellSize + cellSize / 2}
                r={1}
                fill="var(--rule-soft)"
              />
            );
          })}
          {WORLD_MAP_DOTS.map((dot, i) => {
            const resolved = resolveDot(dot.iso, scoreByIso);
            return (
              <g key={`dot-${i}-${dot.iso}`}>
                <title>
                  {dot.name}
                  {resolved.scored ? ` · ${resolved.composite?.toFixed(1)}` : ' · out of cohort'}
                </title>
                <circle
                  data-testid="world-map-dot"
                  data-iso={dot.iso}
                  data-scored={resolved.scored ? 'true' : 'false'}
                  cx={dot.col * cellSize + cellSize / 2}
                  cy={dot.row * cellSize + cellSize / 2}
                  r={resolved.scored ? 5.5 : 3.5}
                  fill={resolved.fill}
                  stroke={resolved.scored ? 'rgba(0,0,0,0.08)' : 'var(--rule)'}
                  strokeWidth={0.5}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div>
        <p className="eyebrow mb-3">Composite quintile</p>
        <ul className="flex flex-col">
          {([5, 4, 3, 2, 1] as const).map((tier, idx) => {
            const range =
              tier === 5
                ? '70 +'
                : tier === 4
                  ? '60–70'
                  : tier === 3
                    ? '50–60'
                    : tier === 2
                      ? '40–50'
                      : '< 40';
            return (
              <li
                key={tier}
                className={cn(
                  'flex items-center gap-3 border-b border-rule py-2',
                  idx === 0 && 'border-t border-rule'
                )}
              >
                <span
                  className="block h-3.5 w-3.5 rounded-full"
                  style={{ background: QUINTILE_COLORS[tier] }}
                  aria-hidden
                />
                <span className="serif text-data-md">Tier {6 - tier}</span>
                <span className="num ml-auto text-data-sm text-ink-3">{range}</span>
                <span className="num w-8 text-right text-data-sm text-ink-4">
                  {quintileCounts[tier]}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-data-sm leading-relaxed text-ink-4">
          Counts reflect top-scoring programmes per jurisdiction in the current run. Phase 5
          calibration may shift quintile boundaries.
        </p>
      </div>
    </section>
  );
}
