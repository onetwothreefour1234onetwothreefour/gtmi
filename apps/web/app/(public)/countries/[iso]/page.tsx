import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CountryHeader,
  CountryProgramsTable,
  CountryRadar,
  TaxTreatmentCard,
  EmptyState,
  DataTableNote,
  PreviewBanner,
  JsonLd,
  type CountryRadarProgram,
} from '@/components/gtmi';
import { absoluteUrl, SITE_URL } from '@/lib/site-url';
import { getCountryDetail } from '@/lib/queries/country-detail';
import { formatRelativeDate } from '@/lib/format';
import { loadContent } from '@/lib/content';
import type { CountryProgramRow } from '@/lib/queries/country-detail-types';
import type { PillarKey } from '@/lib/theme';

interface PageProps {
  params: Promise<{ iso: string }>;
}

// Render on request — DATABASE_URL is a Cloud Run runtime secret. The
// `unstable_cache` wrapper inside getCountryDetail handles cross-request
// caching (1h TTL).
export const dynamic = 'force-dynamic';

const STABILITY_FLAG = process.env.NEXT_PUBLIC_STABILITY_ENABLED === 'true';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { iso } = await params;
  const detail = await getCountryDetail(iso);
  if (!detail) return { title: 'Country not found' };
  const canonical = absoluteUrl(`/countries/${detail.header.iso}`);
  const title = detail.header.name;
  const description = `${detail.programs.length} talent-mobility programmes scored for ${detail.header.name} on GTMI — the Global Talent Mobility Index.`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'article', url: canonical, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function leaderProgramme(programs: CountryProgramRow[]): CountryProgramRow | null {
  for (const p of programs) {
    if (p.composite !== null) return p;
  }
  return null;
}

function averageComposite(programs: CountryProgramRow[]): number | null {
  const scored = programs.filter((p) => p.composite !== null) as (CountryProgramRow & {
    composite: number;
  })[];
  if (scored.length === 0) return null;
  const sum = scored.reduce((s, p) => s + p.composite, 0);
  return sum / scored.length;
}

function averageCoverage(programs: CountryProgramRow[]): number | null {
  const scored = programs.filter((p) => p.composite !== null);
  if (scored.length === 0) return null;
  const sum = scored.reduce((s, p) => s + p.fieldsPopulated / p.fieldsTotal, 0);
  return sum / scored.length;
}

function radarPrograms(programs: CountryProgramRow[]): CountryRadarProgram[] {
  return programs
    .filter(
      (
        p
      ): p is CountryProgramRow & {
        pillarScores: Record<PillarKey, number>;
      } => p.pillarScores !== null && p.composite !== null
    )
    .map((p) => ({
      programId: p.programId,
      programName: p.programName,
      pillarScores: p.pillarScores,
    }));
}

