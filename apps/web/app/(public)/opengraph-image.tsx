import { ImageResponse } from 'next/og';

/**
 * Default Open Graph image for the public dashboard root.
 *
 * Phase 4-B redesign — editorial visual language: warm-paper background,
 * Fraunces-style serif headline (system serif fallback at edge runtime
 * since @vercel/og can't currently load custom fonts inline without a
 * fetch round-trip; the editorial weight + spacing land regardless),
 * oxblood accent underline, italic "actually" emphasis matching the live
 * landing-page hero.
 */
export const runtime = 'edge';
export const alt = 'Global Talent Mobility Index — TTR Group';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#F7F4ED';
const PAPER_3 = '#EAE4D3';
const INK = '#1A1A1A';
const INK_3 = '#5C4A2E';
const INK_4 = '#8A7456';
const ACCENT = '#B8412A';
const RULE = '#D9D2BE';

export default async function OG(): Promise<Response> {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '72px 80px',
        backgroundColor: PAPER,
        backgroundImage: `radial-gradient(circle at 18% 22%, rgba(92, 74, 46, 0.04) 0%, transparent 42%), radial-gradient(circle at 82% 78%, rgba(92, 74, 46, 0.03) 0%, transparent 42%)`,
        color: INK,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* Eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            display: 'block',
            width: 36,
            height: 1,
            backgroundColor: ACCENT,
          }}
        />
        <span
          style={{
            fontSize: 18,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: INK_3,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 600,
          }}
        >
          Global Talent Mobility Index
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 56,
        }}
      >
        <span
          style={{
            fontSize: 76,
            lineHeight: 1.04,
            letterSpacing: '-0.025em',
            fontWeight: 500,
          }}
        >
          A primary-source measure of how the world&rsquo;s
        </span>
        <span
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            fontSize: 76,
            lineHeight: 1.04,
            letterSpacing: '-0.025em',
            fontWeight: 500,
          }}
        >
          <span>talent visa programmes</span>
          <span style={{ width: 18 }} />
          <span style={{ color: ACCENT, fontStyle: 'italic' }}>actually</span>
          <span style={{ width: 18 }} />
          <span>work.</span>
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* 30/70 strip + footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            height: 14,
            border: `1px solid ${RULE}`,
          }}
        >
          <div
            style={{
              width: '30%',
              backgroundColor: INK,
              display: 'flex',
            }}
          />
          <div
            style={{
              width: '70%',
              backgroundColor: PAPER_3,
              display: 'flex',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 22,
            color: INK_4,
          }}
        >
          <span>30% CME · 70% PAQ · 48 indicators · primary sources only</span>
          <span style={{ color: INK, fontWeight: 600 }}>TTR Group</span>
        </div>
      </div>
    </div>,
    { ...size }
  );
}
