import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InternalBadgeProps {
  className?: string;
}

/**
 * Editorial "internal only" banner pinned at the top of the (internal)
 * route group. Translates docs/design/screen-internal.jsx:InternalBadge.
 *
 * Ink surface, paper text, oxblood pulse dot, mono uppercase tracking.
 * Renders above the TopNav inversely so the user never confuses an internal
 * surface for a public one.
 */
export function InternalBadge({ className }: InternalBadgeProps) {
  return (
    <div
      className={cn('flex items-center gap-3 px-8 py-2', className)}
      style={{
        background: 'var(--ink)',
        color: 'var(--paper)',
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
      data-testid="internal-badge"
      role="note"
      aria-label="Internal surface"
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          background: 'var(--accent)',
          borderRadius: '50%',
          display: 'inline-block',
        }}
      />
      Internal · TTR Group only · not public
    </div>
  );
}
