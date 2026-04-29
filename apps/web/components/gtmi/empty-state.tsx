import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  body: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}

/**
 * Standard placeholder for surfaces with no data yet (Phase 4 → 5/6
 * empty states, the unscored-program panel, missing-narrative slot).
 * Editorial restyle (Phase 4-A): paper-2 surface, dashed rule border,
 * Fraunces title.
 */
export function EmptyState({ title, body, ctaHref, ctaLabel, className }: EmptyStateProps) {
  return (
    <div
      className={cn('border border-dashed border-rule bg-paper-2 p-6 text-data-md', className)}
      data-testid="empty-state"
      role="status"
    >
      <p className="serif text-ink" style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
        {title}
      </p>
      <div className="mt-2 max-w-prose text-ink-3">{body}</div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-3 inline-block text-data-sm text-accent underline-offset-4 hover:underline"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
