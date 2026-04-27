import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DirectionArrowProps {
  direction: 'higher_is_better' | 'lower_is_better';
  className?: string;
}

/**
 * Tiny inline glyph next to indicator scores so users know which way the
 * scale runs without reading the methodology page. Up arrow = higher is
 * better, down arrow = lower is better.
 */
export function DirectionArrow({ direction, className }: DirectionArrowProps) {
  const isUp = direction === 'higher_is_better';
  return (
    <span
      title={isUp ? 'Higher is better' : 'Lower is better'}
      aria-label={isUp ? 'Higher is better' : 'Lower is better'}
      className={cn('inline-block text-muted-foreground', className)}
      data-testid="direction-arrow"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        {isUp ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
      </svg>
    </span>
  );
}
