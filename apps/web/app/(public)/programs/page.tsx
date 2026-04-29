import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { RankingsExplorer, DataTableNote, PreviewBanner } from '@/components/gtmi';
import { getRankedPrograms } from '@/lib/queries/ranked-programs';
import { parseRankingsParams } from '@/lib/queries/filters-from-url';
import { loadContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Programmes',
  description:
    'Browse every talent-mobility programme scored by GTMI — full editorial layout with provenance on every row.',
};

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

  const [result, previewBannerHtml] = await Promise.all([
    getRankedPrograms({ filters, sort, limit: PAGE_SIZE, offset }),
    loadContent('preview-banner.md'),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  return (
    <>
      <PreviewBanner bodyHtml={previewBannerHtml || null} />

      <header
        className="paper-grain border-b px-12 pb-10 pt-14"
        style={{ borderColor: 'var(--rule)' }}
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Programmes</p>
          <h1
            className="serif text-ink"
            style={{
              fontSize: 56,
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
            }}
          >
            All programmes.
          </h1>
          <p className="mt-4 max-w-[640px] text-ink-3" style={{ fontSize: 16, lineHeight: 1.55 }}>
            <span className="num text-ink">{result.totalCount}</span> talent-mobility programmes
            across the cohort. Filter by category up top; expand &ldquo;More filters&rdquo; for
            country, region, score range, and free-text search. Reweight pillars in advisor mode.
          </p>
        </div>
      </header>

      <section className="px-12 py-12">
        <div className="mx-auto max-w-page">
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

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-between text-data-sm"
            >
              <span className="text-ink-4">
                Page <span className="num text-ink">{page}</span> of{' '}
                <span className="num">{totalPages}</span>
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

          <div className="mt-10">
            <DataTableNote>
              Composite = 30% CME + 70% PAQ across 48 indicators. Trend sparklines render a
              deterministic 12-month walk seeded by programme id and current composite — a stable
              placeholder until Phase 5/6 produces enough scoring history for real plotting.
            </DataTableNote>
          </div>
        </div>
      </section>
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
