// Phase 3.10c.10 — Methodology whitepaper print-ready route.
//
// Renders the live methodology data in a print-optimised layout so
// the analyst can produce a PDF via the browser's "Save as PDF"
// without depending on a server-side PDF library. Reuses the same
// data path as the public /methodology page.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMethodologyCurrent } from '@/lib/queries/methodology-current';
import type { MethodologyPillar } from '@/lib/queries/methodology-current-types';
import { getCohortStats } from '@/lib/queries/cohort-stats';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GTMI Methodology — Whitepaper',
  description:
    'Print-ready rendering of the live GTMI methodology — pillar weights, sub-factor weights, indicator weights, normalization choices.',
  robots: { index: false, follow: false },
};

export default async function WhitepaperPage() {
  const [methodology, cohort] = await Promise.all([getMethodologyCurrent(), getCohortStats()]);
  if (!methodology) notFound();

  const generatedAt = new Date().toISOString().slice(0, 10);

  return (
    <main className="whitepaper" data-testid="methodology-whitepaper">
      <style>{`
        .whitepaper {
          background: white;
          color: black;
          font-family: 'Inter', sans-serif;
          max-width: 700px;
          margin: 0 auto;
          padding: 24mm;
          line-height: 1.45;
          font-size: 10pt;
        }
        .whitepaper h1 { font-size: 22pt; font-weight: 600; margin: 0 0 8pt; line-height: 1.15; }
        .whitepaper h2 { font-size: 14pt; font-weight: 600; margin: 18pt 0 6pt; }
        .whitepaper h3 { font-size: 11pt; font-weight: 600; margin: 12pt 0 4pt; }
        .whitepaper p  { margin: 0 0 8pt; }
        .whitepaper table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9pt; }
        .whitepaper th, .whitepaper td {
          border: 1px solid #ccc;
          padding: 4pt 6pt;
          text-align: left;
        }
        .whitepaper th { background: #f4f4f4; font-weight: 600; }
        .whitepaper .meta { color: #666; font-size: 8pt; margin-bottom: 24pt; }
        .whitepaper .num { font-variant-numeric: tabular-nums; }
        @media print {
          .whitepaper { padding: 0; max-width: none; }
          .page-break { page-break-before: always; }
          a { color: black; text-decoration: none; }
        }
        @media screen {
          .whitepaper {
            margin-top: 24pt;
            margin-bottom: 24pt;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          }
          .print-hint {
            background: #fffbe5;
            border: 1px solid #d4be4a;
            padding: 8pt 10pt;
            font-size: 9pt;
            margin-bottom: 18pt;
          }
        }
        @media print {
          .print-hint { display: none; }
        }
      `}</style>

      <div className="print-hint">
        Use your browser&apos;s <strong>Print → Save as PDF</strong> (Cmd/Ctrl-P) to export. The
        page is sized for A4 / Letter; URLs and page numbers can be controlled via the print dialog.
      </div>

      <h1>GTMI Methodology — Whitepaper</h1>
      <p className="meta num">
        Methodology version <strong>{methodology.versionTag}</strong>
        {' · '}generated {generatedAt}
        {' · '}cohort: {cohort.programmesActive} active programmes ({cohort.programmesTotal} total)
        · {cohort.indicatorsTotal} indicators · {cohort.sourcesTotal} sources
      </p>

      <p>
        The Global Talent Mobility Index (GTMI) ranks talent-based premium mobility programmes
        across 30 countries. Every published value is sourced from a government document, traceable
        to a specific sentence with a SHA-256 content hash and scrape timestamp. This whitepaper is
        an offline rendering of the live methodology configuration — pillar weights, sub-factor
        weights, indicator weights, normalization functions — as it stands at the generated date
        above.
      </p>

      <h2>Composite structure</h2>
      <p>
        GTMI = <strong>{(methodology.cmePaqSplit.cme * 100).toFixed(0)}%</strong> Country Mobility
        Environment + <strong>{(methodology.cmePaqSplit.paq * 100).toFixed(0)}%</strong> Program
        Architecture Quality.
      </p>
      <p>
        CME is anchored on the IMD World Talent Ranking Appeal sub-index, re-normalized 0–100 within
        the cohort. PAQ is the weighted sum of five pillars.
      </p>

      <h2>Pillar weights</h2>
      <table>
        <thead>
          <tr>
            <th>Pillar</th>
            <th className="num">Indicators</th>
            <th className="num">Weight (% of PAQ)</th>
          </tr>
        </thead>
        <tbody>
          {methodology.pillars.map((p: MethodologyPillar) => (
            <tr key={p.key}>
              <td>{p.key}</td>
              <td className="num">{p.indicatorCount}</td>
              <td className="num">{(p.weightWithinPaq * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Sub-factor weights</h2>
      {methodology.pillars.map((p: MethodologyPillar) => (
        <div key={p.key}>
          <h3>Pillar {p.key}</h3>
          <table>
            <thead>
              <tr>
                <th>Sub-factor</th>
                <th className="num">Indicators</th>
                <th className="num">Weight (% of pillar)</th>
              </tr>
            </thead>
            <tbody>
              {p.subFactors.map((s) => (
                <tr key={s.code}>
                  <td>{s.code}</td>
                  <td className="num">{s.indicators.length}</td>
                  <td className="num">{(s.weightWithinPillar * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="page-break" />

      <h2>Indicators</h2>
      {methodology.pillars.map((p: MethodologyPillar) => (
        <div key={p.key}>
          <h3>Pillar {p.key}</h3>
          {p.subFactors.map((s) => (
            <table key={s.code}>
              <thead>
                <tr>
                  <th colSpan={4}>Sub-factor {s.code}</th>
                </tr>
                <tr>
                  <th>Key</th>
                  <th>Indicator</th>
                  <th>Normalization</th>
                  <th className="num">Weight</th>
                </tr>
              </thead>
              <tbody>
                {s.indicators.map((ind) => (
                  <tr key={ind.key}>
                    <td className="num">{ind.key}</td>
                    <td>{ind.label}</td>
                    <td>{ind.normalizationFn}</td>
                    <td className="num">{(ind.weightWithinSubFactor * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ))}

      <div className="page-break" />

      <h2>Reproducibility</h2>
      <p>
        This document is generated from <code>field_definitions</code>,{' '}
        <code>methodology_versions</code>, and <code>scores</code> at render time. Pillar weights
        sum to 1.0; sub-factor weights sum to 1.0 within each pillar; indicator weights sum to 1.0
        within each sub-factor. The composite is a weighted arithmetic mean across the hierarchy
        with the published CME / PAQ split.
      </p>
      <p>
        Source URL hashes for every published value are visible in the dashboard&apos;s Provenance
        drawer (per indicator). Sensitivity analyses run against the cohort using the methodology
        pin recorded above.
      </p>

      <h2>Document version</h2>
      <p className="meta num">
        Whitepaper render: {generatedAt}
        {' · '}methodology pin: {methodology.versionTag}
        {' · '}generated by gtmi-web /methodology/whitepaper.
      </p>
    </main>
  );
}
