import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  dek?: React.ReactNode;
  className?: string;
}

/**
 * Editorial-style section header. Uppercase eyebrow, serif h2, optional
 * dek paragraph. Used at the top of major page sections — landing,
 * methodology, program detail.
 */
export function SectionHeader({ eyebrow, title, dek, className }: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {eyebrow && (
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      )}
      <h2 className="font-serif text-display-md text-ink">{title}</h2>
      {dek && <p className="max-w-prose text-dek text-muted-foreground">{dek}</p>}
    </header>
  );
}
