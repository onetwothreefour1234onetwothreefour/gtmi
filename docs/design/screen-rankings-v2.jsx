// Landing v2 — adds: this-edition strip, world map, leaders by category,
// editors quote, provenance proof, footer.
// Re-uses HeroLanding, FilterBar, RankingsTable from screen-rankings.jsx via window.

// ---------- Specimen: 30/70 wheel as standalone artefact ----------
function SplitSpecimen() {
  return (
    <div style={{ position: 'relative', width: 360, height: 360 }}>
      <svg viewBox="0 0 200 200" width="360" height="360" style={{ display: 'block' }}>
        {/* PAQ — 70%, oxblood arc */}
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--accent)" strokeWidth="22"
          strokeDasharray={`${0.7 * 565.48} ${565.48}`} transform="rotate(-90 100 100)" />
        {/* CME — 30%, navy arc */}
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--navy)" strokeWidth="22"
          strokeDasharray={`${0.3 * 565.48} ${565.48}`}
          strokeDashoffset={-0.7 * 565.48}
          transform="rotate(-90 100 100)" />
        {/* labels */}
        <text x="100" y="92" textAnchor="middle" fontFamily="Fraunces" fontSize="30" fontWeight="500" fill="var(--ink)">100</text>
        <text x="100" y="112" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-3)" letterSpacing="2">COMPOSITE</text>
      </svg>
      {/* Side legend */}
      <div style={{ position: 'absolute', top: 28, right: -110, display: 'flex', flexDirection: 'column', gap: 24, width: 110 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, background: 'var(--accent)' }}></div>
            <div className="num" style={{ fontSize: 22, fontFamily: 'var(--serif)', fontWeight: 500 }}>70%</div>
          </div>
          <div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>PAQ</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, lineHeight: 1.4 }}>
            Programme architecture &amp; quality
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, background: 'var(--navy)' }}></div>
            <div className="num" style={{ fontSize: 22, fontFamily: 'var(--serif)', fontWeight: 500 }}>30%</div>
          </div>
          <div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>CME</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, lineHeight: 1.4 }}>
            Comparative mobility engine
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Specimen: 5 pillars as a typographic poster ----------
function PillarsSpecimen() {
  const pillars = [
    { code: 'A', name: 'Architecture',  weight: 24, color: 'var(--pillar-a)' },
    { code: 'B', name: 'Process',        weight: 22, color: 'var(--pillar-b)' },
    { code: 'C', name: 'Family',         weight: 12, color: 'var(--pillar-c)' },
    { code: 'D', name: 'Recourse',       weight:  6, color: 'var(--pillar-d)' },
    { code: 'E', name: 'Stability',      weight:  6, color: 'var(--pillar-e)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, width: 600, border: '1px solid var(--rule)', background: 'var(--paper)' }}>
      {pillars.map((p, i) => (
        <div key={i} style={{
          padding: '24px 16px',
          borderRight: i < 4 ? '1px solid var(--rule)' : 0,
          textAlign: 'left',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: p.color }}></div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, color: p.color, lineHeight: 1, marginTop: 8, letterSpacing: '-0.04em' }}>
            {p.code}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {p.name}
          </div>
          <div className="num" style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 6 }}>
            {p.weight}% wt
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- This Edition Strip ----------

function ThisEdition() {
  const items = [
    {
      label: 'Highest mover (30d)',
      delta: '+5.2',
      deltaColor: 'var(--positive)',
      programme: 'Singapore · Tech.Pass',
      score: 71.2,
      rank: '#2 ↑30d',
      why: 'Quota raised 1,200 → 1,800 (Apr 2026); coverage improved across pillars A and B.',
    },
    {
      label: 'New entrant',
      delta: 'NEW',
      deltaColor: 'var(--accent)',
      programme: 'UAE · Golden Visa (Skilled)',
      score: 45.9,
      rank: '#18 debut',
      why: 'First scoring of the skilled-stream renewal pathway under Federal Decree-Law 16/2024.',
    },
    {
      label: 'Largest revision (30d)',
      delta: '−3.4',
      deltaColor: 'var(--negative)',
      programme: 'United Kingdom · Skilled Worker',
      score: 58.7,
      rank: '#7 ↓30d',
      why: 'Salary threshold rebase + fee schedule update flowed through indicators A.01, B.02, B.04.',
    },
  ];
  return (
    <section style={{ padding: '56px 48px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>Recent activity · last 30 days</Eyebrow>
            <h2 className="serif" style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
              The index is alive. Scores update as policy moves.
            </h2>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: 'var(--paper)', padding: 28, position: 'relative' }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 16 }}>{it.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span className="num-l" style={{ fontSize: 44, color: it.deltaColor, lineHeight: 1 }}>{it.delta}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>composite</span>
              </div>
              <div style={{ marginTop: 16, fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em' }}>
                {it.programme}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 6 }}>
                <span className="num" style={{ fontSize: 13 }}>{it.score.toFixed(1)}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{it.rank}</span>
              </div>
              <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 0 }}>
                {it.why}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- World Map (stylized choropleth grid) ----------
// We render a low-fidelity dot-matrix map with regional groupings.
// This reads as institutional / FT-style rather than fake-geographic.

function WorldMap() {
  // Dot-matrix world map: each dot = a country, coloured by composite quintile.
  // Compact, editorial, avoids fake-precision geography.

  const quintile = (v) => v >= 70 ? 5 : v >= 60 ? 4 : v >= 50 ? 3 : v >= 40 ? 2 : 1;
  const colors = {
    5: 'var(--accent)',
    4: '#D27F66',
    3: '#C9A48E',
    2: '#B5A687',
    1: '#9C9275',
    0: 'var(--paper-3)',
  };

  // Hand-laid dot grid roughly approximating continental positions.
  // Each entry: [col, row, iso, score, name]
  const dots = [
    // North America
    [3, 3, 'CAN', 64.3, 'Canada'],
    [3, 4, 'CAN', 64.3, 'Canada'],
    [4, 4, 'USA', 43.6, 'United States'],
    [3, 5, 'USA', 43.6, 'United States'],
    [4, 5, 'USA', 43.6, 'United States'],
    [3, 6, 'MEX', 0, 'Mexico'],
    // South America
    [5, 8, 'BRA', 0, 'Brazil'],
    [5, 9, 'BRA', 0, 'Brazil'],
    [4, 9, 'CHL', 0, 'Chile'],
    [4, 10, 'ARG', 0, 'Argentina'],
    // Europe
    [9, 3, 'ISL', 41.7, 'Iceland'],
    [10, 3, 'NOR', 44.0, 'Norway'],
    [10, 4, 'SWE', 54.9, 'Sweden'],
    [11, 3, 'FIN', 42.4, 'Finland'],
    [9, 4, 'IRL', 61.4, 'Ireland'],
    [10, 4.5, 'GBR', 58.7, 'United Kingdom'],
    [10, 5, 'NLD', 66.8, 'Netherlands'],
    [11, 5, 'DEU', 62.9, 'Germany'],
    [11, 4, 'EST', 44.8, 'Estonia'],
    [10, 5.5, 'BEL', 50.7, 'Belgium'],
    [10, 6, 'FRA', 46.7, 'France'],
    [11, 6, 'CHE', 78.4, 'Switzerland'],
    [11.5, 6, 'AUT', 49.8, 'Austria'],
    [10.5, 5.8, 'LUX', 52.8, 'Luxembourg'],
    // MENA / Africa
    [12, 7, 'ARE', 45.9, 'UAE'],
    [11.5, 7, 'SAU', 0, 'Saudi Arabia'],
    [11, 7, 'EGY', 0, 'Egypt'],
    [10, 8, 'NGA', 0, 'Nigeria'],
    [11, 9, 'KEN', 0, 'Kenya'],
    [11, 10, 'ZAF', 0, 'South Africa'],
    // Asia
    [13, 5, 'JPN', 47.9, 'Japan'],
    [13, 6, 'JPN', 47.9, 'Japan'],
    [13, 5.5, 'KOR', 0, 'South Korea'],
    [12.5, 6, 'HKG', 53.6, 'Hong Kong'],
    [13, 7, 'SGP', 71.2, 'Singapore'],
    [12, 7.5, 'IND', 0, 'India'],
    [12.5, 5, 'CHN', 0, 'China'],
    // Oceania
    [14, 9, 'AUS', 56.2, 'Australia'],
    [14.5, 9.5, 'AUS', 56.2, 'Australia'],
    [15, 10, 'NZL', 48.5, 'New Zealand'],
  ];

  const cellSize = 18;
  const cols = 17;
  const rows = 12;

  return (
    <section style={{ padding: '64px 0 0', borderBottom: '1px solid var(--rule)', background: 'var(--paper)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
            The world by composite
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip variant="ink">Composite</Chip>
            <Chip>PAQ</Chip>
            <Chip>CME</Chip>
          </div>
        </div>
        <p style={{ color: 'var(--ink-3)', maxWidth: 640, marginTop: 4 }}>
          Each dot is a jurisdiction&rsquo;s top-scoring talent visa programme, coloured by quintile.
          Greyed dots mark countries currently out of scope.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 48, marginTop: 32, alignItems: 'flex-start' }}>
          <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${cols * cellSize} ${rows * cellSize}`} width="100%" style={{ display: 'block' }}>
              {/* faint background grid */}
              {[...Array(rows)].map((_, r) => (
                [...Array(cols)].map((_, c) => (
                  <circle key={`${r}-${c}`} cx={c * cellSize + cellSize / 2} cy={r * cellSize + cellSize / 2} r={1} fill="var(--rule-soft)" />
                ))
              ))}
              {/* country dots */}
              {dots.map(([c, r, iso, score], i) => (
                <g key={i}>
                  <circle
                    cx={c * cellSize + cellSize / 2}
                    cy={r * cellSize + cellSize / 2}
                    r={score > 0 ? 5.5 : 3.5}
                    fill={score > 0 ? colors[quintile(score)] : 'var(--paper-3)'}
                    stroke={score > 0 ? 'rgba(0,0,0,0.08)' : 'var(--rule)'}
                    strokeWidth={0.5}
                  />
                </g>
              ))}
              {/* highlighted Switzerland */}
              <g>
                <circle cx={11 * cellSize + cellSize / 2} cy={6 * cellSize + cellSize / 2} r={9} fill="none" stroke="var(--ink)" strokeWidth={1} />
                <line x1={11 * cellSize + cellSize / 2 + 12} y1={6 * cellSize + cellSize / 2} x2={11 * cellSize + cellSize / 2 + 38} y2={6 * cellSize + cellSize / 2} stroke="var(--ink)" strokeWidth={0.5} />
                <text x={11 * cellSize + cellSize / 2 + 42} y={6 * cellSize + cellSize / 2 + 1} fontSize="7" fontFamily="var(--mono)" fill="var(--ink)">CHE · 78.4 · #1</text>
              </g>
              {/* singapore label */}
              <g>
                <line x1={13 * cellSize + cellSize / 2} y1={7 * cellSize + cellSize / 2 + 7} x2={13 * cellSize + cellSize / 2} y2={7 * cellSize + cellSize / 2 + 22} stroke="var(--ink-4)" strokeWidth={0.5} />
                <text x={13 * cellSize + cellSize / 2} y={7 * cellSize + cellSize / 2 + 30} fontSize="6.5" fontFamily="var(--mono)" fill="var(--ink-4)" textAnchor="middle">SGP · 71.2</text>
              </g>
              {/* netherlands label */}
              <g>
                <line x1={10 * cellSize + cellSize / 2 - 6} y1={5 * cellSize + cellSize / 2} x2={10 * cellSize + cellSize / 2 - 22} y2={5 * cellSize + cellSize / 2} stroke="var(--ink-4)" strokeWidth={0.5} />
                <text x={10 * cellSize + cellSize / 2 - 24} y={5 * cellSize + cellSize / 2 + 1} fontSize="6.5" fontFamily="var(--mono)" fill="var(--ink-4)" textAnchor="end">NLD · 66.8</text>
              </g>
            </svg>
          </div>

          <div>
            <Eyebrow style={{ marginBottom: 12 }}>Composite quintile</Eyebrow>
            {[
              { range: '70 +', count: 2, color: colors[5], label: 'Tier 1' },
              { range: '60–70', count: 4, color: colors[4], label: 'Tier 2' },
              { range: '50–60', count: 6, color: colors[3], label: 'Tier 3' },
              { range: '40–50', count: 11, color: colors[2], label: 'Tier 4' },
              { range: '< 40', count: 0, color: colors[1], label: 'Tier 5' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: i === 0 ? '1px solid var(--rule)' : 0, borderBottom: '1px solid var(--rule)' }}>
                <span style={{ width: 14, height: 14, background: b.color, borderRadius: '50%', flex: '0 0 14px' }}></span>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{b.label}</span>
                <span className="num" style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--ink-3)' }}>{b.range}</span>
                <span className="num" style={{ width: 32, textAlign: 'right', fontSize: 12, color: 'var(--ink-4)' }}>{b.count}</span>
              </div>
            ))}
            <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.55 }}>
              Counts reflect top-scoring programmes per jurisdiction, current scoring run.
              Phase 5 calibration may shift quintile boundaries.
            </p>
          </div>
        </div>
      </div>
      <div style={{ height: 64 }}></div>
    </section>
  );
}

// ---------- Leaders by Category ----------

function LeadersByCategory() {
  const cats = [
    { name: 'Skilled Worker',  count: 78, top: [
      ['CHE', 'L-Permit (Highly Qualified)', 78.4],
      ['NLD', 'Highly Skilled Migrant',       66.8],
      ['IRL', 'Critical Skills Permit',       61.4],
    ] },
    { name: 'Tech Talent',     count: 24, top: [
      ['SGP', 'Tech.Pass',                    71.2],
      ['HKG', 'Top Talent Pass — A',          53.6],
      ['JPN', 'HSP Type 1',                   47.9],
    ] },
    { name: 'Talent Visa',     count: 19, top: [
      ['FRA', 'Talent Passport',              46.7],
      ['ARE', 'Golden Visa (Skilled)',        45.9],
      ['USA', 'O-1A Extraordinary Ability',   43.6],
    ] },
    { name: 'Points-Based',    count: 14, top: [
      ['CAN', 'Express Entry — FSW',          64.3],
      ['AUT', 'Red-White-Red Card (Skilled)', 49.8],
      ['NZL', 'SMC Resident',                 48.5],
    ] },
    { name: 'EU Blue Card',    count: 27, top: [
      ['DEU', 'EU Blue Card (DE)',            62.9],
      ['NLD', 'EU Blue Card (NL)',            58.2],
      ['FRA', 'EU Blue Card (FR)',            54.0],
    ] },
  ];

  return (
    <section style={{ padding: '64px 48px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
            Leaders by category
          </h2>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
            162 programmes · 5 categories
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
          {cats.map((cat, i) => (
            <div key={i} style={{ background: 'var(--paper)', padding: 20 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{cat.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginBottom: 16 }}>
                {cat.count} programmes
              </div>
              {cat.top.map(([iso, name, score], j) => (
                <div key={j} style={{ paddingTop: j === 0 ? 0 : 10, paddingBottom: 10, borderTop: j === 0 ? 0 : '1px solid var(--rule-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="num" style={{ fontSize: 10, color: 'var(--ink-4)', width: 14 }}>0{j + 1}</span>
                    <CountryFlag iso={iso} />
                    <span className="num" style={{ fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>{score.toFixed(1)}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, lineHeight: 1.3, paddingLeft: 22 }}>
                    {name}
                  </div>
                </div>
              ))}
              <a href="#" className="btn-link" style={{ fontSize: 11, marginTop: 8, display: 'inline-block' }}>
                See all {cat.count} →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Editors Quote (full-bleed dark) ----------

function EditorsQuote() {
  return (
    <section style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '96px 48px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 1, background: 'var(--accent)' }}></div>
          <div className="eyebrow" style={{ color: 'var(--accent-soft)' }}>
            From the editors · No. 01
          </div>
        </div>
        <blockquote className="serif dropcap" style={{
          fontSize: 42,
          fontWeight: 300,
          lineHeight: 1.22,
          letterSpacing: '-0.02em',
          margin: 0,
          textWrap: 'pretty',
          color: 'var(--paper)',
        }}>
          A talent visa programme is a contract between a sovereign and a stranger.
          GTMI exists because most of those contracts have never been read end-to-end,
          and almost none have been compared on the same terms.
        </blockquote>
        <div style={{ marginTop: 48, display: 'flex', gap: 24, alignItems: 'center', paddingTop: 32, borderTop: '1px solid rgba(247,244,237,0.15)' }}>
          <div style={{ width: 4, height: 48, background: 'var(--accent)' }}></div>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, fontStyle: 'italic' }}>The GTMI Editorial Team</div>
            <div style={{ fontSize: 12, color: 'rgba(247,244,237,0.6)', marginTop: 4, fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              TTR Group · Editor&rsquo;s note
            </div>
          </div>
          <div style={{ flex: 1 }}></div>
          <a href="#" style={{ color: 'var(--paper)', fontSize: 13, borderBottom: '1px solid rgba(247,244,237,0.4)', textDecoration: 'none', paddingBottom: 1 }}>
            Read the full note →
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------- Provenance Proof Strip ----------

function ProvenanceProof() {
  return (
    <section style={{ padding: '80px 48px', background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 64, alignItems: 'flex-start' }}>
          <div>
            <Eyebrow style={{ marginBottom: 16 }}>Provenance · the differentiator</Eyebrow>
            <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Every score on this page traces to a sentence in a primary document.
            </h2>
            <p style={{ marginTop: 16, color: 'var(--ink-3)', fontSize: 15, lineHeight: 1.6 }}>
              No aggregator data, no &ldquo;industry consensus&rdquo;, no marketing copy. If we can&rsquo;t
              point to the words, we don&rsquo;t score the indicator. Here&rsquo;s one, fully exposed.
            </p>
            <button className="btn" style={{ marginTop: 32 }}>How provenance works →</button>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--rule)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <div>
                <div className="num" style={{ fontSize: 11, color: 'var(--ink-4)' }}>A.03</div>
                <div className="serif" style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }}>
                  Labour-market test required
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="eyebrow" style={{ fontSize: 9 }}>Score</div>
                <div className="num-l" style={{ fontSize: 22 }}>62</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)', marginBottom: 8 }}>
                SEM · Bundesgesetz über die Ausländerinnen und Ausländer · §21
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', borderLeft: '3px solid var(--accent)', paddingLeft: 16 }}>
                […] Eine Bewilligung kann nur erteilt werden, wenn nachgewiesen ist, dass <mark style={{ background: '#FBE5DC', padding: '1px 0' }}>für die anzustellende Person in der Schweiz und in den EU/EFTA-Staaten keine geeignete Person gefunden werden konnte</mark>. Der Vorrang ist während mindestens vier Wochen […]
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--rule-soft)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)' }}>
                <div><span style={{ color: 'var(--ink-5)' }}>chars</span><br/>14,231→14,498</div>
                <div><span style={{ color: 'var(--ink-5)' }}>page</span><br/>12 / 87</div>
                <div><span style={{ color: 'var(--ink-5)' }}>sha256</span><br/>8f3a…b21c</div>
                <div><span style={{ color: 'var(--ink-5)' }}>scraped</span><br/>2026-03-28</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Footer ----------

function GtmiFooter() {
  return (
    <footer style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '64px 48px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 48, paddingBottom: 48, borderBottom: '1px solid rgba(247,244,237,0.15)' }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>
              GTMI
            </div>
            <div style={{ fontSize: 11, color: 'rgba(247,244,237,0.55)', marginTop: 4, lineHeight: 1.5 }}>
              Global Talent Mobility Index<br/>
              A research instrument by TTR Group
            </div>
            <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(247,244,237,0.5)', fontFamily: 'var(--mono)', lineHeight: 1.7 }}>
              Continuously updated<br/>
              Last refresh: 03 APR 2026<br/>
              Built by TTR Group
            </div>
          </div>

          {[
            { title: 'The Index', items: ['Rankings', 'Programmes', 'Countries', 'Compare', 'Advisor mode'] },
            { title: 'Methodology', items: ['Weight tree', '30 / 70 split', 'Falsifiability', 'Provenance', 'Pre-calibration'] },
            { title: 'Transparency', items: ['Data sources', 'Spec on GitHub ↗', 'Cite this index', 'License (CC BY 4.0)'] },
            { title: 'TTR Group', items: ['About', 'Editorial team', 'Press', 'Contact', 'careers@ttrgroup.ae'] },
          ].map((col, i) => (
            <div key={i}>
              <div className="eyebrow" style={{ color: 'rgba(247,244,237,0.5)', fontSize: 10, marginBottom: 16 }}>{col.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.items.map((it, j) => (
                  <li key={j}>
                    <a href="#" style={{ color: 'var(--paper)', fontSize: 13, textDecoration: 'none' }}>{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* primary data sources */}
        <div style={{ paddingTop: 32, paddingBottom: 32, borderBottom: '1px solid rgba(247,244,237,0.15)' }}>
          <div className="eyebrow" style={{ color: 'rgba(247,244,237,0.5)', fontSize: 10, marginBottom: 12 }}>Primary data sources</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['SEM', 'Home Office', 'IND NL', 'BAMF', 'IRCC', 'USCIS', 'MOM SG', 'IMM HK', 'DHA AU', 'INZ NZ', 'MOFA JP', 'IND FR', 'OECD MIG', 'Eurostat', 'World Bank', 'IMF', 'ICAEW', 'ILO'].map((s, i) => (
              <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(247,244,237,0.7)', border: '1px solid rgba(247,244,237,0.2)', padding: '3px 8px' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'rgba(247,244,237,0.5)', fontFamily: 'var(--mono)' }}>
          <span>© TTR Group. All rights reserved.</span>
          <span style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ color: 'rgba(247,244,237,0.7)' }}>Terms</a>
            <a href="#" style={{ color: 'rgba(247,244,237,0.7)' }}>Privacy</a>
            <a href="#" style={{ color: 'rgba(247,244,237,0.7)' }}>Contact</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ---------- Landing v2 — composed ----------

function RankingsScreenV2() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: 1800, width: 1440 }}>
      <TopNav active="rankings" />
      <PreviewBanner />
      <HeroLanding />

      <ThisEdition />

      <WorldMap />

      <SpecimenPlate
        plateNo="I"
        title="Five pillars. Forty-eight indicators."
        caption="Pillar weights are fixed in spec/weights.yaml and drive both this page and the production scoring engine. There is no separate executive-summary version."
        tone="paper-3"
      >
        <PillarsSpecimen />
      </SpecimenPlate>

      <LeadersByCategory />
      <EditorsQuote />
      <ProvenanceProof />

      <section style={{ padding: '64px 48px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
              Full programme rankings
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
              Showing 23 of 187 · sort: composite ↓
            </div>
          </div>
          <p style={{ color: 'var(--ink-3)', maxWidth: 640, marginTop: 4 }}>
            Composite is the 30 / 70 weighted blend of CME and PAQ. Click any row for the full provenance trail.
          </p>

          <div style={{ marginTop: 32 }}>
            <FilterBar />
            <RankingsTable />
          </div>
        </div>
      </section>

      <GtmiFooter />
    </div>
  );
}

window.RankingsScreenV2 = RankingsScreenV2;
