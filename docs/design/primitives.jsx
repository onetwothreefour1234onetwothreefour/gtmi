// Shared GTMI primitives — used across all screens
// Exposed on window for cross-script use

const GTMI_DATA = {
  programs: [
    { rank: 1,  country: 'Switzerland',  iso: 'CHE', flag: '🇨🇭', program: 'L-Permit (Highly Qualified)',           category: 'Skilled Worker',       composite: 78.4, paq: 70.7, cme: 100.0, coverage: 0.92, status: 'scored', pillars: { A: 78, B: 72, C: 81, D: 65, E: 84 } },
    { rank: 2,  country: 'Singapore',    iso: 'SGP', flag: '🇸🇬', program: 'Tech.Pass',                              category: 'Tech Talent',          composite: 71.2, paq: 70.9, cme: 71.9, coverage: 0.85, status: 'scored', pillars: { A: 74, B: 81, C: 64, D: 58, E: 79 } },
    { rank: 3,  country: 'Netherlands',  iso: 'NLD', flag: '🇳🇱', program: 'Highly Skilled Migrant',                 category: 'Skilled Worker',       composite: 66.8, paq: 71.4, cme: 56.0, coverage: 0.88, status: 'scored', pillars: { A: 70, B: 78, C: 76, D: 65, E: 68 } },
    { rank: 4,  country: 'Canada',       iso: 'CAN', flag: '🇨🇦', program: 'Express Entry — FSW',                     category: 'Points-Based',          composite: 64.3, paq: 63.5, cme: 66.1, coverage: 0.80, status: 'scored', pillars: { A: 68, B: 60, C: 71, D: 74, E: 44 } },
    { rank: 5,  country: 'Germany',      iso: 'DEU', flag: '🇩🇪', program: 'EU Blue Card (DE)',                       category: 'EU Blue Card',          composite: 62.9, paq: 64.1, cme: 60.0, coverage: 0.86, status: 'scored', pillars: { A: 72, B: 58, C: 70, D: 60, E: 60 } },
    { rank: 6,  country: 'Ireland',      iso: 'IRL', flag: '🇮🇪', program: 'Critical Skills Employment Permit',       category: 'Skilled Worker',       composite: 61.4, paq: 60.8, cme: 62.7, coverage: 0.78, status: 'scored', pillars: { A: 64, B: 58, C: 66, D: 60, E: 56 } },
    { rank: 7,  country: 'United Kingdom', iso: 'GBR', flag: '🇬🇧', program: 'Skilled Worker (Eligible Occupations)', category: 'Skilled Worker',       composite: 58.7, paq: 64.5, cme: 45.0, coverage: 0.83, status: 'scored', pillars: { A: 66, B: 70, C: 62, D: 64, E: 58 } },
    { rank: 8,  country: 'Australia',    iso: 'AUS', flag: '🇦🇺', program: 'Skills in Demand 482 — Core',             category: 'Skilled Worker',       composite: 56.2, paq: 58.3, cme: 51.5, coverage: 0.62, status: 'placeholder', pillars: { A: 60, B: 55, C: 64, D: 56, E: 52 } },
    { rank: 9,  country: 'Sweden',       iso: 'SWE', flag: '🇸🇪', program: 'Work Permit (Skilled Worker)',            category: 'Skilled Worker',       composite: 54.9, paq: 56.4, cme: 51.5, coverage: 0.74, status: 'scored', pillars: { A: 60, B: 50, C: 64, D: 58, E: 49 } },
    { rank: 10, country: 'Hong Kong',    iso: 'HKG', flag: '🇭🇰', program: 'Top Talent Pass (TTPS) — A',              category: 'Tech Talent',           composite: 53.6, paq: 60.2, cme: 38.7, coverage: 0.76, status: 'scored', pillars: { A: 70, B: 64, C: 56, D: 50, E: 60 } },
    { rank: 11, country: 'Luxembourg',   iso: 'LUX', flag: '🇱🇺', program: 'Salaried Worker',                          category: 'Skilled Worker',       composite: 52.8, paq: 54.0, cme: 50.0, coverage: 0.70, status: 'scored', pillars: { A: 56, B: 52, C: 60, D: 50, E: 50 } },
    { rank: 12, country: 'Singapore',    iso: 'SGP', flag: '🇸🇬', program: 'Employment Pass',                          category: 'Skilled Worker',       composite: 51.9, paq: 49.5, cme: 57.5, coverage: 0.71, status: 'placeholder', pillars: { A: 50, B: 60, C: 48, D: 44, E: 46 } },
    { rank: 13, country: 'Belgium',      iso: 'BEL', flag: '🇧🇪', program: 'Single Permit (High Skilled)',             category: 'Skilled Worker',       composite: 50.7, paq: 51.6, cme: 48.5, coverage: 0.72, status: 'scored', pillars: { A: 54, B: 50, C: 58, D: 48, E: 48 } },
    { rank: 14, country: 'Austria',      iso: 'AUT', flag: '🇦🇹', program: 'Red-White-Red Card (Skilled)',             category: 'Points-Based',          composite: 49.8, paq: 50.4, cme: 48.5, coverage: 0.69, status: 'scored', pillars: { A: 60, B: 46, C: 52, D: 48, E: 45 } },
    { rank: 15, country: 'New Zealand',  iso: 'NZL', flag: '🇳🇿', program: 'Skilled Migrant Category Resident',        category: 'Points-Based',          composite: 48.5, paq: 56.2, cme: 30.0, coverage: 0.66, status: 'scored', pillars: { A: 64, B: 52, C: 58, D: 60, E: 47 } },
    { rank: 16, country: 'Japan',        iso: 'JPN', flag: '🇯🇵', program: 'Highly Skilled Professional (HSP) Type 1', category: 'Tech Talent',           composite: 47.9, paq: 53.0, cme: 36.0, coverage: 0.68, status: 'scored', pillars: { A: 58, B: 54, C: 50, D: 52, E: 50 } },
    { rank: 17, country: 'France',       iso: 'FRA', flag: '🇫🇷', program: 'Talent Passport',                           category: 'Talent Visa',           composite: 46.7, paq: 53.4, cme: 31.0, coverage: 0.71, status: 'scored', pillars: { A: 56, B: 50, C: 56, D: 50, E: 54 } },
    { rank: 18, country: 'United Arab Emirates', iso: 'ARE', flag: '🇦🇪', program: 'Golden Visa (Skilled)',             category: 'Talent Visa',           composite: 45.9, paq: 51.8, cme: 32.3, coverage: 0.55, status: 'placeholder', pillars: { A: 60, B: 60, C: 50, D: 38, E: 50 } },
    { rank: 19, country: 'Estonia',      iso: 'EST', flag: '🇪🇪', program: 'Top Specialist Visa',                      category: 'Tech Talent',           composite: 44.8, paq: 52.1, cme: 27.5, coverage: 0.74, status: 'scored', pillars: { A: 58, B: 60, C: 50, D: 44, E: 48 } },
    { rank: 20, country: 'Norway',       iso: 'NOR', flag: '🇳🇴', program: 'Skilled Worker Residence Permit',          category: 'Skilled Worker',       composite: 44.0, paq: 47.5, cme: 35.5, coverage: 0.68, status: 'scored', pillars: { A: 50, B: 46, C: 54, D: 46, E: 41 } },
    { rank: 21, country: 'United States', iso: 'USA', flag: '🇺🇸', program: 'O-1A Extraordinary Ability',              category: 'Talent Visa',           composite: 43.6, paq: 53.0, cme: 21.0, coverage: 0.81, status: 'scored', pillars: { A: 60, B: 54, C: 50, D: 48, E: 56 } },
    { rank: 22, country: 'Finland',      iso: 'FIN', flag: '🇫🇮', program: 'Specialist Residence Permit',              category: 'Skilled Worker',       composite: 42.4, paq: 47.0, cme: 31.0, coverage: 0.70, status: 'scored', pillars: { A: 50, B: 48, C: 54, D: 44, E: 40 } },
    { rank: 23, country: 'Iceland',      iso: 'ISL', flag: '🇮🇸', program: 'Specialist Knowledge Permit',              category: 'Skilled Worker',       composite: 41.7, paq: 41.4, cme: 42.5, coverage: 0.62, status: 'placeholder', pillars: { A: 44, B: 40, C: 48, D: 38, E: 38 } },
  ],
};

