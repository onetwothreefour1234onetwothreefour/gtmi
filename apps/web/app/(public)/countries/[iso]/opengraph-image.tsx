import { ImageResponse } from 'next/og';
import { getCountryDetail } from '@/lib/queries/country-detail';

export const alt = 'GTMI country detail';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Runtime generation — reads DATABASE_URL via getCountryDetail.
export const dynamic = 'force-dynamic';

const PAPER = '#F7F4ED';
const PAPER_3 = '#EAE4D3';
const INK = '#1A1A1A';
const INK_3 = '#5C4A2E';
const INK_4 = '#8A7456';
const ACCENT = '#B8412A';
const RULE = '#D9D2BE';

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
        padding: '64px 80px',
        backgroundColor: PAPER,
        backgroundImage: `radial-gradient(circle at 18% 22%, rgba(92, 74, 46, 0.04) 0%, transparent 42%), radial-gradient(circle at 82% 78%, rgba(92, 74, 46, 0.03) 0%, transparent 42%)`,
        color: INK,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* Eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'block', width: 36, height: 1, backgroundColor: ACCENT }} />
        <span
          style={{
            fontSize: 16,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: INK_3,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 600,
          }}
        >
          GTMI · Country profile{region ? ` · ${region}` : ''}
        </span>
      </div>

      {/* Country name */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 28,
        }}
      >
        <span
          style={{
            fontSize: 96,
            lineHeight: 1.04,
            letterSpacing: '-0.025em',
            fontWeight: 500,
            maxWidth: 880,
          }}
        >
          {countryName}
        </span>
        <span
          style={{
            fontSize: 22,
            letterSpacing: '0.04em',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: INK_4,
            marginTop: 6,
            fontWeight: 600,
          }}
        >
          {iso.toUpperCase()}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 56 }}>
        <Stat label="IMD Appeal rank" value={imdRank !== null ? `#${imdRank}` : '—'} />
        <Stat
          label="IMD Appeal score"
          value={imdAppealScore !== null ? imdAppealScore.toFixed(2) : '—'}
        />
        <Stat
          label="Programmes scored"
          value={programCount > 0 ? `${scoredCount} / ${programCount}` : '—'}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 18,
          color: INK_4,
          marginTop: 32,
          paddingTop: 20,
          borderTop: `1px solid ${RULE}`,
        }}
      >
        <span>Global Talent Mobility Index · primary sources only</span>
        <span style={{ color: INK, fontWeight: 600 }}>TTR Group</span>
      </div>
      {/* Hidden anchors keep PAPER_3 referenced for tooling */}
      <span style={{ display: 'none', color: PAPER_3 }} />
    </div>,
    { ...size }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 14,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: INK_3,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 56,
          lineHeight: 1.05,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: INK,
        }}
      >
        {value}
      </span>
    </div>
  );
}
