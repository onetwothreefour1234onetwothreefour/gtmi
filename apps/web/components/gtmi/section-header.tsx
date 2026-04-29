import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  dek?: React.ReactNode;
  className?: string;
}

/**
 * Editorial-style section header. Eyebrow rule (uppercase tracking),
 * 28–32px Fraunces h2, optional dek paragraph.
 *
 * Editorial restyle (Phase 4-A): consumes the `.eyebrow` and `.serif`
 * class atoms from globals.css.
 */
export function SectionHeader({ eyebrow, title, dek, className }: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="serif text-ink" style={{ fontSize: 32, fontWeight: 400, margin: 0 }}>
        {title}
      </h2>
      {dek && <p className="max-w-prose text-dek text-ink-3">{dek}</p>}
    </header>
  );
}
