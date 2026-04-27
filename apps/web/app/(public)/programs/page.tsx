import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { RankingsExplorer } from '@/components/gtmi';
import { getRankedPrograms } from '@/lib/queries/ranked-programs';
import { parseRankingsParams } from '@/lib/queries/filters-from-url';

export const metadata: Metadata = {
  title: 'Programs',
  description:
    'Browse all 85 talent-based mobility programmes across the IMD World Talent Ranking Top 30 economies.',
};

// See / page header comment — runtime render, not build prerender.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function ProgramsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, sort } = parseRankingsParams(sp);
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await getRankedPrograms({
    filters,
    sort,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  return (
    <>
      <section className="mx-auto max-w-page px-6 pt-12">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">Programs</p>
        <h1 className="mt-2 font-serif text-display-lg text-ink">All programmes</h1>
        <p className="mt-4 max-w-editorial text-dek text-muted-foreground">
          {result.totalCount} talent-based mobility programmes across the IMD World Talent Ranking
          Top 30. Filter by country, region, category, or score range; search by name; reweight
          pillars in advisor mode.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-page px-6">
        <Suspense fallback={null}>
          <RankingsExplorer
            rows={result.rows}
            totalCount={result.totalCount}
            scoredCount={result.scoredCount}
            facets={result.facets}
            initialFilters={filters}
            initialSort={sort}
            basePath="/programs"
          />
        </Suspense>
      </section>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mx-auto mt-8 flex max-w-page items-center justify-between px-6 text-data-sm"
        >
          <span className="text-muted-foreground">
            Page <span className="font-mono tnum text-foreground">{page}</span> of{' '}
            <span className="font-mono tnum">{totalPages}</span>
          </span>
          <div className="flex items-center gap-3">
            {page > 1 && (
              <Link
                href={pageHref(sp, page - 1)}
                className="text-accent underline-offset-4 hover:underline"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(sp, page + 1)}
                className="text-accent underline-offset-4 hover:underline"
              >
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}

      <div className="pb-16" />
    </>
  );
}

function pageHref(current: Record<string, string | string[] | undefined>, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (k === 'page') continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== '') sp.set(k, value);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `/programs?${qs}` : '/programs';
}
