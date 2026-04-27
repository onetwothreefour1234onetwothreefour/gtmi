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
 * Standard placeholder for Phase 4 / Phase 5 surfaces with no data yet.
 * Used on /changes, the unscored program panel, missing CME chip,
 * the missing-narrative slot, and a few other places.
 */
export function EmptyState({ title, body, ctaHref, ctaLabel, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-dashed border-border bg-surface p-6 text-data-md',
        className
      )}
      data-testid="empty-state"
      role="status"
    >
      <p className="font-serif text-data-lg text-ink">{title}</p>
      <div className="mt-2 max-w-prose text-muted-foreground">{body}</div>
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