// Simple components

function ScoreBar({ value, max = 100, color = 'var(--ink)', height = 4 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="score-bar" style={{ height }}>
      <span style={{ width: `${pct}%`, background: color }}></span>
    </div>
  );
}

function ScoreNumber({ value, large = false, currency }) {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--ink-5)', fontFamily: 'var(--mono)', fontWeight: 500 }}>—</span>;
  }
  const formatted = typeof value === 'number' ? value.toFixed(1) : value;
  return (
    <span className={large ? 'num-l' : 'num'} style={{ fontSize: large ? 36 : undefined }}>
      {currency && <span style={{ color: 'var(--ink-4)', fontWeight: 400, fontSize: '0.7em', marginRight: 2 }}>{currency}</span>}
      {formatted}
    </span>
  );
}

function Chip({ children, variant = 'default' }) {
  const cls = {
    default: 'chip',
    amber: 'chip chip-amber',
    accent: 'chip chip-accent',
    mute: 'chip chip-mute',
    ink: 'chip chip-ink',
  }[variant] || 'chip';
  return <span className={cls}>{children}</span>;
}

function Eyebrow({ children, style }) {
  return <div className="eyebrow" style={style}>{children}</div>;
}

function PillarMini({ pillars, height = 22 }) {
  // Mini bar chart of A/B/C/D/E pillars, 5px wide each
  const keys = ['A', 'B', 'C', 'D', 'E'];
  const colors = ['var(--pillar-a)', 'var(--pillar-b)', 'var(--pillar-c)', 'var(--pillar-d)', 'var(--pillar-e)'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {keys.map((k, i) => {
        const v = pillars[k] || 0;
        return (
          <div key={k} style={{
            width: 6,
            height: `${Math.max(2, (v / 100) * height)}px`,
            background: colors[i],
            opacity: 0.85,
          }} title={`Pillar ${k}: ${v}`}></div>
        );
      })}
    </div>
  );
}

