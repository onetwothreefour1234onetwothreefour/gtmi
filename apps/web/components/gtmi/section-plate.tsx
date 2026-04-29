import * as React from 'react';
import { cn } from '@/lib/utils';

export type SectionPlateTone = 'ink' | 'navy' | 'paper-3';

export interface SectionPlateProps {
  /** Roman or arabic numeral, rendered large in oxblood serif. */
  numeral: string;
  /** Headline (Fraunces, very large). */
  title: string;
  /** Optional italic standfirst paragraph. */
  standfirst?: React.ReactNode;
  /** Surface tone. Default: ink. */
  tone?: SectionPlateTone;
  className?: string;
}

const TONE_STYLES: Record<SectionPlateTone, { bg: string; fg: string; fgMute: string }> = {
  ink: {
    bg: 'var(--ink)',
    fg: 'var(--paper)',
    fgMute: 'rgba(247,244,237,0.6)',
  },
  navy: {
    bg: 'var(--navy)',
    fg: 'var(--paper)',
    fgMute: 'rgba(247,244,237,0.6)',
  },
  'paper-3': {
    bg: 'var(--paper-3)',
    fg: 'var(--ink)',
    fgMute: 'var(--ink-4)',
  },
};

/**
 * Chapter-style title plate. Drops a large oxblood numeral in the gutter
 * with a 56px Fraunces headline + optional italic standfirst alongside.
 * Used between major regions of the landing page (cf. SpecimenPlate which
 * wraps an artefact; SectionPlate is text-only).
 *
 * Translates docs/design/primitives.jsx:SectionPlate.
 */
export function SectionPlate({
  numeral,
  title,
  standfirst,
  tone = 'ink',
  className,
}: SectionPlateProps) {
  const t = TONE_STYLES[tone];
  return (
    <section
      className={cn('w-full', className)}
      style={{
        background: t.bg,
        color: t.fg,
        padding: '88px 48px',
      }}
      data-testid="section-plate"
      data-tone={tone}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          gap: 48,
          alignItems: 'baseline',
        }}
      >
        <div
          className="num-l"
          style={{ fontSize: 88, lineHeight: 1, color: 'var(--accent)', fontWeight: 400 }}
        >
          {numeral}
        </div>
        <div>
          <h2
            className="serif"
            style={{
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              margin: 0,
              color: t.fg,
            }}
          >
            {title}
          </h2>
          {standfirst && (
            <p
              className="serif"
              style={{
                marginTop: 20,
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: 1.5,
                color: t.fgMute,
                maxWidth: 720,
              }}
            >
              {standfirst}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
