// Landing + Rankings screen

function HeroLanding() {
  return (
    <section style={{ padding: '64px 48px 40px', background: 'var(--paper)' }} className="paper-grain">
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64, alignItems: 'end' }}>
        <div>
          <Eyebrow style={{ marginBottom: 24 }}>The Global Talent Mobility Index</Eyebrow>
          <h1 className="serif" style={{
            fontSize: 72, lineHeight: 1.02, letterSpacing: '-0.025em',
            margin: 0, fontWeight: 400,
            textWrap: 'balance',
          }}>
            A primary-source measure of how the world&rsquo;s talent visa programmes
            <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}> actually</em> work.
          </h1>
          <p style={{
            marginTop: 28, fontSize: 18, lineHeight: 1.55, color: 'var(--ink-3)',
            maxWidth: 620, fontFamily: 'var(--sans)',
          }}>
            48 indicators across 5 pillars. Every number traceable to a primary source &mdash; sentence,
            character offsets, hash, scrape time. No marketing copy. No country pride.
          </p>
          <div style={{ marginTop: 36, display: 'flex', gap: 16, alignItems: 'center' }}>
            <button className="btn">Browse the rankings →</button>
            <button className="btn btn-ghost">Read the methodology</button>
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 32 }}>
          <Eyebrow style={{ marginBottom: 16 }}>How GTMI is computed</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, height: 140 }}>
            <div style={{ flex: 30, background: 'var(--ink)', height: '100%', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, left: 12, color: 'var(--paper)' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500 }}>30%</div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>CME</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Comparative<br/>Mobility Engine</div>
              </div>
            </div>
            <div style={{ flex: 70, background: 'var(--paper-3)', height: '100%', position: 'relative', borderTop: '1px solid var(--rule)', borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ position: 'absolute', top: 12, left: 12, color: 'var(--ink)' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 500 }}>70%</div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>PAQ</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Programme Architecture<br/>&amp; Quality</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>
            CME measures comparative outcomes — wage uplift, route-to-PR, cost-to-applicant.
            PAQ measures programme architecture — predictability, transparency, fairness, family rights, recourse.
          </div>
        </div>
      </div>

      {/* stat strip */}
      <div style={{ maxWidth: 1280, margin: '64px auto 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
        {[
          ['Programmes scored', '187', 'across 54 jurisdictions'],
          ['Indicators', '48', '5 pillars · 30/70 weighted'],
          ['Source documents', '2,431', 'primary, hashed, archived'],
          ['Provenance coverage', '78.6%', 'of weighted indicators'],
          ['Last updated', '03 APR 2026', ''],
        ].map(([label, value, sub], i) => (
          <div key={i} style={{ background: 'var(--paper)', padding: '20px 20px 22px' }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
            <div className="num-l" style={{ fontSize: 32, marginTop: 6, color: 'var(--ink)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilterBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="eyebrow" style={{ marginRight: 8 }}>Filter</span>
        {['All categories', 'Skilled Worker', 'Tech Talent', 'Talent Visa', 'Points-Based', 'EU Blue Card'].map((c, i) => (
          <button key={c} className={`chip ${i === 0 ? 'chip-ink' : ''}`} style={{ cursor: 'pointer', height: 26 }}>{c}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Density</span>
        <div style={{ display: 'flex', border: '1px solid var(--rule)' }}>
          <button className="chip chip-ink" style={{ border: 0, height: 24 }}>Dense</button>
          <button className="chip" style={{ border: 0, borderLeft: '1px solid var(--rule)', height: 24 }}>Comfort</button>
        </div>
        <span style={{ width: 1, height: 20, background: 'var(--rule)' }}></span>
        <button className="btn-link" style={{ fontSize: 12 }}>⚖ Advisor mode</button>
      </div>
    </div>
  );
}

// Pseudo-deterministic 12-month trend for a programme — small, stable noise
// around the current composite, so each row shows a coherent recent history.
function trendForRank(rank, composite) {
  const arr = [];
  let seed = rank * 13.7;
  for (let i = 0; i < 12; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const noise = (seed / 233280 - 0.5) * 4;
    const drift = (i - 6) * (rank <= 5 ? 0.4 : rank <= 12 ? -0.2 : 0.1);
    arr.push(Math.max(20, Math.min(95, composite + drift + noise)));
  }
  // ensure last value matches current composite
  arr[arr.length - 1] = composite;
  return arr;
}

function RankingsTable() {
  const rows = window.GTMI_DATA.programs;
  return (
    <table className="gtmi tabular">
      <thead>
        <tr>
          <th style={{ width: 36 }}>#</th>
          <th style={{ width: 200 }}>Country</th>
          <th>Programme</th>
          <th style={{ width: 110 }}>Category</th>
          <th style={{ width: 100, textAlign: 'right' }}>Composite</th>
          <th style={{ width: 70, textAlign: 'right' }}>PAQ</th>
          <th style={{ width: 70, textAlign: 'right' }}>CME</th>
          <th style={{ width: 110 }}>Pillars (A→E)</th>
          <th style={{ width: 80 }}>Trend (12m)</th>
          <th style={{ width: 90, textAlign: 'right' }}>Coverage</th>
          <th style={{ width: 90 }}>Status</th>
          <th style={{ width: 30 }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx} style={{ background: idx === 0 ? 'rgba(184,65,42,0.04)' : undefined }}>
            <td>
              <span className="num" style={{ color: 'var(--ink-4)', fontSize: 12 }}>
                {String(r.rank).padStart(2, '0')}
              </span>
            </td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CountryFlag iso={r.iso} />
                <span style={{ fontWeight: 500 }}>{r.country}</span>
              </div>
            </td>
            <td>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                {r.program}
              </div>
            </td>
            <td>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {r.category}
              </span>
            </td>
            <td style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <ScoreNumber value={r.composite} />
                <div style={{ width: 80 }}>
                  <ScoreBar value={r.composite} color={r.rank === 1 ? 'var(--accent)' : 'var(--ink)'} />
                </div>
              </div>
            </td>
            <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}><ScoreNumber value={r.paq} /></td>
            <td style={{ textAlign: 'right', color: 'var(--ink-3)' }}><ScoreNumber value={r.cme} /></td>
            <td><PillarMini pillars={r.pillars} /></td>
            <td>
              <Sparkline
                values={trendForRank(r.rank, r.composite)}
                width={64}
                height={18}
                color={r.rank === 1 ? 'var(--accent)' : 'var(--ink-3)'}
              />
            </td>
            <td style={{ textAlign: 'right' }}>
              <span className="num" style={{ fontSize: 12, color: r.coverage < 0.7 ? 'var(--warning)' : 'var(--ink-3)' }}>
                {(r.coverage * 100).toFixed(0)}%
              </span>
            </td>
            <td>
              {r.status === 'placeholder'
                ? <Chip variant="amber">Pre-cal</Chip>
                : <Chip variant="mute">Scored</Chip>}
            </td>
            <td style={{ color: 'var(--ink-4)' }}>›</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RankingsScreen() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: 1800, width: 1440 }}>
      <TopNav active="rankings" />
      <PreviewBanner />
      <HeroLanding />

      <section style={{ padding: '40px 48px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
              Programme rankings
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              Showing 23 of 187 · sort: composite ↓
            </div>
          </div>
          <p style={{ color: 'var(--ink-3)', maxWidth: 640, marginTop: 4 }}>
            Composite score is the 30/70 weighted blend of CME and PAQ. Click any row for the full provenance trail.
          </p>

          <div style={{ marginTop: 32 }}>
            <FilterBar />
            <RankingsTable />
          </div>
        </div>
      </section>
    </div>
  );
}

window.RankingsScreen = RankingsScreen;
