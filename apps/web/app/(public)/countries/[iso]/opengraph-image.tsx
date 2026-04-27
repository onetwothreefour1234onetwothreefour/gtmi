import { ImageResponse } from 'next/og';
import { getCountryDetail } from '@/lib/queries/country-detail';

export const alt = 'GTMI country detail';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Runtime generation — reads DATABASE_URL via getCountryDetail.
export const dynamic = 'force-dynamic';

export default async function CountryOG({
  params,
}: {
  params: Promise<{ iso: string }>;
}): Promise<Response> {
  const { iso } = await params;
  const detail = await getCountryDetail(iso);
  const countryName = detail?.header.name ?? 'Country not found';
  const region = detail?.header.region ?? '';
  const imdRank = detail?.header.imdRank ?? null;
  const imdAppealScore = detail?.header.imdAppealScore ?? null;
  const programCount = detail?.programs.length ?? 0;
  const scoredCount = detail?.programs.filter((p) => p.composite !== null).length ?? 0;

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span
          style={{
            fontSize: 22,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#6b6b6b',
            fontFamily: 'sans-serif',
          }}
        >
          GTMI · Country
        </span>
        <span style={{ fontSize: 96, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          {countryName}
        </span>
        <span style={{ fontSize: 28, color: '#3a3a3a', fontFamily: 'sans-serif' }}>
          {region} · {iso.toUpperCase()}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 56, fontFamily: 'sans-serif' }}>
        <Stat label="IMD Appeal rank">{imdRank !== null ? `#${imdRank}` : '—'}</Stat>
        <Stat label="IMD Appeal score">
          {imdAppealScore !== null ? imdAppealScore.toFixed(2) : '—'}
        </Stat>
        <Stat label="Programmes scored">
          {scoredCount} of {programCount}
        </Stat>
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
        <span>Global Talent Mobility Index</span>
        <span style={{ color: '#0F4C5C' }}>TTR Group</span>
      </div>
    </div>,
    { ...size }
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 18,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: '#6b6b6b',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 80,
          lineHeight: 1,
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {children}
      </span>
    </div>
  );
}
