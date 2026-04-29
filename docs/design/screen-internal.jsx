// Internal-only screens — not exposed in public nav. Used by the team.

function InternalBadge() {
  return (
    <div style={{
      padding: '8px 32px',
      background: 'var(--ink)',
      color: 'var(--paper)',
      fontSize: 11,
      fontFamily: 'var(--mono)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%' }}></span>
      Internal · TTR Group only · not public
    </div>
  );
}

function ReviewValueScreen() {
  // Review queue: items pending editorial sign-off before they affect public scores.
  const queue = [
    { id: 'RV-2143', programme: 'CAN · Express Entry — FSW', indicator: 'A.04 quota', impact: '+0.4 composite', confidence: 0.92, source: 'IRCC ministerial instructions 2026-04-02', age: '2h', reviewer: 'Unassigned', status: 'pending' },
    { id: 'RV-2142', programme: 'NLD · Highly Skilled Migrant', indicator: 'B.02 govt fee', impact: '−0.3 composite', confidence: 0.88, source: 'IND tariff schedule 2026-04', age: '5h', reviewer: 'JR', status: 'in-review' },
    { id: 'RV-2141', programme: 'DEU · EU Blue Card', indicator: 'C.03 family rights', impact: '+0.6 composite', confidence: 0.74, source: 'BAMF Rundschreiben 2026-03-28', age: '1d', reviewer: 'AM', status: 'in-review' },
    { id: 'RV-2140', programme: 'JPN · HSP Type 1', indicator: 'A.01 salary floor', impact: '+1.1 composite', confidence: 0.66, source: 'MOJ guidance circular', age: '1d', reviewer: 'Unassigned', status: 'flagged' },
    { id: 'RV-2139', programme: 'IRL · Critical Skills', indicator: 'D.02 judicial review', impact: '±0.0 composite', confidence: 0.81, source: 'DETE statutory instrument', age: '2d', reviewer: 'JR', status: 'pending' },
    { id: 'RV-2138', programme: 'AUS · 482 Core', indicator: 'E.03 PR conversion', impact: '−0.9 composite', confidence: 0.58, source: 'DHA admin appeals data 2026-Q1', age: '2d', reviewer: 'AM', status: 'flagged' },
    { id: 'RV-2137', programme: 'FRA · Talent Passport', indicator: 'B.04 processing time', impact: '+0.2 composite', confidence: 0.94, source: 'OFII service standards 2026', age: '3d', reviewer: 'JR', status: 'in-review' },
  ];

  const statusColor = {
    pending: 'var(--warning)',
    'in-review': 'var(--pillar-d)',
    flagged: 'var(--accent)',
    approved: 'var(--positive)',
  };

  return (
    <div style={{ background: 'var(--paper)', minHeight: 1500, width: 1440 }}>
      <InternalBadge />
      <TopNav active="review" />

      <section style={{ padding: '48px 48px 32px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Eyebrow style={{ marginBottom: 16 }}>Review queue · editorial</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64, alignItems: 'flex-end' }}>
            <div>
              <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }}>
                Pending review.
              </h1>
              <p style={{ marginTop: 16, color: 'var(--ink-3)', fontSize: 15, lineHeight: 1.6, maxWidth: 540 }}>
                Indicator updates flagged by the extraction pipeline that need editorial sign-off
                before the public composite recomputes.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1px solid var(--rule)' }}>
              {[
                ['In queue', '47'],
                ['SLA risk', '3'],
                ['Avg age', '14h'],
                ['Auto-conf >0.9', '62%'],
              ].map(([l, v], i) => (
                <div key={i} style={{ padding: 14, borderRight: i < 3 ? '1px solid var(--rule)' : 0 }}>
                  <div className="eyebrow" style={{ fontSize: 9 }}>{l}</div>
                  <div className="num-l" style={{ fontSize: 22, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '32px 48px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <Chip variant="ink">All (47)</Chip>
            <Chip>Pending (18)</Chip>
            <Chip>In review (21)</Chip>
            <Chip>Flagged (8)</Chip>
            <div style={{ flex: 1 }}></div>
            <button className="btn-link" style={{ fontSize: 12 }}>Bulk approve high-confidence</button>
            <button className="btn">Open next ↑</button>
          </div>
          <table className="gtmi tabular">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>Programme</th>
                <th style={{ width: 140 }}>Indicator</th>
                <th style={{ width: 130 }}>Source</th>
                <th style={{ width: 120, textAlign: 'right' }}>Impact</th>
                <th style={{ width: 90, textAlign: 'right' }}>Conf.</th>
                <th style={{ width: 80 }}>Age</th>
                <th style={{ width: 100 }}>Reviewer</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r, i) => (
                <tr key={i}>
                  <td><span className="num" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.id}</span></td>
                  <td><div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>{r.programme}</div></td>
                  <td><span className="num" style={{ fontSize: 12 }}>{r.indicator}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.source}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="num" style={{ fontSize: 12, color: r.impact.startsWith('+') ? 'var(--positive)' : r.impact.startsWith('−') ? 'var(--negative)' : 'var(--ink-4)' }}>
                      {r.impact}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <span className="num" style={{ fontSize: 12 }}>{r.confidence.toFixed(2)}</span>
                      <div style={{ width: 36 }}>
                        <ScoreBar value={r.confidence * 100} color={r.confidence > 0.85 ? 'var(--positive)' : r.confidence > 0.7 ? 'var(--warning)' : 'var(--accent)'} />
                      </div>
                    </div>
                  </td>
                  <td><span className="num" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.age}</span></td>
                  <td>
                    {r.reviewer === 'Unassigned'
                      ? <span style={{ fontSize: 11, color: 'var(--ink-5)', fontStyle: 'italic' }}>Unassigned</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <span style={{ width: 18, height: 18, background: 'var(--paper-3)', border: '1px solid var(--rule)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: 'var(--mono)' }}>{r.reviewer}</span>
                        </span>}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: statusColor[r.status] }}>
                      <span style={{ width: 6, height: 6, background: statusColor[r.status], borderRadius: '50%' }}></span>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Open ›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// Re-export ChangesScreen wrapped with internal badge
function ChangesScreenInternal() {
  return (
    <div>
      <InternalBadge />
      <ChangesScreen />
    </div>
  );
}

Object.assign(window, { InternalBadge, ReviewValueScreen, ChangesScreenInternal });
