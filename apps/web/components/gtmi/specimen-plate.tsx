import * as React from 'react';
import { cn } from '@/lib/utils';

export type SpecimenPlateTone = 'paper-2' | 'paper-3' | 'ink' | 'navy';

export interface SpecimenPlateProps {
  /** Plate number rendered as the eyebrow ("Plate I · Specimen"). */
  plateNo: string;
  /** Headline title (Fraunces, large). */
  title: string;
  /** Optional italic caption beneath the title. */
  caption?: React.ReactNode;
  /** Surface tone. `'ink'` and `'navy'` flip text to paper. Default: paper-2. */
  tone?: SpecimenPlateTone;
  /** Minimum interior height in pixels. Default: 380. */
  height?: number;
  /** Right-column artefact (a chart, a typographic poster, an exhibit). */
  children: React.ReactNode;
  className?: string;
}

const TONE_STYLES: Record<SpecimenPlateTone, { bg: string; fg: string; fgMute: string }> = {
  'paper-2': {
    bg: 'var(--paper-2)',
    fg: 'var(--ink)',
    fgMute: 'var(--ink-4)',
  },
  'paper-3': {
    bg: 'var(--paper-3)',
    fg: 'var(--ink)',
    fgMute: 'var(--ink-4)',
  },
  ink: {
    bg: 'var(--ink)',
    fg: 'var(--paper)',
    fgMute: 'rgba(247,244,237,0.55)',
  },
  navy: {
    bg: 'var(--navy)',
    fg: 'var(--paper)',
    fgMute: 'rgba(247,244,237,0.55)',
  },
};

/**
 * Full-bleed editorial section divider. Two-column grid: left holds the
 * plate-number eyebrow + serif title + italic caption; right holds an
 * artefact (chart / typographic poster / exhibit) passed via children.
 *
 * Translates docs/design/primitives.jsx:SpecimenPlate.
 */
export function SpecimenPlate({
  plateNo,
  title,
  caption,
  tone = 'paper-2',
  height = 380,
  children,
  className,
}: SpecimenPlateProps) {
  const t = TONE_STYLES[tone];
  return (
    <section
      className={cn('w-full', className)}
      style={{
        background: t.bg,
        color: t.fg,
        padding: '64px 48px',
        borderTop: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
      }}
      data-testid="specimen-plate"
      data-tone={tone}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '0.9fr 1.4fr',
          gap: 64,
          alignItems: 'center',
          minHeight: height,
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: t.fgMute,
              marginBottom: 16,
            }}
          >
            Plate {plateNo} · Specimen
          </div>
          <h3
            className="serif"
            style={{
              fontSize: 36,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: 0,
              color: t.fg,
            }}
          >
            {title}
          </h3>
          {caption && (
            <p
              className="serif"
              style={{
                marginTop: 16,
                fontSize: 13,
                lineHeight: 1.6,
                color: t.fgMute,
                maxWidth: 380,
                fontStyle: 'italic',
              }}
            >
              {caption}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {children}
        </div>
      </div>
    </section>
  );
}
