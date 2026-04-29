import { Suspense } from 'react';
import Link from 'next/link';
import {
  RankingsExplorer,
  PreviewBanner,
  HeroLanding,
  ThisEdition,
  WorldMap,
  SpecimenPlate,
  PillarsSpecimen,
  EditorsQuote,
  ProvenanceProof,
  DataTableNote,
  type WorldMapCountryScore,
} from '@/components/gtmi';
import { getRankedPrograms } from '@/lib/queries/ranked-programs';
import { parseRankingsParams } from '@/lib/queries/filters-from-url';
import { getCohortStats } from '@/lib/queries/cohort-stats';
import { getMethodologyCurrent } from '@/lib/queries/methodology-current';
import { getPolicyChanges } from '@/lib/queries/policy-changes';
import { loadContent } from '@/lib/content';
import type { RankedProgramRow } from '@/lib/queries/types';
import type { PillarKey } from '@/lib/theme';

// See / page header comment from Phase 4 — runtime render, not build prerender.
// The query layer wraps every DB call in `unstable_cache` so this still
// amortises across requests.
export const dynamic = 'force-dynamic';

/** Pillar weights from the live methodology version (PillarsSpecimen). */
function pillarWeightsFromMethodology(
  pillars: { key: PillarKey; weightWithinPaq: number }[]
): Record<PillarKey, number> {
  return Object.fromEntries(pillars.map((p) => [p.key, p.weightWithinPaq])) as Record<
    PillarKey,
    number
  >;
}

/** Top-scoring composite per country, for the WorldMap. */
function leaderCompositesByCountry(rows: RankedProgramRow[]): WorldMapCountryScore[] {
  const best = new Map<string, number>();
  for (const r of rows) {
    if (r.composite === null) continue;
    const prev = best.get(r.countryIso);
    if (prev === undefined || r.composite > prev) best.set(r.countryIso, r.composite);
  }
  return Array.from(best.entries()).map(([iso, composite]) => ({ iso, composite }));
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, sort } = parseRankingsParams(sp);
  const [result, stats, methodology, policyChanges, previewBannerHtml] = await Promise.all([
    getRankedPrograms({ filters, sort, limit: 100 }),
    getCohortStats(),
    getMethodologyCurrent(),
    getPolicyChanges({}),
    loadContent('preview-banner.md'),
  ]);

  const cmePaqSplit = methodology?.cmePaqSplit ?? { cme: 0.3, paq: 0.7 };
  const pillarWeights = methodology ? pillarWeightsFromMethodology(methodology.pillars) : null;

  const worldMapScores = leaderCompositesByCountry(result.rows);
  const recentChanges = policyChanges.slice(0, 3);

  return (
    <>
      <PreviewBanner bodyHtml={previewBannerHtml || null} />

      <HeroLanding stats={stats} cmePaqSplit={cmePaqSplit} />

      <ThisEdition events={recentChanges} />

      <section
        className="border-b px-12 pt-16"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
      >
        <div className="mx-auto max-w-page">
          <div className="mb-2 flex items-baseline justify-between">
            <h2
              className="serif"
              style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              The world by composite
            </h2>
            <p className="num text-data-sm text-ink-4">
              {stats.programmesActive} active programmes scored across the cohort
            </p>
          </div>
          <p className="mb-8 max-w-[640px] text-ink-3">
            Each dot is a jurisdiction&rsquo;s top-scoring talent visa programme, coloured by
            quintile. Greyed dots mark countries currently out of scope.
          </p>
          <WorldMap scores={worldMapScores} />
          <div className="h-16" />
        </div>
      </section>

      {pillarWeights && (
        <SpecimenPlate
          plateNo="I"
          title="Five pillars. Forty-eight indicators."
          caption="Pillar weights are fixed in the methodology version table and drive both this page and the production scoring engine. There is no separate executive-summary version."
          tone="paper-3"
        >
          <PillarsSpecimen pillarWeights={pillarWeights} />
        </SpecimenPlate>
      )}

      <EditorsQuote />

      <ProvenanceProof />

      <section className="px-12 py-20">
        <div className="mx-auto max-w-page">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className="serif"
              style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              Programme rankings
            </h2>
            <p className="num text-data-sm text-ink-4">
              Showing {result.rows.length} of {result.totalCount} · sort: composite ↓
            </p>
          </div>
          <p className="max-w-[640px] text-ink-3">
            Composite is the {Math.round(cmePaqSplit.paq * 100)} /{' '}
            {Math.round(cmePaqSplit.cme * 100)} weighted blend of PAQ and CME. Click any row for the
            full provenance trail.{' '}
            <Link href="/methodology" className="text-accent underline-offset-4 hover:underline">
              Methodology
            </Link>
            .
          </p>

          <div className="mt-8">
            <Suspense fallback={null}>
              <RankingsExplorer
                rows={result.rows}
                totalCount={result.totalCount}
                scoredCount={result.scoredCount}
                facets={result.facets}
                initialFilters={filters}
                initialSort={sort}
                basePath="/"
              />
            </Suspense>
          </div>

          <div className="mt-10">
            <DataTableNote>
              Composite = {Math.round(cmePaqSplit.cme * 100)}% CME +{' '}
              {Math.round(cmePaqSplit.paq * 100)}% PAQ across {stats.indicatorsTotal} indicators.
              Trend sparklines render a deterministic 12-month walk seeded by programme id and
              current composite — a stable placeholder until Phase 5/6 produces enough scoring
              history for real plotting. End-of-line dot pins to the displayed score.
            </DataTableNote>
          </div>
        </div>
      </section>
    </>
  );
}
