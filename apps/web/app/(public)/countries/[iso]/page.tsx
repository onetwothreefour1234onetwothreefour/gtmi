import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ScoreBar,
  PreCalibrationChip,
  CoverageChip,
  PillarMiniBars,
  EmptyState,
  DataTableNote,
  CountryFlag,
  JsonLd,
} from '@/components/gtmi';
import { absoluteUrl, SITE_URL } from '@/lib/site-url';
import { getCountryDetail } from '@/lib/queries/country-detail';
import { formatRelativeDate } from '@/lib/format';
import type { CountryProgramRow, CountryTaxTreatment } from '@/lib/queries/country-detail-types';
import { db } from '@gtmi/db';
import { sql } from 'drizzle-orm';

interface PageProps {
  params: Promise<{ iso: string }>;
}

export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Pre-render every cohort country page at build time. The countries table
 * is small (~30 rows, capped at 50 for safety) and rarely changes — SSG
 * pays off here in TTFB on the most-trafficked routes.
 */
export async function generateStaticParams(): Promise<Array<{ iso: string }>> {
  try {
    const rows = (await db.execute(
      sql`SELECT iso_code AS iso FROM countries ORDER BY iso_code LIMIT 50`
    )) as unknown as Array<{ iso: string }>;
    return rows.map((r) => ({ iso: r.iso }));
  } catch {
    return [];
  }
}

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

