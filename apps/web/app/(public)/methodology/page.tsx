import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  SplitSpecimen,
  PillarsSpecimen,
  WeightTree,
  FalsifiabilityCommitments,
  EmptyState,
  DataTableNote,
  PreviewBanner,
} from '@/components/gtmi';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import { getMethodologyCurrent } from '@/lib/queries/methodology-current';
import { getCohortStats } from '@/lib/queries/cohort-stats';
import { loadContent } from '@/lib/content';
import type { MethodologyPillar } from '@/lib/queries/methodology-current-types';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'Every weight, every indicator, every normalisation choice — read live from the GTMI methodology version table.',
};

// Runtime render — DATABASE_URL is runtime-only in Cloud Run.
// unstable_cache inside the queries handles cross-request caching.
export const dynamic = 'force-dynamic';

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

function pillarWeightsFromMethodology(pillars: MethodologyPillar[]): Record<PillarKey, number> {
  return Object.fromEntries(pillars.map((p) => [p.key, p.weightWithinPaq])) as Record<
    PillarKey,
    number
  >;
}

function formatRefreshDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

export default async function MethodologyPage() {
  const [methodology, stats, previewBannerHtml] = await Promise.all([
    getMethodologyCurrent(),
    getCohortStats(),
    loadContent('preview-banner.md'),
  ]);
  if (!methodology) notFound();

  const pillarWeights = pillarWeightsFromMethodology(methodology.pillars);
  const totalIndicators = methodology.pillars.reduce((s, p) => s + p.indicatorCount, 0);
  const totalSubFactors = methodology.pillars.reduce((s, p) => s + p.subFactors.length, 0);

  const [
    introHtml,
    normalizationHtml,
    dataIntegrityHtml,
    sensitivityHtml,
    notMeasuredHtml,
    pillarAHtml,
    pillarBHtml,
    pillarCHtml,
    pillarDHtml,
    pillarEHtml,
  ] = await Promise.all([
    loadContent('methodology/intro.md'),
    loadContent('methodology/normalization.md'),
    loadContent('methodology/data-integrity.md'),
    loadContent('methodology/sensitivity.md'),
    loadContent('methodology/whatGTMIMeasuresNot.md'),
    loadContent('pillars/A.md'),
    loadContent('pillars/B.md'),
    loadContent('pillars/C.md'),
    loadContent('pillars/D.md'),
    loadContent('pillars/E.md'),
  ]);

  const pillarRationale: Record<PillarKey, string> = {
    A: pillarAHtml,
    B: pillarBHtml,
    C: pillarCHtml,
    D: pillarDHtml,
    E: pillarEHtml,
  };

  const refreshDate = formatRefreshDate(stats.lastVerifiedAt);

  return (
    <>
      <PreviewBanner bodyHtml={previewBannerHtml || null} />

      {/* Hero */}
      <section
        className="paper-grain border-b px-12 pb-12 pt-16"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
        data-testid="methodology-hero"
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-6">Methodology · v{methodology.versionTag}</p>
          <div className="grid items-end gap-16 md:grid-cols-[1.4fr_1fr]">
            <h1
              className="serif text-ink"
              style={{
                fontSize: 64,
                fontWeight: 400,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              How the index is constructed, defended, and made{' '}
              <em
                style={{ color: 'var(--accent)', fontStyle: 'italic' }}
                data-testid="methodology-falsifiable"
              >
                falsifiable
              </em>
              .
            </h1>
            <p className="text-ink-3" style={{ fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              The GTMI methodology is a public artefact. Every weight, every normalization rule, and
              every scoring branch is rendered from the same source-of-truth that powers the
              rankings. Change the spec, change the page.
            </p>
          </div>

          {/* Live-computed stats strip — same query as the landing page (Phase 4-B). */}
          <div
            className="mt-12 grid grid-cols-1 gap-px border md:grid-cols-5"
            style={{ background: 'var(--rule)', borderColor: 'var(--rule)' }}
            data-testid="methodology-stats-strip"
          >
            <StatCell label="Pillars" value={String(methodology.pillars.length)} />
            <StatCell label="Sub-factors" value={String(totalSubFactors)} />
            <StatCell label="Indicators" value={String(totalIndicators)} />
            <StatCell label="Programmes scored" value={String(stats.programmesActive)} />
            <StatCell label="Last updated" value={refreshDate} />
          </div>
        </div>
      </section>

      {/* 30/70 split with live methodology weights */}
      <section
        className="border-b px-12 py-16"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
        data-testid="methodology-split"
      >
        <div className="mx-auto max-w-page grid items-center gap-16 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="eyebrow mb-4">The 30 / 70 split</p>
            <h2
              className="serif"
              style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              PAQ is weighted higher than CME because programme architecture is more falsifiable,
              less noisy, and harder to game than outcomes data.
            </h2>
            <p className="mt-4 text-ink-3" style={{ fontSize: 15, lineHeight: 1.6 }}>
              CME measures comparative outcomes — wage uplift, route-to-PR, cost-to-applicant. PAQ
              measures programme architecture — predictability, transparency, fairness, family
              rights, recourse.
            </p>
          </div>
          <div className="flex justify-center pl-12 pt-6">
            <SplitSpecimen cmePaqSplit={methodology.cmePaqSplit} />
          </div>
        </div>
      </section>

      {/* Pillar specimen */}
      <section
        className="border-b px-12 py-16"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
        data-testid="methodology-pillars-specimen"
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">The five pillars</p>
          <h2
            className="serif"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Five pillars · {totalIndicators} indicators · {totalSubFactors} sub-factors.
          </h2>
          <p className="mt-3 max-w-[720px] text-ink-3">
            Pillar weights are fixed in the methodology version table and drive both this page and
            the production scoring engine.
          </p>
          <div className="mt-8 flex justify-start">
            <PillarsSpecimen pillarWeights={pillarWeights} />
          </div>
        </div>
      </section>

      {/* Weight tree — the new Phase D centrepiece */}
      <section
        className="border-b px-12 py-16"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
        data-testid="methodology-weight-tree-section"
      >
        <div className="mx-auto max-w-page">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2
              className="serif"
              style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              Weight tree
            </h2>
            <p className="num text-data-sm text-ink-4">
              Auto-rendered from{' '}
              <code
                className="border px-1.5 py-0.5"
                style={{
                  background: 'var(--paper-3)',
                  borderColor: 'var(--rule)',
                  fontSize: 11,
                }}
              >
                methodology_versions
              </code>{' '}
              +{' '}
              <code
                className="border px-1.5 py-0.5"
                style={{
                  background: 'var(--paper-3)',
                  borderColor: 'var(--rule)',
                  fontSize: 11,
                }}
              >
                field_definitions
              </code>
            </p>
          </div>
          <p className="max-w-[720px] text-ink-3">
            This visualization and the live scoring engine read the same tables. Every weight you
            see below propagates straight into how composite scores are computed.
          </p>
          <div className="mt-8 border bg-paper p-6" style={{ borderColor: 'var(--rule)' }}>
            <WeightTree cmePaqSplit={methodology.cmePaqSplit} pillars={methodology.pillars} />
          </div>
        </div>
      </section>

      {/* Per-pillar rationale + sub-factor list */}
      <section
        className="border-b px-12 py-16"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
        data-testid="methodology-pillar-rationale"
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Pillar rationale</p>
          <h2
            className="serif"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            What each pillar measures, and why.
          </h2>
          <div className="mt-10 flex flex-col gap-12">
            {methodology.pillars.map((pillar) => (
              <PillarRationaleBlock
                key={pillar.key}
                pillar={pillar}
                rationaleHtml={pillarRationale[pillar.key]}
              />
            ))}
          </div>
        </div>
      </section>

      <FalsifiabilityCommitments />

      {/* Sensitivity placeholder */}
      <section className="border-t px-12 py-16" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Sensitivity analyses</p>
          <h2
            className="serif"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Six sensitivity runs ship with the Phase 5 calibration.
          </h2>
          <div className="mt-6">
            {sensitivityHtml ? (
              <Prose html={sensitivityHtml} />
            ) : (
              <EmptyState
                title="Sensitivity analyses ship in Phase 5"
                body="Weight Monte Carlo, normalization, aggregation, CME/PAQ split, dropout, and correlation runs all activate once the 5-country pilot is calibrated."
                ctaHref="/about"
                ctaLabel="See the build plan"
              />
            )}
          </div>
        </div>
      </section>

      {/* Normalization + data integrity + what GTMI does not measure */}
      <section className="border-t px-12 py-16" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto grid max-w-page gap-12 md:grid-cols-3">
          <ProseBlock title="Normalization" eyebrow="04" html={normalizationHtml} />
          <ProseBlock title="Data integrity" eyebrow="05" html={dataIntegrityHtml} />
          <ProseBlock title="What GTMI does not measure" eyebrow="06" html={notMeasuredHtml} />
        </div>
      </section>

      {/* What GTMI measures intro (long-form) */}
      {introHtml && (
        <section
          className="border-t px-12 py-16"
          style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
        >
          <div className="mx-auto max-w-page grid items-start gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow mb-3">What GTMI measures</p>
              <h2
                className="serif"
                style={{
                  fontSize: 32,
                  fontWeight: 400,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                The thesis behind the index.
              </h2>
            </div>
            <Prose html={introHtml} />
          </div>
        </section>
      )}

      {/* Methodology version history */}
      <section className="border-t px-12 py-16" style={{ borderColor: 'var(--rule)' }}>
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Versions</p>
          <h2
            className="serif"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Methodology change log.
          </h2>
          {methodology.history.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="No version history"
              body="The methodology version table is empty."
            />
          ) : (
            <ul
              className="mt-6 flex flex-col divide-y border bg-paper-2"
              style={{ borderColor: 'var(--rule)' }}
            >
              {methodology.history.map((v) => (
                <li
                  key={v.versionTag}
                  className="flex flex-col gap-1 px-4 py-3"
                  data-testid={`methodology-version-${v.versionTag}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="num font-semibold" style={{ fontSize: 14 }}>
                      v{v.versionTag}
                    </span>
                    <span className="num text-data-sm text-ink-4">
                      {v.publishedAt ? v.publishedAt.slice(0, 10) : 'unpublished'}
                    </span>
                  </div>
                  {v.changeNotes && (
                    <p
                      className="max-w-prose text-data-sm text-ink-3"
                      style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
                    >
                      {v.changeNotes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="px-12 py-12" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto max-w-page">
          <DataTableNote>
            Every weight on this page is read live from{' '}
            <code className="num">methodology_versions</code> and{' '}
            <code className="num">field_definitions</code>. Scores carried by every programme row
            are stamped with their methodology_version_id so a re-run of the scoring engine against
            the same row produces byte-identical output.
          </DataTableNote>
        </div>
      </section>
    </>
  );

  function StatCell({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ background: 'var(--paper)', padding: 20 }}>
        <p className="eyebrow" style={{ fontSize: 10 }}>
          {label}
        </p>
        <p className="num-l mt-1" style={{ fontSize: 32 }}>
          {value}
        </p>
      </div>
    );
  }

  function PillarRationaleBlock({
    pillar,
    rationaleHtml,
  }: {
    pillar: MethodologyPillar;
    rationaleHtml: string;
  }) {
    return (
      <article
        className="grid items-start gap-8 md:grid-cols-[200px_1fr]"
        data-testid={`methodology-pillar-${pillar.key}`}
      >
        <div>
          <span
            className="serif"
            style={{
              fontSize: 56,
              fontWeight: 400,
              color: PILLAR_COLORS[pillar.key],
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}
          >
            {pillar.key}
          </span>
          <p
            className="serif mt-2"
            style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            {PILLAR_LABEL[pillar.key]}
          </p>
          <p className="num mt-3 text-data-sm text-ink-4">
            {Math.round(pillar.weightWithinPaq * 100)}% of PAQ · {pillar.indicatorCount} indicator
            {pillar.indicatorCount === 1 ? '' : 's'}
          </p>
        </div>
        <div>
          {rationaleHtml ? (
            <Prose html={rationaleHtml} />
          ) : (
            <p className="italic text-ink-4">Rationale forthcoming.</p>
          )}
          {pillar.subFactors.length > 0 && (
            <ul
              className="mt-6 grid grid-cols-1 gap-2 border-t pt-4 md:grid-cols-2"
              style={{ borderColor: 'var(--rule)' }}
            >
              {pillar.subFactors.map((sf) => (
                <li
                  key={sf.code}
                  className="flex items-baseline gap-3"
                  data-testid={`methodology-subfactor-${sf.code}`}
                >
                  <span className="num text-data-sm" style={{ color: PILLAR_COLORS[pillar.key] }}>
                    {sf.code}
                  </span>
                  <span className="text-data-md text-ink-2">
                    {sf.indicators.length} indicator{sf.indicators.length === 1 ? '' : 's'}
                  </span>
                  <span className="flex-1" />
                  <span className="num text-data-sm text-ink-4">
                    {Math.round(sf.weightWithinPillar * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    );
  }
}

function ProseBlock({ title, eyebrow, html }: { title: string; eyebrow: string; html: string }) {
  return (
    <section>
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
        {title}
      </h3>
      <div className="mt-3">
        {html ? <Prose html={html} /> : <p className="italic text-ink-4">Content forthcoming.</p>}
      </div>
    </section>
  );
}

function Prose({ html }: { html: string }) {
  if (!html.trim()) {
    return <p className="italic text-ink-4">Content forthcoming.</p>;
  }
  return (
    <div
      className="prose prose-neutral max-w-prose text-ink-2"
      style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
