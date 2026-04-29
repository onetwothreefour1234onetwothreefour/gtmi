import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableNoteProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard "what this measures" callout shown below dense data tables.
 * Editorial restyle (Phase 4-A): italic Fraunces body, oxblood left rule,
 * paper-2 surface — reads as a footnote rather than a card.
 */
export function DataTableNote({ children, className }: DataTableNoteProps) {
  return (
    <aside
      className={cn(
        'border-l-2 border-accent bg-paper-2 px-4 py-3 text-data-md italic text-ink-3',
        className
      )}
      style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
      data-testid="data-table-note"
    >
      {children}
    </aside>
  );
}
