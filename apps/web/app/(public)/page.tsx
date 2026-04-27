import { Suspense } from 'react';
import Link from 'next/link';
import { RankingsExplorer, MethodologyBar, DataTableNote } from '@/components/gtmi';
import { getRankedPrograms } from '@/lib/queries/ranked-programs';
import { parseRankingsParams } from '@/lib/queries/filters-from-url';
import { loadContent } from '@/lib/content';
import { DEFAULT_PILLAR_WEIGHTS } from '@/lib/advisor-mode';

export const revalidate = 3600;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, sort } = parseRankingsParams(sp);
  const [result, previewBannerHtml] = await Promise.all([
    getRankedPrograms({ filters, sort, limit: 100 }),
    loadContent('preview-banner.md'),
  ]);

  return (
    <>
      <section className="mx-auto max-w-page px-6 pt-12">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          Preview release
        </p>
        <h1 className="mt-2 font-serif text-display-xl text-ink">
          Global Talent Mobility Index 2026
        </h1>
        <p className="mt-6 max-w-editorial text-dek text-muted-foreground">
          GTMI ranks {result.totalCount} talent-based mobility programmes across the world&rsquo;s
          30 most appealing economies, using a methodology where every weight is published and every
          data point traces to its government source.
        </p>
        <p className="mt-4 text-data-sm text-muted-foreground">
          <span className="font-mono tnum text-foreground">{result.scoredCount}</span> of{' '}
          <span className="font-mono tnum">{result.totalCount}</span> programmes scored (Phase 2
          preview).{' '}
          <Link href="/methodology" className="text-accent underline-offset-4 hover:underline">
            Methodology
          </Link>
          .
        </p>
      </section>

      {previewBannerHtml && (
        <section className="mx-auto mt-8 max-w-page px-6">
          <div
            role="note"
            className="rounded-card border-l-2 border-precalib-fg bg-precalib-bg/50 px-4 py-3 text-data-md text-foreground"
            dangerouslySetInnerHTML={{ __html: previewBannerHtml }}
          />
        </section>
      )}

      <section className="mx-auto mt-10 max-w-page px-6">
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
      </section>

      <section className="mx-auto mt-12 max-w-page px-6">
        <DataTableNote>
          Composite = 30% CME + 70% PAQ. CME re-normalises IMD&rsquo;s Appeal factor across our
          30-country cohort. PAQ is GTMI&rsquo;s 48-indicator program-architecture score across five
          pillars: Access, Process, Rights, Pathway, Stability.
        </DataTableNote>

        <div className="mt-6">
          <MethodologyBar
            cmePaqSplit={{ cme: 0.3, paq: 0.7 }}
            pillarWeights={DEFAULT_PILLAR_WEIGHTS}
          />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-page px-6 pb-24">
        <p className="text-data-md text-muted-foreground">
          For the full indicator list and weights, see{' '}
          <Link href="/methodology" className="text-accent underline-offset-4 hover:underline">
            the methodology page
          </Link>
          .
        </p>
      </section>
    </>
  );
}
