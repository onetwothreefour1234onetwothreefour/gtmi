'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { WeightSlider } from './weight-slider';
import { DEFAULT_PILLAR_WEIGHTS, type PillarWeights } from '@/lib/advisor-mode';

export interface AdvisorModeToggleProps {
  /** Current weights — null means advisor mode is off (default weights apply). */
  weights: PillarWeights | null;
  onWeightsChange: (next: PillarWeights | null) => void;
  /** Number of scored programs in the current cohort, for the disclosure note. */
  scoredCount: number;
  className?: string;
}

/**
 * Toggle row + collapsible weight slider grid. When advisor mode is off the
 * rankings table uses the methodology default weights and never reweights
 * client-side. When on, the parent passes `weights` through to RankingsTable
 * which recomputes PAQ + composite + rank ordinals.
 *
 * Editorial note: the WeightSlider primitive landed in 4.1. This commit
 * wires it into the page through a parent-owned weight state with a single
 * collapsible disclosure, plus a footnote explaining what the recomputation
 * affects.
 */
export function AdvisorModeToggle({
  weights,
  onWeightsChange,
  scoredCount,
  className,
}: AdvisorModeToggleProps) {
  const isOn = weights !== null;

  return (
    <section
      aria-label="Advisor mode"
      className={cn(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-4',
        className
      )}
      data-testid="advisor-mode-toggle"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
            Advisor mode
          </p>
          <p className="max-w-prose text-data-sm text-muted-foreground">
            Reweight the five pillars to your client&rsquo;s priorities. The composite rebalances
            live; CME stays at 30% per the methodology.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          onClick={() => onWeightsChange(isOn ? null : { ...DEFAULT_PILLAR_WEIGHTS })}
          className={cn(
            'inline-flex h-8 w-14 items-center rounded-full border border-border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            isOn ? 'bg-accent' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'block h-6 w-6 rounded-full bg-surface shadow transition-transform',
              isOn ? 'translate-x-6' : 'translate-x-0'
            )}
            aria-hidden
          />
          <span className="sr-only">{isOn ? 'Disable advisor mode' : 'Enable advisor mode'}</span>
        </button>
      </header>

      {isOn && weights && (
        <>
          <WeightSlider weights={weights} onChange={onWeightsChange} />
          <p className="text-data-sm text-muted-foreground">
            Custom weights apply to scored programs only (currently{' '}
            <span className="font-mono tnum text-foreground">{scoredCount}</span>). Unscored rows
            stay at the bottom regardless of weights.
          </p>
        </>
      )}
    </section>
  );
}