function CountryFlag({ iso, name }) {
  // Use SVG-based country code box for a sober institutional feel (no emoji flags in UI)
  return (
    <div style={{
      width: 22, height: 16,
      background: 'var(--paper-3)',
      border: '1px solid var(--rule)',
      fontFamily: 'var(--mono)',
      fontSize: 9,
      fontWeight: 600,
      color: 'var(--ink-3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      letterSpacing: 0.5,
    }}>
      {iso}
    </div>
  );
}

function Logo({ size = 'md' }) {
  const fs = size === 'lg' ? 22 : size === 'sm' ? 14 : 17;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--serif)',
        fontWeight: 500,
        fontSize: fs,
        letterSpacing: '-0.02em',
        color: 'var(--ink)',
      }}>
        GTMI
      </span>
      {size !== 'sm' && <span style={{
        fontFamily: 'var(--sans)',
        fontSize: 11,
        color: 'var(--ink-4)',
        letterSpacing: '0.02em',
      }}>
        Global Talent Mobility Index
      </span>}
    </div>
  );
}

function TopNav({ active = 'rankings' }) {
  const items = [
    { id: 'rankings', label: 'Rankings' },
    { id: 'programs', label: 'Programmes' },
    { id: 'countries', label: 'Countries' },
    { id: 'methodology', label: 'Methodology' },
    { id: 'about', label: 'About' },
  ];
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 64,
      padding: '0 32px',
      borderBottom: '1px solid var(--rule)',
      background: 'var(--paper)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Logo />
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        {items.map(it => (
          <a key={it.id} href="#" style={{
            fontFamily: 'var(--sans)',
            fontSize: 13,
            color: it.id === active ? 'var(--ink)' : 'var(--ink-4)',
            fontWeight: it.id === active ? 600 : 400,
            textDecoration: 'none',
            position: 'relative',
            paddingBottom: 4,
            borderBottom: it.id === active ? '2px solid var(--ink)' : '2px solid transparent',
          }}>{it.label}</a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      </div>
    </nav>
  );
}

function PreviewBanner() {
  return (
    <div style={{
      padding: '10px 32px',
      background: '#FBF3DC',
      borderBottom: '1px solid #E0C896',
      fontSize: 12,
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <strong style={{ fontWeight: 600 }}>Preview release.</strong>
        {' '}Composite scores are computed with engineer-chosen normalization ranges and are flagged
        <span style={{ margin: '0 6px' }}><Chip variant="amber">Pre-calibration</Chip></span>
        per programme. Calibrated scores ship in Phase 5 (5-country pilot). <a href="#" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>Read the note</a>.
      </div>
      <button style={{ background: 'none', border: 0, fontSize: 16, cursor: 'pointer', color: 'var(--ink-3)' }}>×</button>
    </div>
  );
}

Object.assign(window, {
  GTMI_DATA, ScoreBar, ScoreNumber, Chip, Eyebrow, PillarMini, CountryFlag, Logo, TopNav, PreviewBanner,
  Sparkline, SpecimenPlate, SectionPlate, MarginNote,
});

// ---------- Sparkline — 12-month score history ----------
function Sparkline({ values = [], width = 64, height = 18, color = 'var(--ink-3)', highlight = 'var(--accent)' }) {
  if (!values.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => [i * stepX, height - 2 - ((v - min) / range) * (height - 4)]);
  const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const trendUp = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />
      <circle cx={first[0]} cy={first[1]} r="1.4" fill={color} opacity="0.4" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={trendUp ? 'var(--positive)' : highlight} />
    </svg>
  );
}

// ---------- Specimen Plate — full-bleed editorial artefact between sections ----------
function SpecimenPlate({ plateNo, title, caption, tone = 'paper-2', children, height = 380 }) {
  const bg = tone === 'ink' ? 'var(--ink)'
    : tone === 'navy' ? 'var(--navy)'
    : tone === 'paper-3' ? 'var(--paper-3)'
    : 'var(--paper-2)';
  const fg = (tone === 'ink' || tone === 'navy') ? 'var(--paper)' : 'var(--ink)';
  const fgMute = (tone === 'ink' || tone === 'navy') ? 'rgba(247,244,237,0.55)' : 'var(--ink-4)';
  return (
    <section style={{ background: bg, color: fg, padding: '64px 48px', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '0.9fr 1.4fr', gap: 64, alignItems: 'center', minHeight: height }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: fgMute, marginBottom: 16 }}>
            Plate {plateNo} · Specimen
          </div>
          <h3 className="serif" style={{ fontSize: 36, fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0, color: fg }}>
            {title}
          </h3>
          {caption && (
            <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: fgMute, maxWidth: 380, fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              {caption}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {children}
        </div>
      </div>
    </section>
  );
}

// ---------- Section Plate — chapter-style title plate between major regions ----------
function SectionPlate({ numeral, title, standfirst, tone = 'ink' }) {
  const bg = tone === 'ink' ? 'var(--ink)' : tone === 'navy' ? 'var(--navy)' : 'var(--paper-3)';
  const fg = (tone === 'ink' || tone === 'navy') ? 'var(--paper)' : 'var(--ink)';
  const fgMute = (tone === 'ink' || tone === 'navy') ? 'rgba(247,244,237,0.6)' : 'var(--ink-4)';
  return (
    <section style={{ background: bg, color: fg, padding: '88px 48px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '120px 1fr', gap: 48, alignItems: 'baseline' }}>
        <div className="num-l" style={{ fontSize: 88, lineHeight: 1, color: 'var(--accent)', fontWeight: 400 }}>
          {numeral}
        </div>
        <div>
          <h2 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0, color: fg, textWrap: 'balance' }}>
            {title}
          </h2>
          {standfirst && (
            <p style={{ marginTop: 20, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18, lineHeight: 1.5, color: fgMute, maxWidth: 720, textWrap: 'pretty' }}>
              {standfirst}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- Margin note — italic Fraunces gutter annotation ----------
function MarginNote({ children, color = 'var(--navy)' }) {
  return (
    <aside style={{
      fontFamily: 'var(--serif)',
      fontStyle: 'italic',
      fontSize: 12,
      lineHeight: 1.5,
      color,
      borderLeft: `2px solid ${color}`,
      paddingLeft: 12,
      maxWidth: 220,
    }}>
      {children}
    </aside>
  );
}
