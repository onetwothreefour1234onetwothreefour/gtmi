// Methodology screen — auto-rendered weight tree + 30/70 split + indicator catalog

function MethodologyHeader() {
  return (
    <section style={{ padding: '64px 48px 48px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Eyebrow style={{ marginBottom: 24 }}>Methodology</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64, alignItems: 'flex-end' }}>
          <h1 className="serif" style={{ fontSize: 64, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0, textWrap: 'balance' }}>
            How the index is constructed, defended, and made <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>falsifiable</em>.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0 }}>
            The GTMI methodology is a public artefact. Every weight, every normalization rule, and every
            scoring branch is rendered from the same source-of-truth that powers the rankings. Change the
            spec, change the page.
          </p>
        </div>

        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
          {[
            ['Pillars', '5'],
            ['Indicators', '48'],
            ['Programmes scored', '187'],
            ['Source documents', '2,431'],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--paper)', padding: 20 }}>
              <div className="eyebrow" style={{ fontSize: 10 }}>{l}</div>
              <div className="num-l" style={{ fontSize: 32, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SplitVisual() {
  return (
    <section style={{ padding: '64px 48px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
          The 30 / 70 split
        </h2>
        <p style={{ color: 'var(--ink-3)', maxWidth: 720, marginTop: 8 }}>
          PAQ is weighted higher than CME because programme architecture &mdash; what the law actually
          guarantees &mdash; is more falsifiable, less noisy, and harder to game than outcomes data.
        </p>

        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '30fr 70fr', gap: 1 }}>
          {/* CME column */}
          <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: 32, minHeight: 400 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 72, fontWeight: 500, letterSpacing: '-0.03em' }}>30</span>
              <span style={{ fontSize: 28, color: 'rgba(247,244,237,0.6)' }}>%</span>
            </div>
            <div className="eyebrow" style={{ color: 'rgba(247,244,237,0.7)', marginTop: 8 }}>Comparative Mobility Engine</div>
            <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.55, color: 'rgba(247,244,237,0.8)' }}>
              Outcome-based: what happens after the visa is issued. Wage uplift, time-to-PR, route
              durability, dependent labour rights actually exercised.
            </p>
            <div style={{ marginTop: 24 }}>
              {[
                ['E.01', 'Wage uplift vs. host median', 4.5],
                ['E.02', 'Median time-to-PR (months)', 3.5],
                ['E.03', 'PR conversion rate (5y)', 3.5],
                ['E.04', 'Dependant employment %', 3.0],
                ['E.05', 'Renewal success rate', 3.0],
                ['E.06', 'Programme retention (3y)', 3.0],
                ['E.07', 'Onward-mobility (citizenship)', 2.5],
                ['E.08', 'Programme volume vs. cap', 2.5],
                ['E.09', 'Wage compression vs. nationals', 4.5],
              ].map(([id, name, w]) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(247,244,237,0.12)', fontSize: 12 }}>
                  <span className="num" style={{ width: 36, color: 'rgba(247,244,237,0.5)' }}>{id}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 13 }}>{name}</span>
                  <span className="num" style={{ color: 'rgba(247,244,237,0.7)' }}>{w}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* PAQ column */}
          <div style={{ background: 'var(--paper-2)', padding: 32, minHeight: 400 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 72, fontWeight: 500, letterSpacing: '-0.03em' }}>70</span>
              <span style={{ fontSize: 28, color: 'var(--ink-4)' }}>%</span>
            </div>
            <div className="eyebrow" style={{ marginTop: 8 }}>Programme Architecture &amp; Quality</div>
            <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-3)' }}>
              Architecture-based: what the law promises. Eligibility floors, transparent process, family
              rights, recourse, fairness.
            </p>
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[
                { letter: 'A', name: 'Eligibility', w: 22, color: 'var(--pillar-a)', count: 12 },
                { letter: 'B', name: 'Process & Cost', w: 18, color: 'var(--pillar-b)', count: 11 },
                { letter: 'C', name: 'Family & Rights', w: 16, color: 'var(--pillar-c)', count: 9 },
                { letter: 'D', name: 'Recourse & Fairness', w: 14, color: 'var(--pillar-d)', count: 7 },
              ].map(p => (
                <div key={p.letter} style={{ borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, color: p.color }}>{p.letter}</span>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
                    <span className="num" style={{ fontSize: 24, fontWeight: 600 }}>{p.w}%</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{p.count} indicators</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <ScoreBar value={p.w * 100 / 22} color={p.color} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WeightTree() {
  return (
    <section style={{ padding: '64px 48px', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
            Weight tree
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-link" style={{ fontSize: 12 }}>Export YAML</button>
            <button className="btn-link" style={{ fontSize: 12 }}>Export JSON</button>
            <button className="btn-link" style={{ fontSize: 12 }}>View on GitHub ↗</button>
          </div>
        </div>
        <p style={{ color: 'var(--ink-3)', maxWidth: 720 }}>
          Auto-rendered from <span style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--paper-3)', padding: '1px 6px' }}>spec/weights.yaml</span>.
          This visualization and the live scoring engine read the same file.
        </p>

        <div style={{ marginTop: 32, fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 2.0, color: 'var(--ink-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>Composite</span>
            <span style={{ flex: 1, height: 1, background: 'var(--rule)' }}></span>
            <span className="num">100.0%</span>
          </div>
          {[
            { name: 'PAQ — Programme Architecture & Quality', weight: 70.0, color: 'var(--ink-3)', children: [
              { name: 'A · Eligibility', weight: 22.0, color: 'var(--pillar-a)' },
              { name: 'B · Process & Cost', weight: 18.0, color: 'var(--pillar-b)' },
              { name: 'C · Family & Rights', weight: 16.0, color: 'var(--pillar-c)' },
              { name: 'D · Recourse & Fairness', weight: 14.0, color: 'var(--pillar-d)' },
            ] },
            { name: 'CME — Comparative Mobility Engine', weight: 30.0, color: 'var(--pillar-e)', children: [
              { name: 'E · Outcomes', weight: 30.0, color: 'var(--pillar-e)' },
            ] },
          ].map((parent, i) => (
            <div key={i} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 24, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, color: 'var(--ink-5)' }}>└─</span>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500 }}>{parent.name}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--rule-soft)' }}></span>
                <div style={{ width: 200 }}>
                  <ScoreBar value={parent.weight} color={parent.color} height={6} />
                </div>
                <span className="num" style={{ width: 60, textAlign: 'right' }}>{parent.weight.toFixed(1)}%</span>
              </div>
              {parent.children.map((c, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 56, position: 'relative', fontSize: 13 }}>
                  <span style={{ position: 'absolute', left: 24, color: 'var(--ink-5)' }}>└─</span>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 14, color: c.color, fontWeight: 500 }}>{c.name}</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--rule-soft)' }}></span>
                  <div style={{ width: 200 }}>
                    <ScoreBar value={c.weight * 2} color={c.color} height={4} />
                  </div>
                  <span className="num" style={{ width: 60, textAlign: 'right', color: 'var(--ink-3)' }}>{c.weight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FalsifiabilityCommitments() {
  const items = [
    { n: '01', title: 'Every score is traceable to a primary source.', body: 'No indicator is computed from secondary or aggregated data without an upstream chain. If a source disappears, the score is flagged within 24 hours.' },
    { n: '02', title: 'The scoring spec is the live document.', body: 'spec/weights.yaml drives both this page and the production scoring engine. There is no separate "executive summary" version.' },
    { n: '03', title: 'Every change is recorded with diff and impact.', body: 'Methodology, data, and provenance changes are logged with their composite-score impact. Nothing is silently revised.' },
    { n: '04', title: 'Pre-calibration is disclosed at every score.', body: 'Programmes scored against engineer-chosen normalization ranges carry a Pre-cal chip until the 5-country pilot calibration ships in Phase 5.' },
    { n: '05', title: 'Sources are archived, not just linked.', body: 'Every primary source is captured, hashed (sha256), and stored. We score against the snapshot, not the live URL.' },
    { n: '06', title: 'Disagreements are part of the record.', body: 'When we revise a score after a credible challenge, the prior value, the challenge, and the resolution are kept on the change log indefinitely.' },
  ];
  return (
    <section style={{ padding: '64px 48px 96px', background: 'var(--paper-2)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 64, alignItems: 'flex-start' }}>
          <div style={{ position: 'sticky', top: 32 }}>
            <Eyebrow style={{ marginBottom: 16 }}>Falsifiability commitments</Eyebrow>
            <h2 className="serif" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              The promises that hold the index together.
            </h2>
            <p style={{ color: 'var(--ink-3)', marginTop: 16, fontSize: 15, lineHeight: 1.6 }}>
              Composite indices live or die by what they refuse to do. These are ours.
            </p>
          </div>

          <div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24, padding: '24px 0', borderTop: i === 0 ? '2px solid var(--ink)' : '1px solid var(--rule)' }}>
                <div className="num-l" style={{ fontSize: 28, color: 'var(--accent)', lineHeight: 1 }}>{it.n}</div>
                <div>
                  <h3 className="serif" style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
                    {it.title}
                  </h3>
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                    {it.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MethodologyScreen() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: 1800, width: 1440 }}>
      <TopNav active="methodology" />
      <MethodologyHeader />
      <SplitVisual />
      <WeightTree />
      <FalsifiabilityCommitments />
    </div>
  );
}

window.MethodologyScreen = MethodologyScreen;
