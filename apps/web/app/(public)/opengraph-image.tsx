import { ImageResponse } from 'next/og';

/**
 * Default Open Graph image for the public dashboard root and any route
 * without a more specific og.tsx. Renders at request time on Cloud Run
 * via @vercel/og — the library is portable; no Vercel platform dependency.
 *
 * Cache headers (s-maxage=86400, stale-while-revalidate=604800) come from
 * Next.js's default for opengraph-image.tsx routes; Cloud CDN in front of
 * Cloud Run picks them up automatically.
 */
export const runtime = 'edge';
export const alt = 'Global Talent Mobility Index — TTR Group';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG(): Promise<Response> {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 80px',
        backgroundColor: '#FAFAF7',
        color: '#0A0A0B',
        fontFamily: 'serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span
          style={{
            fontSize: 22,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#6b6b6b',
          }}
        >
          Global Talent Mobility Index
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <span style={{ fontSize: 88, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          85 talent-mobility programmes,
        </span>
        <span style={{ fontSize: 88, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          30 economies, 48 indicators.
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: 'sans-serif',
          fontSize: 22,
          color: '#3a3a3a',
        }}
      >
        <span>Every weight published. Every value sourced.</span>
        <span style={{ color: '#0F4C5C' }}>TTR Group</span>
      </div>
    </div>,
    { ...size }
  );
}
