'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ReviewFilterTab } from '@/lib/review-queue-helpers';

export interface ReviewFilterTabsProps {
  /** Bucket counts for the active dataset; drives the chip count badges. */
  counts: Record<ReviewFilterTab, number>;
  /** Active tab (defaults to "all"). */
  active: ReviewFilterTab;
  className?: string;
}

const TABS: { id: ReviewFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'in-review', label: 'In review' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'high-confidence', label: 'High confidence' },
];

/**
 * Filter chip strip for the I-01 review queue. Pushes the active tab to the
 * URL `?tab=` param so the server-rendered table reads back the same value
 * on the next request (no client-only state).
 */
export function ReviewFilterTabs({ counts, active, className }: ReviewFilterTabsProps) {
  const router = useRouter();
  const search = useSearchParams();
  const onSelect = (id: ReviewFilterTab) => {
    const next = new URLSearchParams(search.toString());
    if (id === 'all') next.delete('tab');
    else next.set('tab', id);
    const qs = next.toString();
    router.push(qs ? `/review?${qs}` : '/review');
  };
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="tablist"
      aria-label="Review queue filters"
      data-testid="review-filter-tabs"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const count = counts[t.id];
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.id)}
            className={cn('chip cursor-pointer h-7', isActive && 'chip-ink')}
            data-testid={`review-filter-${t.id}`}
          >
            {t.label}
            <span
              className="ml-1 num"
              style={{
                fontSize: 11,
                color: isActive ? 'var(--paper)' : 'var(--ink-4)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
