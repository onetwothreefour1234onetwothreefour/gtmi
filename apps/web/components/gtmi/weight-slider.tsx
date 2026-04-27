'use client';

import * as React from 'react';
import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import {
  DEFAULT_PILLAR_WEIGHTS,
  rebalancePillarWeights,
  type PillarWeights,
} from '@/lib/advisor-mode';

const PILLARS: { key: PillarKey; label: string }[] = [
  { key: 'A', label: 'Access' },
  { key: 'B', label: 'Process' },
  { key: 'C', label: 'Rights' },
  { key: 'D', label: 'Pathway' },
  { key: 'E', label: 'Stability' },
];

export interface WeightSliderProps {
  weights: PillarWeights;
  onChange: (next: PillarWeights) => void;
  className?: string;
}

/**
 * Five sliders for the 5 pillar weights. Sum is always 1.0 — moving one
 * slider redistributes the delta proportionally across the other four
 * (see lib/advisor-mode.ts). All numbers shown as percentages, 0-100%.
 *
 * "Reset to default" link restores METHODOLOGY §1.1 weights.
 */
export function WeightSlider({ weights, onChange, className }: WeightSliderProps) {
  const total = Math.round(Object.values(weights).reduce((s, w) => s + w, 0) * 100);

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="weight-slider">
      <div className="flex items-baseline justify-between">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          Pillar weights
        </p>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_PILLAR_WEIGHTS })}
          className="text-data-sm text-accent underline-offset-4 hover:underline"
        >
          Reset to default
        </button>
      </div>

      {PILLARS.map(({ key, label }) => {
        const pct = Math.round(weights[key] * 100);
        return (
          <div key={key} className="grid grid-cols-[80px_1fr_48px] items-center gap-3">
            <label htmlFor={`weight-${key}`} className="font-mono text-data-sm">
              {key} · {label}
            </label>
            <Slider.Root
              id={`weight-${key}`}
              value={[pct]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onChange(rebalancePillarWeights(weights, key, v / 100))}
              className="relative flex h-5 touch-none select-none items-center"
              data-testid={`weight-slider-${key}`}
            >
              <Slider.Track className="relative h-1 w-full grow rounded-table bg-muted">
                <Slider.Range
                  className="absolute h-full rounded-table"
                  style={{ backgroundColor: PILLAR_COLORS[key] }}
                />
              </Slider.Track>
              <Slider.Thumb
                aria-label={`${label} weight`}
                className="block h-4 w-4 rounded-full border border-border bg-surface shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </Slider.Root>
            <span className="text-right font-mono text-data-sm tnum">{pct}%</span>
          </div>
        );
      })}

      <p className="mt-1 text-data-sm text-muted-foreground">
        Total: <span className="font-mono tnum">{total}%</span>
        {total !== 100 && <span className="ml-2 text-destructive">(rounding artefact)</span>}
      </p>
    </div>
  );
}
