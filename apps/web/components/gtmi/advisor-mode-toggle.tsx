'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { WeightSlider } from './weight-slider';
import { DEFAULT_PILLAR_WEIGHTS, type PillarWeights } from '@/lib/advisor-mode';

export interface AdvisorModeToggleProps {
  weights: PillarWeights | null;
  onWeightsChange: (next: PillarWeights | null) => void;
  scoredCount: number;
  className?: string;
}

/**
 * Editorial advisor toggle — Phase 4-B restyle. Hairline rule frame
 * instead of rounded card; uppercase eyebrow + Fraunces body; the
 * disclosed slider grid keeps its existing UX.
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
      className={cn('flex flex-col gap-3 border bg-paper-2 p-4', className)}
      style={{ borderColor: 'var(--rule)' }}
      data-testid="advisor-mode-toggle"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="eyebrow">Advisor mode</p>
          <p className="max-w-prose text-data-sm text-ink-3">
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
            'inline-flex h-8 w-14 items-center border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            isOn ? 'bg-accent' : 'bg-paper'
          )}
          style={{ borderColor: isOn ? 'var(--accent)' : 'var(--rule)' }}
        >
          <span
            className={cn(
              'block h-6 w-6 transition-transform',
              isOn ? 'translate-x-6 bg-paper' : 'translate-x-0 bg-ink'
            )}
            aria-hidden
          />
          <span className="sr-only">{isOn ? 'Disable advisor mode' : 'Enable advisor mode'}</span>
        </button>
      </header>

      {isOn && weights && (
        <>
          <WeightSlider weights={weights} onChange={onWeightsChange} />
          <p className="text-data-sm text-ink-4">
            Custom weights apply to scored programs only (currently{' '}
            <span className="num text-ink">{scoredCount}</span>). Unscored rows stay at the bottom
            regardless of weights.
          </p>
        </>
      )}
    </section>
  );
}