export default async function CountryDetailPage({ params }: PageProps) {
  const { iso } = await params;
  const [detail, previewBannerHtml] = await Promise.all([
    getCountryDetail(iso),
    loadContent('preview-banner.md'),
  ]);
  if (!detail) notFound();

  const scoredCount = detail.programs.filter((p) => p.composite !== null).length;
  const leader = leaderProgramme(detail.programs);
  const radarRows = radarPrograms(detail.programs);

  const datasetJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${detail.header.name} talent mobility programmes (GTMI)`,
    description: `${detail.programs.length} talent-mobility programmes evaluated for ${detail.header.name} under the Global Talent Mobility Index methodology.`,
    url: absoluteUrl(`/countries/${detail.header.iso}`),
    license: `${SITE_URL}/about`,
    creator: { '@type': 'Organization', name: 'TTR Group', url: SITE_URL },
    keywords: ['GTMI', detail.header.name, detail.header.region, 'talent mobility'],
    isAccessibleForFree: true,
    sourceOrganization: { '@type': 'Organization', name: 'TTR Group' },
    spatialCoverage: detail.header.name,
  };

  return (
    <>
      <JsonLd data={datasetJsonLd} />
      <PreviewBanner bodyHtml={previewBannerHtml || null} />

      <CountryHeader
        iso={detail.header.iso}
        name={detail.header.name}
        region={detail.header.region}
        imdRank={detail.header.imdRank}
        imdAppealScore={detail.header.imdAppealScore}
        programmesScored={scoredCount}
        programmesTotal={detail.programs.length}
        topProgrammeName={leader?.programName ?? null}
        topProgrammeRank={leader ? 1 : null}
        averageComposite={averageComposite(detail.programs)}
        averageCoverage={averageCoverage(detail.programs)}
      />

      <section
        className="border-t px-12 py-12"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
      >
        <div
          className="mx-auto grid max-w-page items-start gap-16 md:grid-cols-[1.2fr_1fr]"
          data-testid="country-programmes-section"
        >
          <div>
            <p className="eyebrow mb-3">Programmes scored</p>
            <h2
              className="serif"
              style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              {scoredCount} scored across {detail.programs.length} seeded programmes.
            </h2>
            <div className="mt-6">
              <CountryProgramsTable programs={detail.programs} />
            </div>
          </div>

          <div className="border-l pl-8" style={{ borderColor: 'var(--rule)' }}>
            <p className="eyebrow mb-3">Pillar profile · all scored programmes</p>
            <CountryRadar programs={radarRows} countryName={detail.header.name} />
            {radarRows.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-data-sm text-ink-3">
                <span className="inline-flex items-center gap-2">
                  <span className="block h-[2px] w-3" style={{ background: 'var(--accent)' }} />
                  Top-scoring programme
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="block h-[2px] w-3" style={{ background: 'var(--navy)' }} />
                  Other scored programmes
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className="border-t px-12 py-12"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Tax treatment</p>
          <h2
            className="serif"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            How the country taxes visa-holder income.
          </h2>
          <p className="mt-2 max-w-prose text-ink-3">
            Aggregated from indicators D.3.2 (special regime availability) and D.3.3 (territorial vs
            worldwide taxation) across this country&rsquo;s programmes.
          </p>
          <div className="mt-6">
            <TaxTreatmentCard tax={detail.tax} taxAuthorityUrl={detail.header.taxAuthorityUrl} />
          </div>
        </div>
      </section>

      {STABILITY_FLAG && (
        <section
          className="border-t px-12 py-12"
          style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
          data-testid="country-stability-section"
        >
          <div className="mx-auto max-w-page">
            <p className="eyebrow mb-3">Country-level stability</p>
            <h2
              className="serif"
              style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
            >
              Policy volatility and institutional reliability.
            </h2>
            <div className="mt-6">
              <EmptyState
                title="Stability summary ships in Phase 5"
                body="Once policy-change tracking is live, this section will summarise the country's policy volatility, forward-announced changes, and World Bank governance indices alongside the underlying methodology v1 indicators (E.1, E.3.1, E.3.2)."
              />
            </div>
          </div>
        </section>
      )}

      <section
        className="border-t px-12 py-10"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
      >
        <div className="mx-auto flex max-w-page flex-wrap items-baseline justify-between gap-4">
          <p className="num text-data-sm text-ink-4">
            {detail.header.lastVerifiedAt ? (
              <>
                Last verified{' '}
                <time dateTime={detail.header.lastVerifiedAt}>
                  {formatRelativeDate(detail.header.lastVerifiedAt)}
                </time>{' '}
                · <span className="text-ink">{detail.header.sourcesTracked}</span> source
                {detail.header.sourcesTracked === 1 ? '' : 's'} tracked
              </>
            ) : (
              <>No field values extracted for this country yet</>
            )}
          </p>
          <DataTableNote>
            Composite per programme = 30% CME + 70% PAQ. CME comes from IMD&rsquo;s Appeal factor
            re-normalized across the 30-country cohort; PAQ aggregates 48 indicators across Access,
            Process, Rights, Pathway, Stability — every value traceable to a primary source.
          </DataTableNote>
        </div>
      </section>
    </>
  );
}
