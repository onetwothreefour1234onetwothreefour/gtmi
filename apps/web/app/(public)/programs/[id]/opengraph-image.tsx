import { ImageResponse } from 'next/og';
import { getProgramDetail } from '@/lib/queries/program-detail';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export const alt = 'GTMI program detail';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Runtime generation — reads DATABASE_URL via getProgramDetail.
export const dynamic = 'force-dynamic';

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];
const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

export default async function ProgramOG({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Response> {
  const { id } = await params;
  const detail = await getProgramDetail(id);
  const programName = detail?.header.programName ?? 'Program not found';
  const countryName = detail?.header.countryName ?? '';
  const composite = detail?.score?.composite ?? null;
  const cme = detail?.score?.cme ?? null;
  const paq = detail?.score?.paq ?? null;
  const pillarScores = detail?.score?.pillarScores ?? null;
  const isPlaceholder = detail?.score?.phase2Placeholder === true;

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 72px',
        backgroundColor: '#FAFAF7',
        color: '#0A0A0B',
        fontFamily: 'serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span
          style={{
            fontSize: 18,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: '#6b6b6b',
            fontFamily: 'sans-serif',
          }}
        >
          GTMI · {countryName}
        </span>
        <span style={{ fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {programName}
        </span>
      </div>

      {composite !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span
            style={{
              fontSize: 24,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#6b6b6b',
              fontFamily: 'sans-serif',
            }}
          >
            Composite score{isPlaceholder ? ' · pre-calibration' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 32 }}>
            <span
              style={{
                fontSize: 196,
                lineHeight: 0.9,
                fontFamily: 'monospace',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.04em',
              }}
            >
              {composite.toFixed(2)}
            </span>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'sans-serif' }}
            >
              <span style={{ fontSize: 24, color: '#6b6b6b' }}>
                CME{' '}
                <span style={{ color: '#0A0A0B', fontFamily: 'monospace' }}>
                  {cme === null ? '—' : cme.toFixed(2)}
                </span>
              </span>
              <span style={{ fontSize: 24, color: '#6b6b6b' }}>
                PAQ{' '}
                <span style={{ color: '#0A0A0B', fontFamily: 'monospace' }}>
                  {paq === null ? '—' : paq.toFixed(2)}
                </span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <span style={{ fontSize: 36, color: '#6b6b6b' }}>Awaiting Phase 3 scoring</span>
      )}

      {pillarScores && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, height: 100 }}>
          {PILLAR_ORDER.map((p) => {
            const score = pillarScores[p];
            const heightPct = Math.max(8, Math.min(100, score));
            return (
              <div
                key={p}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: heightPct,
                    backgroundColor: PILLAR_COLORS[p],
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{
                    fontSize: 18,
                    fontFamily: 'sans-serif',
                    color: '#3a3a3a',
                  }}
                >
                  {PILLAR_LABEL[p]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: 'sans-serif',
          fontSize: 20,
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
