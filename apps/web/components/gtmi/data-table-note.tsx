import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableNoteProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard "what this measures" callout shown below dense data tables.
 * Light surface, accent left rule, restrained editorial body text.
 */
export function DataTableNote({ children, className }: DataTableNoteProps) {
  return (
    <aside
      className={cn(
        'rounded-card border-l-2 border-accent bg-surface px-4 py-3 text-data-md text-muted-foreground',
        className
      )}
      data-testid="data-table-note"
    >
      {children}
    </aside>
  );
}
