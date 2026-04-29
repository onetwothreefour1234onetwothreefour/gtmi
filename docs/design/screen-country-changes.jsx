// Country detail + Changes timeline screens

function CountryHeader() {
  return (
    <section style={{ padding: '48px 48px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', marginBottom: 24 }}>
          <a href="#" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Countries</a>
          <span>›</span>
          <span style={{ color: 'var(--ink)' }}>Switzerland</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64, alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <CountryFlag iso="CHE" />
              <Eyebrow style={{ margin: 0 }}>Country profile · 2026</Eyebrow>
            </div>
            <h1 className="serif" style={{ fontSize: 64, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }}>
              Switzerland
            </h1>
            <p style={{ marginTop: 16, fontSize: 16, color: 'var(--ink-3)', maxWidth: 560 }}>
              4 talent programmes scored. Composite leader in Edition 2026, driven by L-Permit performance
              and high outcomes data fidelity. Three open dissents from Edition 2025.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1px solid var(--rule)' }}>
            {[
              ['Top programme', '#1', 'L-Permit'],
              ['Avg. composite', '64.2', 'across 4 programmes'],
              ['Coverage', '88%', 'weighted, all programmes'],
            ].map(([l, v, sub], i) => (
              <div key={i} style={{ padding: 16, borderRight: i < 2 ? '1px solid var(--rule)' : 0 }}>
                <div className="eyebrow" style={{ fontSize: 10 }}>{l}</div>
                <div className="num-l" style={{ fontSize: 24, marginTop: 4 }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgrammesTable() {
  const rows = [
    { rank: 1, name: 'L-Permit (Highly Qualified)', cat: 'Skilled Worker', composite: 78.4, paq: 70.7, cme: 100.0, status: 'scored' },
    { rank: 24, name: 'B-Permit (EU/EFTA Family Reunification)', cat: 'Family', composite: 62.4, paq: 68.0, cme: 49.3, status: 'scored' },
    { rank: 47, name: 'Self-Employed Permit (Non-EU)', cat: 'Investor / Self-Emp.', composite: 54.1, paq: 56.8, cme: 47.8, status: 'placeholder' },
    { rank: 89, name: 'Trainee / Stagiaire (Bilateral)', cat: 'Training', composite: 41.9, paq: 44.0, cme: 37.0, status: 'scored' },
  ];
  return (
    <table className="gtmi tabular">
      <thead>
        <tr>
          <th style={{ width: 60 }}>Global #</th>
          <th>Programme</th>
          <th style={{ width: 140 }}>Category</th>
          <th style={{ width: 120, textAlign: 'right' }}>Composite</th>
          <th style={{ width: 80, textAlign: 'right' }}>PAQ</th>
          <th style={{ width: 80, textAlign: 'right' }}>CME</th>
          <th style={{ width: 90 }}>Status</th>
          <th style={{ width: 30 }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td><span className="num" style={{ color: 'var(--ink-4)', fontSize: 12 }}>#{r.rank}</span></td>
            <td><div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>{r.name}</div></td>
            <td><span style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.cat}</span></td>
            <td style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <ScoreNumber value={r.composite} />
                <div style={{ width: 60 }}><ScoreBar value={r.composite} /></div>
              </div>
            </td>
            <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}><ScoreNumber value={r.paq} /></td>
            <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}><ScoreNumber value={r.cme} /></td>
            <td>{r.status === 'placeholder' ? <Chip variant="amber">Pre-cal</Chip> : <Chip variant="mute">Scored</Chip>}</td>
            <td style={{ color: 'var(--ink-4)' }}>›</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PillarRadar() {
  // Simple SVG radar — 5 axes
  const data = { A: 78, B: 72, C: 81, D: 65, E: 84 };
  const benchmark = { A: 56, B: 54, C: 58, D: 50, E: 52 }; // OECD avg
  const labels = [
    { k: 'A', name: 'Eligibility' },
    { k: 'B', name: 'Process' },
    { k: 'C', name: 'Family' },
    { k: 'D', name: 'Recourse' },
    { k: 'E', name: 'Outcomes' },
  ];
  const cx = 180, cy = 180, r = 130;
  const points = (vals) => labels.map((l, i) => {
    const angle = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
    const v = vals[l.k] / 100;
    return [cx + Math.cos(angle) * r * v, cy + Math.sin(angle) * r * v];
  });
  const polyStr = (pts) => pts.map(p => p.join(',')).join(' ');

  return (
    <svg width="360" height="360" viewBox="0 0 360 360">
      {/* concentric */}
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon key={i} points={polyStr(labels.map((l, j) => {
          const a = (j / labels.length) * Math.PI * 2 - Math.PI / 2;
          return [cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f];
        }))} fill="none" stroke="var(--rule)" strokeWidth="1" />
      ))}
      {/* axes */}
      {labels.map((l, i) => {
        const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="var(--rule)" strokeWidth="1" />;
      })}
      {/* benchmark */}
      <polygon points={polyStr(points(benchmark))} fill="none" stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="3 3" />
      {/* CHE */}
      <polygon points={polyStr(points(data))} fill="rgba(184,65,42,0.18)" stroke="var(--accent)" strokeWidth="2" />
      {points(data).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--accent)" />
      ))}
      {/* labels */}
      {labels.map((l, i) => {
        const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + Math.cos(a) * (r + 24);
        const ly = cy + Math.sin(a) * (r + 24);
        return (
          <g key={i}>
            <text x={lx} y={ly - 4} textAnchor="middle" style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{l.k}</text>
            <text x={lx} y={ly + 10} textAnchor="middle" style={{ fontFamily: 'var(--sans)', fontSize: 10, fill: 'var(--ink-4)' }}>{l.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function CountryScreen() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: 1600, width: 1440 }}>
      <TopNav active="countries" />
      <CountryHeader />

      <section style={{ padding: '64px 48px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 64, alignItems: 'flex-start' }}>
          <div>
            <h2 className="serif" style={{ fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>
              Programmes scored
            </h2>
            <p style={{ color: 'var(--ink-3)', marginTop: 4 }}>4 talent visa programmes evaluated.</p>
            <div style={{ marginTop: 24 }}>
              <ProgrammesTable />
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 32 }}>
            <Eyebrow style={{ marginBottom: 16 }}>Pillar profile · L-Permit vs. OECD avg.</Eyebrow>
            <PillarRadar />
            <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 2, background: 'var(--accent)' }}></span>
                Switzerland (L-Permit)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 0, borderTop: '1px dashed var(--ink-4)' }}></span>
                OECD median
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChangesScreen() {
  const events = [
    { date: '2026-04-03', type: 'data', title: 'Singapore Tech.Pass · A.04 quota updated', body: 'Quota raised from 1,200 → 1,800 per MOM circular 2026-04-01. Source archived (sha256: 3c2a…f981). Affects A.04, A.07.', impact: '+1.4 composite', impactColor: 'var(--positive)', programme: 'SGP · Tech.Pass' },
    { date: '2026-03-29', type: 'methodology', title: 'Pillar D weights re-balanced', body: 'D.02 (judicial review availability) raised from 1.5% → 2.0% following internal review of recourse coverage gaps. D.05 reduced 2.0% → 1.5% to compensate. Composites recomputed for all 187 programmes.', impact: '±0.6 avg', impactColor: 'var(--ink-4)', programme: 'All programmes' },
    { date: '2026-03-22', type: 'provenance', title: 'UK Skilled Worker · 14 sources re-archived', body: 'Home Office published revised statement of changes; affected sources re-scraped, hashed, and chained. No score change.', impact: 'no change', impactColor: 'var(--ink-4)', programme: 'GBR · Skilled Worker' },
    { date: '2026-03-18', type: 'data', title: 'Germany EU Blue Card · salary threshold update', body: 'Threshold raised from €45,300 → €48,300 (general) and €41,041 → €43,759 (shortage occupations). Indicator A.01 recomputed.', impact: '−0.8 composite', impactColor: 'var(--negative)', programme: 'DEU · Blue Card' },
    { date: '2026-03-12', type: 'dissent', title: 'Editorial note: Pillar E weighting under review', body: 'Internal editorial review flagged that E.02 (time-to-PR) may be over-weighted relative to wage-uplift indicators. Response and counter-evidence published.', impact: 'note', impactColor: 'var(--warning)', programme: 'Methodology' },
    { date: '2026-03-04', type: 'data', title: 'Australia 482 · category split applied', body: 'Skills-in-Demand 482 split into Core / Specialist / Essential streams, scored separately. 2 new programme rows added.', impact: 'new rows', impactColor: 'var(--ink-4)', programme: 'AUS · 482' },
  ];

  const typeColors = {
    data: 'var(--pillar-c)',
    methodology: 'var(--accent)',
    provenance: 'var(--pillar-d)',
    dissent: 'var(--warning)',
  };

  return (
    <div style={{ background: 'var(--paper)', minHeight: 1500, width: 1440 }}>
      <TopNav active="changes" />

      <section style={{ padding: '64px 48px 32px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Eyebrow style={{ marginBottom: 16 }}>Changes log · always public</Eyebrow>
          <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }}>
            Every score change, written down.
          </h1>
          <p style={{ marginTop: 16, color: 'var(--ink-3)', maxWidth: 640, fontSize: 15 }}>
            When data, methodology, or provenance changes, the affected scores recompute and the change is
            recorded here with its source, hash, and impact.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <Chip variant="ink">All</Chip>
            <Chip>Data</Chip>
            <Chip>Methodology</Chip>
            <Chip>Provenance</Chip>
            <Chip>Dissents</Chip>
          </div>
        </div>
      </section>

      <section style={{ padding: '48px 48px 96px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative' }}>
          {/* spine */}
          <div style={{ position: 'absolute', left: 130, top: 0, bottom: 0, width: 1, background: 'var(--rule)' }}></div>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 60px 1fr', gap: 0, marginBottom: 40, alignItems: 'flex-start' }}>
              <div style={{ paddingTop: 4 }}>
                <div className="num" style={{ fontSize: 12, fontWeight: 600 }}>{e.date}</div>
                <div className="eyebrow" style={{ fontSize: 9, marginTop: 4, color: typeColors[e.type] }}>{e.type}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6, position: 'relative', zIndex: 1 }}>
                <div style={{ width: 12, height: 12, background: 'var(--paper)', border: `2px solid ${typeColors[e.type]}`, borderRadius: 0, transform: 'rotate(45deg)' }}></div>
              </div>
              <div style={{ paddingLeft: 8, borderLeft: '0' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <h3 className="serif" style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', flex: 1 }}>
                    {e.title}
                  </h3>
                  <span className="num" style={{ fontSize: 12, color: e.impactColor, fontWeight: 600 }}>{e.impact}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginBottom: 8 }}>{e.programme}</div>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
                  {e.body}
                </p>
                <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
                  <button className="btn-link" style={{ fontSize: 12 }}>Diff</button>
                  <button className="btn-link" style={{ fontSize: 12 }}>Source ↗</button>
                  <button className="btn-link" style={{ fontSize: 12 }}>Affected programmes ({e.type === 'methodology' ? '187' : '1'})</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { CountryScreen, ChangesScreen });
