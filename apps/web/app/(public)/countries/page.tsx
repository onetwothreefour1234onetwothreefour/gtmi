import type { Metadata } from 'next';
import { CountriesGrid, DataTableNote, PreviewBanner } from '@/components/gtmi';
import { getAllCountries } from '@/lib/queries/all-countries';
import { loadContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Countries',
  description:
    'The 30-country GTMI cohort — composite, CME, programme counts, and the top-scored programme per country.',
};

// Render on request — DATABASE_URL is a Cloud Run runtime secret. The
// `unstable_cache` wrapper inside `getAllCountries` (1h TTL) handles
// cross-request caching.
export const dynamic = 'force-dynamic';

export default async function CountriesIndexPage() {
  const [rows, previewBannerHtml] = await Promise.all([
    getAllCountries(),
    loadContent('preview-banner.md'),
  ]);

  const scoredCount = rows.filter((r) => r.scoredProgrammeCount > 0).length;

  return (
    <>
      <PreviewBanner bodyHtml={previewBannerHtml || null} />

      <header
        className="paper-grain border-b px-12 pb-10 pt-14"
        style={{ borderColor: 'var(--rule)' }}
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Countries</p>
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
            All countries.
          </h1>
          <p className="mt-4 max-w-[640px] text-ink-3" style={{ fontSize: 16, lineHeight: 1.55 }}>
            <span className="num text-ink">{rows.length}</span> countries in the cohort —{' '}
            <span className="num text-ink">{scoredCount}</span> with at least one PAQ-scored
            programme. Composite is 30% CME (Country Mobility Environment, IMD-derived) + 70% PAQ
            (Programme Architecture Quality). Click a card for the country&rsquo;s programme detail.
          </p>
        </div>
      </header>

      <section className="px-12 py-12">
        <div className="mx-auto max-w-page">
          <CountriesGrid rows={rows} />

          <div className="mt-10">
            <DataTableNote>
              Sort: highest CME score first; cohort countries without a CME score appear at the
              bottom alphabetically. CME numbers carry the PRE-CAL marker until Phase 5 calibration
              completes against the full cohort.
            </DataTableNote>
          </div>
        </div>
      </section>
    </>
  );
}
