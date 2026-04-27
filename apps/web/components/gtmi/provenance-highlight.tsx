import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProvenanceHighlightProps {
  sentence: string;
  charOffsets: [number, number];
  className?: string;
}

/**
 * Renders the source sentence in monospace with the substring at
 * [start, end] highlighted. If charOffsets are out of bounds (e.g.
 * offset mismatch between extraction and validation), highlights nothing
 * and renders the full sentence — the UI is defensive, the verifier is loud.
 */
export function ProvenanceHighlight({
  sentence,
  charOffsets,
  className,
}: ProvenanceHighlightProps) {
  const [start, end] = charOffsets;
  const valid = start >= 0 && end <= sentence.length && start < end;

  if (!valid) {
    return (
      <p
        className={cn(
          'whitespace-pre-wrap break-words font-mono text-data-sm leading-relaxed text-foreground',
          className
        )}
        data-testid="provenance-highlight"
      >
        {sentence}
      </p>
    );
  }

  return (
    <p
      className={cn(
        'whitespace-pre-wrap break-words font-mono text-data-sm leading-relaxed text-foreground',
        className
      )}
      data-testid="provenance-highlight"
    >
      <span>{sentence.slice(0, start)}</span>
      <mark className="rounded-sm bg-precalib-bg px-0.5 text-precalib-fg">
        {sentence.slice(start, end)}
      </mark>
      <span>{sentence.slice(end)}</span>
    </p>
  );
}
