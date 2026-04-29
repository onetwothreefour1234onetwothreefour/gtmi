import { ImageResponse } from 'next/og';
import { getProgramDetail } from '@/lib/queries/program-detail';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export const alt = 'GTMI programme detail';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Runtime generation — reads DATABASE_URL via getProgramDetail.
export const dynamic = 'force-dynamic';

const PAPER = '#F7F4ED';
const PAPER_2 = '#F2EEE3';
const PAPER_3 = '#EAE4D3';
const INK = '#1A1A1A';
const INK_3 = '#5C4A2E';
const INK_4 = '#8A7456';
const ACCENT = '#B8412A';
const RULE = '#D9D2BE';

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
  const programName = detail?.header.programName ?? 'Programme not found';
  const countryName = detail?.header.countryName ?? '';
  const programCategory = detail?.header.programCategory ?? '';
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
        padding: '56px 72px',
        backgroundColor: PAPER,
        backgroundImage: `radial-gradient(circle at 18% 22%, rgba(92, 74, 46, 0.04) 0%, transparent 42%), radial-gradient(circle at 82% 78%, rgba(92, 74, 46, 0.03) 0%, transparent 42%)`,
        color: INK,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* Eyebrow row */}
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
            fontSize: 16,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: INK_3,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 600,
          }}
        >
          GTMI · {countryName} · {programCategory}
        </span>
      </div>

      {/* Programme name */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 24,
        }}
      >
        <span
          style={{
            fontSize: 52,
            lineHeight: 1.06,
            letterSpacing: '-0.025em',
            fontWeight: 500,
            maxWidth: 880,
          }}
        >
          {programName}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Composite score block */}
      {composite !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              Composite score
            </span>
            {isPlaceholder && (
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#B8862A',
                  backgroundColor: '#FBF3DC',
                  border: '1px solid #E0C896',
                  padding: '2px 8px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                Pre-cal
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 36 }}>
            <span
              style={{
                fontSize: 168,
                lineHeight: 0.9,
                letterSpacing: '-0.04em',
                fontWeight: 500,
                color: INK,
              }}
            >
              {composite.toFixed(2)}
            </span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 22,
                color: INK_4,
              }}
            >
              <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: INK_3 }}>CME</span>
                <span style={{ color: INK, fontWeight: 600 }}>
                  {cme === null ? '—' : cme.toFixed(2)}
                </span>
                <span style={{ color: INK_4 }}>· 30%</span>
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: INK_3 }}>PAQ</span>
                <span style={{ color: INK, fontWeight: 600 }}>
                  {paq === null ? '—' : paq.toFixed(2)}
                </span>
                <span style={{ color: INK_4 }}>· 70%</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 16,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: INK_3,
              fontWeight: 600,
            }}
          >
            Awaiting Phase 5 calibration
          </span>
          <span style={{ fontSize: 36, color: INK_4, fontStyle: 'italic' }}>
            No composite score yet
          </span>
        </div>
      )}

      {/* Pillar mini-bars + footer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 32,
          paddingTop: 24,
          borderTop: `1px solid ${RULE}`,
        }}
      >
        {pillarScores ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 36,
              height: 48,
            }}
          >
            {PILLAR_ORDER.map((p) => {
              const score = pillarScores[p];
              const heightPx = Math.max(6, Math.min(48, (score / 100) * 48));
              return (
                <div
                  key={p}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: heightPx,
                      backgroundColor: PILLAR_COLORS[p],
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: 'Inter, system-ui, sans-serif',
                      color: INK_3,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {p} {PILLAR_LABEL[p]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              height: 14,
              border: `1px solid ${RULE}`,
            }}
          >
            <div style={{ width: '30%', backgroundColor: INK }} />
            <div style={{ width: '70%', backgroundColor: PAPER_3 }} />
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 18,
            color: INK_4,
          }}
        >
          <span>Global Talent Mobility Index · primary sources only</span>
          <span style={{ color: INK, fontWeight: 600 }}>TTR Group</span>
        </div>
      </div>
      {/* Hidden anchor — keeps PAPER_2 referenced for tooling */}
      <span style={{ display: 'none', color: PAPER_2 }} />
    </div>,
    { ...size }
  );
}
