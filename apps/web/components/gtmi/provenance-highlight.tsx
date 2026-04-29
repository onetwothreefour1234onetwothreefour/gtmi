import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProvenanceHighlightProps {
  sentence: string;
  charOffsets: [number, number];
  className?: string;
}

/**
 * Renders the source sentence in serif body with the substring at
 * [start, end] highlighted. If charOffsets are out of bounds (e.g.
 * offset mismatch between extraction and validation), highlights nothing
 * and renders the full sentence — the UI is defensive, the verifier is loud.
 *
 * Editorial restyle (Phase 4-A): Fraunces serif body, oxblood underline
 * on the highlight per docs/design/screen-program.jsx.
 */
export function ProvenanceHighlight({
  sentence,
  charOffsets,
  className,
}: ProvenanceHighlightProps) {
  const [start, end] = charOffsets;
  const valid = start >= 0 && end <= sentence.length && start < end;
  const baseStyle: React.CSSProperties = {
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--ink-2)',
  };

  if (!valid) {
    return (
      <p
        className={cn('whitespace-pre-wrap break-words', className)}
        style={baseStyle}
        data-testid="provenance-highlight"
      >
        {sentence}
      </p>
    );
  }

  return (
    <p
      className={cn('whitespace-pre-wrap break-words', className)}
      style={baseStyle}
      data-testid="provenance-highlight"
    >
      <span>{sentence.slice(0, start)}</span>
      <mark
        style={{
          background: '#FBE5DC',
          padding: '2px 0',
          borderBottom: '2px solid var(--accent)',
          color: 'var(--ink-2)',
        }}
      >
        {sentence.slice(start, end)}
      </mark>
      <span>{sentence.slice(end)}</span>
    </p>
  );
}