export default async function CountryDetailPage({ params }: PageProps) {
  const { iso } = await params;
  const detail = await getCountryDetail(iso);
  if (!detail) notFound();

  const scoredCount = detail.programs.filter((p) => p.composite !== null).length;
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
      <header className="mx-auto max-w-page px-6 pt-12">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          <Link href="/programs" className="hover:text-foreground">
            Countries
          </Link>
          {' / '}
          <span>{detail.header.region}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <CountryFlag iso={detail.header.iso} countryName={detail.header.name} size="lg" />
          <h1 className="font-serif text-display-lg text-ink">{detail.header.name}</h1>
          <span className="font-mono text-data-md tnum text-muted-foreground">
            {detail.header.iso}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 text-data-md md:grid-cols-3">
          <CountryStat label="Region">{detail.header.region}</CountryStat>
          <CountryStat label="IMD Appeal rank">
            {detail.header.imdRank !== null ? (
              <span className="font-mono tnum">#{detail.header.imdRank}</span>
            ) : (
              <Phase3Chip />
            )}
          </CountryStat>
          <CountryStat label="IMD Appeal score">
            {detail.header.imdAppealScore !== null ? (
              <span className="font-mono tnum">{detail.header.imdAppealScore.toFixed(2)}</span>
            ) : (
              <Phase3Chip />
            )}
          </CountryStat>
        </dl>
      </header>

      <section className="mx-auto mt-12 max-w-page px-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-display-md text-ink">Programmes</h2>
          <p className="text-data-sm text-muted-foreground">
            <span className="font-mono tnum text-foreground">{scoredCount}</span> scored ·{' '}
            <span className="font-mono tnum">{detail.programs.length}</span> total
          </p>
        </header>
        {detail.programs.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No programmes yet"
            body="No talent-mobility programmes have been seeded for this country."
          />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-table border border-border bg-surface">
            <table className="w-full border-collapse text-data-md">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-data-sm uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left">
                    Programme
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Composite
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    PAQ
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Pillars
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.programs.map((row) => (
                  <CountryProgramTableRow key={row.programId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mx-auto mt-12 max-w-page px-6">
        <h2 className="font-serif text-display-md text-ink">Country-level stability</h2>
        <div className="mt-4">
          <EmptyState
            title="Stability summary ships in Phase 5"
            body="Once policy-change tracking is live, this section will summarise the country's policy volatility, forward-announced changes, and World Bank governance indices alongside the underlying methodology v1 indicators (E.1, E.3.1, E.3.2)."
          />
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-page px-6">
        <h2 className="font-serif text-display-md text-ink">Tax treatment</h2>
        <p className="mt-2 max-w-prose text-data-md text-muted-foreground">
          Aggregated from indicators D.3.2 (special regime availability) and D.3.3 (territorial vs
          worldwide taxation) across this country&rsquo;s programmes.
        </p>
        <TaxTreatmentBlock tax={detail.tax} taxAuthorityUrl={detail.header.taxAuthorityUrl} />
      </section>

      <section className="mx-auto mt-12 max-w-page px-6 pb-24">
        <DataTableNote>
          {detail.header.lastVerifiedAt ? (
            <>
              Last verified{' '}
              <time dateTime={detail.header.lastVerifiedAt}>
                {formatRelativeDate(detail.header.lastVerifiedAt)}
              </time>
              , <span className="font-mono tnum">{detail.header.sourcesTracked}</span> source
              {detail.header.sourcesTracked === 1 ? '' : 's'} tracked across this country&rsquo;s
              programmes.
            </>
          ) : (
            <>No field values extracted yet for this country.</>
          )}
        </DataTableNote>
      </section>
    </>
  );
}

function CountryStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <dt className="text-data-sm uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Phase3Chip() {
  return (
    <span
      title="IMD CME data lands in Phase 3 calibration."
      className="inline-flex h-5 cursor-help items-center rounded-button bg-precalib-bg px-1.5 text-[10px] font-medium text-precalib-fg"
    >
      Phase 3
    </span>
  );
}

function CountryProgramTableRow({ row }: { row: CountryProgramRow }) {
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/40">
      <td className="px-3 py-3">
        <Link href={`/programs/${row.programId}`} className="hover:text-accent">
          <span className="font-medium text-foreground">{row.programName}</span>
          <span className="ml-2 text-data-sm text-muted-foreground">{row.programCategory}</span>
        </Link>
      </td>
      <td className="px-3 py-3 text-right">
        {row.composite === null ? (
          <span className="font-mono text-data-sm italic text-muted-foreground">
            Not yet scored
          </span>
        ) : (
          <span className="inline-flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-2">
              <ScoreBar
                value={row.composite}
                phase2Placeholder={row.phase2Placeholder}
                showLabel
                width="sm"
              />
            </span>
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-mono text-data-sm tnum text-muted-foreground">
        {row.paq === null ? '—' : row.paq.toFixed(2)}
      </td>
      <td className="px-3 py-3">
        <PillarMiniBars scores={row.pillarScores} />
      </td>
      <td className="px-3 py-3 text-right">
        {row.composite !== null ? (
          <CoverageChip populated={row.fieldsPopulated} total={row.fieldsTotal} />
        ) : (
          <span className="font-mono text-data-sm text-muted-foreground">—</span>
        )}
        {row.phase2Placeholder && (
          <span className="ml-2 inline-block">
            <PreCalibrationChip />
          </span>
        )}
      </td>
    </tr>
  );
}

function TaxTreatmentBlock({
  tax,
  taxAuthorityUrl,
}: {
  tax: CountryTaxTreatment;
  taxAuthorityUrl: string | null;
}) {
  const hasData = tax.taxationModel !== null || tax.specialRegime !== null;
  if (!hasData) {
    return (
      <div className="mt-4">
        <EmptyState
          title="Data not yet collected"
          body={
            taxAuthorityUrl
              ? `D.3.2 and D.3.3 have not been extracted for this country's programmes yet. Source: ${taxAuthorityUrl}.`
              : 'D.3.2 and D.3.3 have not been extracted for this country’s programmes yet.'
          }
        />
      </div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <TaxBucketCard
        title="Territorial vs worldwide"
        subtitle="Indicator D.3.3"
        distribution={tax.taxationModel}
        totalProgramsInCountry={tax.totalProgramsInCountry}
      />
      <TaxBucketCard
        title="Special regime"
        subtitle="Indicator D.3.2"
        distribution={tax.specialRegime}
        totalProgramsInCountry={tax.totalProgramsInCountry}
      />
    </div>
  );
}

function TaxBucketCard({
  title,
  subtitle,
  distribution,
  totalProgramsInCountry,
}: {
  title: string;
  subtitle: string;
  distribution: Record<string, number> | null;
  totalProgramsInCountry: number;
}) {
  return (
    <article className="rounded-card border border-border bg-surface p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-data-lg">{title}</h3>
        <span className="font-mono text-data-sm tnum text-muted-foreground">{subtitle}</span>
      </header>
      {distribution === null || Object.keys(distribution).length === 0 ? (
        <p className="mt-2 text-data-sm italic text-muted-foreground">Data not yet collected.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {Object.entries(distribution).map(([label, count]) => (
            <li key={label} className="flex items-baseline justify-between gap-3 text-data-md">
              <span className="text-foreground">{label}</span>
              <span className="font-mono text-data-sm tnum text-muted-foreground">
                {count} of {totalProgramsInCountry}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
