import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MarginNoteProps {
  /** Note body — italic Fraunces. */
  children: React.ReactNode;
  /** Stroke + text colour. Default: navy (peer-review marginalia tone). */
  color?: string;
  className?: string;
}

/**
 * Italic serif gutter annotation, navy by default — used as a peer-review /
 * editorial marginalia callout. Pass `color="var(--accent)"` for an
 * attention/score-change note instead.
 *
 * Translates docs/design/primitives.jsx:MarginNote.
 */
export function MarginNote({ children, color = 'var(--navy)', className }: MarginNoteProps) {
  return (
    <aside
      className={cn(className)}
      style={{
        fontFamily: 'var(--font-serif), Georgia, serif',
        fontStyle: 'italic',
        fontSize: 12,
        lineHeight: 1.5,
        color,
        borderLeft: `2px solid ${color}`,
        paddingLeft: 12,
        maxWidth: 220,
      }}
      data-testid="margin-note"
    >
      {children}
    </aside>
  );
}
