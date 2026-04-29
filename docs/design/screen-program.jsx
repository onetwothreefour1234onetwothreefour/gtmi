// Program detail screen — the meat of provenance + scoring transparency

function ProgramHeader() {
  return (
    <section style={{ padding: '48px 48px 0', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', marginBottom: 24 }}>
          <a href="#" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Rankings</a>
          <span>›</span>
          <a href="#" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Switzerland</a>
          <span>›</span>
          <span style={{ color: 'var(--ink) ' }}>L-Permit (Highly Qualified)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 64, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <CountryFlag iso="CHE" />
              <Eyebrow style={{ margin: 0 }}>Switzerland · Skilled Worker</Eyebrow>
              <Chip variant="mute">Active</Chip>
              <Chip variant="amber">Pre-calibration</Chip>
            </div>
            <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }}>
              L-Permit <em style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>(Highly Qualified)</em>
            </h1>
            <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.55, color: 'var(--ink-3)', maxWidth: 640 }}>
              A short-term residence permit issued under Article 21 LFE for non-EU/EFTA highly qualified
              specialists where Swiss and EU/EFTA labour-market priority cannot be satisfied. Valid up to
              one year, renewable once.
            </p>
          </div>

          <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', padding: 24 }}>
            <Eyebrow style={{ marginBottom: 16 }}>Composite score</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <ScoreNumber value={78.4} large />
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontSize: 13, color: 'var(--ink-3)' }}>Rank #1 of 187</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <ScoreBar value={78.4} color="var(--accent)" height={6} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>PAQ · 70% weight</div>
                <div className="num-l" style={{ fontSize: 26, marginTop: 4 }}>70.7</div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 10 }}>CME · 30% weight</div>
                <div className="num-l" style={{ fontSize: 26, marginTop: 4 }}>100.0</div>
              </div>
            </div>
          </div>
        </div>

        {/* Pillar strip */}
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--rule)', borderTop: '1px solid var(--rule)' }}>
          {[
            ['A', 'Eligibility', 78, 'var(--pillar-a)', '12 ind.'],
            ['B', 'Process & Cost', 72, 'var(--pillar-b)', '11 ind.'],
            ['C', 'Family & Rights', 81, 'var(--pillar-c)', '9 ind.'],
            ['D', 'Recourse & Fairness', 65, 'var(--pillar-d)', '7 ind.'],
            ['E', 'Outcomes (CME)', 84, 'var(--pillar-e)', '9 ind.'],
          ].map(([letter, name, score, color, count], i) => (
            <div key={i} style={{ background: 'var(--paper)', padding: '20px 20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, color }}>{letter}</span>
                <span className="eyebrow" style={{ fontSize: 10 }}>Pillar</span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, letterSpacing: '-0.01em' }}>{name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
                <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>{score}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{count}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <ScoreBar value={score} color={color} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IndicatorRow({ id, name, weight, score, raw, status, sources, hasProvenance = true, highlighted = false }) {
  return (
    <tr style={{ background: highlighted ? 'rgba(184,65,42,0.06)' : undefined }}>
      <td style={{ width: 80 }}>
        <span className="num" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{id}</span>
      </td>
      <td>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>{name}</div>
      </td>
      <td style={{ width: 90, textAlign: 'right' }}>
        <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{weight}%</span>
      </td>
      <td style={{ width: 140 }}>
        <span className="num" style={{ fontSize: 13, color: 'var(--ink)' }}>{raw}</span>
      </td>
      <td style={{ width: 110, textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span className="num" style={{ fontWeight: 600 }}>{score}</span>
          <div style={{ width: 50 }}>
            <ScoreBar value={score} />
          </div>
        </div>
      </td>
      <td style={{ width: 100 }}>
        {hasProvenance
          ? <button className="btn-link" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{sources} src ⛬</button>
          : <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--mono)' }}>missing</span>}
      </td>
      <td style={{ width: 90 }}>
        {status === 'placeholder'
          ? <Chip variant="amber">Pre-cal</Chip>
          : status === 'verified'
            ? <Chip variant="mute">Verified</Chip>
            : <Chip variant="mute">Scored</Chip>}
      </td>
    </tr>
  );
}

function IndicatorTable() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '2px solid var(--ink)' }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, color: 'var(--pillar-a)' }}>A</span>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>Eligibility</span>
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>· 12 indicators · 22% of composite</span>
        <div style={{ flex: 1 }}></div>
        <span className="num" style={{ fontSize: 13 }}>Pillar score: 78.0</span>
      </div>
      <table className="gtmi tabular" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ width: 80 }}>ID</th>
            <th>Indicator</th>
            <th style={{ width: 90, textAlign: 'right' }}>Weight</th>
            <th style={{ width: 140 }}>Raw value</th>
            <th style={{ width: 110, textAlign: 'right' }}>Score</th>
            <th style={{ width: 100 }}>Provenance</th>
            <th style={{ width: 90 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          <IndicatorRow id="A.01" name="Minimum salary threshold (EUR PPP)" weight={3.5} raw="€85,420 / yr" score={82} sources={3} status="verified" />
          <IndicatorRow id="A.02" name="Education requirement floor" weight={2.5} raw="Master's or 5y exp." score={78} sources={2} status="verified" />
          <IndicatorRow id="A.03" name="Labour-market test required" weight={3.0} raw="Yes (4-week test)" score={62} sources={4} status="verified" highlighted />
          <IndicatorRow id="A.04" name="Quota / annual cap" weight={2.0} raw="8,500 (2026)" score={55} sources={5} status="verified" />
          <IndicatorRow id="A.05" name="Age cap" weight={1.0} raw="None" score={100} sources={1} status="verified" />
          <IndicatorRow id="A.06" name="Language requirement" weight={2.0} raw="None for permit" score={92} sources={2} status="verified" />
          <IndicatorRow id="A.07" name="Employer sponsorship required" weight={2.5} raw="Yes" score={70} sources={3} status="verified" />
          <IndicatorRow id="A.08" name="Self-employment pathway" weight={1.5} raw="Restricted" score={48} sources={2} status="verified" />
          <IndicatorRow id="A.09" name="Recognition of foreign qualifications" weight={2.0} raw="Bilateral + SBFI" score={76} sources={3} status="verified" />
          <IndicatorRow id="A.10" name="Profession-specific licensing burden" weight={1.5} raw="Sector-dependent" score={64} sources={3} status="placeholder" />
          <IndicatorRow id="A.11" name="Background-check scope" weight={1.0} raw="Crim + financial" score={70} sources={2} status="verified" />
          <IndicatorRow id="A.12" name="Health / medical screening" weight={0.5} raw="None standard" score={88} sources={1} status="verified" />
        </tbody>
      </table>
    </div>
  );
}

function ProvenanceDrawer() {
  return (
    <aside style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0,
      width: 540,
      background: 'var(--paper)',
      borderLeft: '2px solid var(--ink)',
      boxShadow: '-24px 0 64px -24px rgba(26,26,26,0.18)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* drawer header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Eyebrow>Indicator · Provenance</Eyebrow>
          <button style={{ background: 'none', border: 0, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div className="num" style={{ fontSize: 11, color: 'var(--ink-4)' }}>A.03</div>
        <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 12px', letterSpacing: '-0.01em' }}>
          Labour-market test required
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Raw</div>
            <div className="num" style={{ fontSize: 14, marginTop: 2 }}>Yes (4-week test)</div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--rule)' }}></div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Score</div>
            <div className="num" style={{ fontSize: 14, marginTop: 2 }}>62 / 100</div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--rule)' }}></div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Weight</div>
            <div className="num" style={{ fontSize: 14, marginTop: 2 }}>3.0%</div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--rule)' }}></div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Sources</div>
            <div className="num" style={{ fontSize: 14, marginTop: 2 }}>4 chained</div>
          </div>
        </div>
      </div>

      {/* drawer body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 32px' }}>
        <Eyebrow style={{ marginBottom: 12 }}>Source 1 of 4 · Primary</Eyebrow>

        <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)' }}>
            <span>SEM · Bundesgesetz über die Ausländerinnen und Ausländer (AuG)</span>
            <span>2024-08-12 → §21</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            […] Eine Bewilligung zur Ausübung einer Erwerbstätigkeit kann nur erteilt werden, wenn nachgewiesen
            ist, dass <mark style={{ background: '#FBE5DC', padding: '2px 0', borderBottom: '2px solid var(--accent)' }}>
              für die anzustellende Person in der Schweiz und in den EU/EFTA-Staaten keine geeignete Person gefunden
              werden konnte
            </mark>. Der Vorrang ist während mindestens vier Wochen durch Veröffentlichung […]
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)' }}>
            <div><span style={{ color: 'var(--ink-5)' }}>chars:</span> 14,231 → 14,498</div>
            <div><span style={{ color: 'var(--ink-5)' }}>page:</span> 12 / 87</div>
            <div><span style={{ color: 'var(--ink-5)' }}>sha256:</span> 8f3a…b21c</div>
            <div><span style={{ color: 'var(--ink-5)' }}>scraped:</span> 2026-03-28 04:11Z</div>
          </div>
        </div>

        <Eyebrow style={{ marginBottom: 12 }}>Source 2 of 4 · Corroborating</Eyebrow>
        <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-4)' }}>
            <span>SEM Weisungen AIG · Kapitel 4.3.5</span>
            <span>2025-01-08 rev.</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            <mark style={{ background: '#FBE5DC', padding: '2px 0' }}>The four-week priority publication on RAV/EURES is mandatory</mark> prior
            to issuance of an L-permit under Art. 21 unless the applicant qualifies under Art. 23(3)…
          </div>
        </div>

        <Eyebrow style={{ marginBottom: 12 }}>Scoring rule</Eyebrow>
        <div style={{ border: '1px solid var(--rule)', padding: 16, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)', background: 'var(--paper)' }}>
          <span style={{ color: 'var(--ink-4)' }}>// indicator A.03 · normalized scoring</span><br/>
          <span style={{ color: 'var(--accent-2)' }}>if</span> labourMarketTest == none → <span className="num">100</span><br/>
          <span style={{ color: 'var(--accent-2)' }}>else if</span> duration ≤ 14d → <span className="num">78</span><br/>
          <span style={{ color: 'var(--accent-2)' }}>else if</span> duration ≤ 30d → <span className="num">62</span> ← <span style={{ color: 'var(--accent)' }}>match</span><br/>
          <span style={{ color: 'var(--accent-2)' }}>else</span> → <span className="num">40</span>
        </div>
      </div>
    </aside>
  );
}

function ProgramDetailScreen() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: 1800, width: 1440, position: 'relative' }}>
      <TopNav active="programs" />
      <ProgramHeader />

      <section style={{ padding: '48px 48px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
              Indicators &amp; provenance
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <Chip>All pillars</Chip>
              <Chip variant="ink">A — Eligibility</Chip>
              <Chip>B — Process</Chip>
              <Chip>C — Family</Chip>
              <Chip>D — Recourse</Chip>
              <Chip>E — Outcomes</Chip>
            </div>
          </div>
          <p style={{ color: 'var(--ink-3)', maxWidth: 720, marginTop: 4 }}>
            Every indicator below is traceable to a primary source. Click any row to inspect the full
            provenance chain — sentence, character offsets, document hash, scrape timestamp.
          </p>

          <div style={{ marginTop: 32 }}>
            <IndicatorTable />
          </div>
        </div>
      </section>

      <ProvenanceDrawer />
    </div>
  );
}

window.ProgramDetailScreen = ProgramDetailScreen;
