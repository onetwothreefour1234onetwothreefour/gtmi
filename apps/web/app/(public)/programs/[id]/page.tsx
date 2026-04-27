import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  CompositeScoreDisplay,
  CoverageChip,
  PreCalibrationChip,
  PolicyTimeline,
  EmptyState,
  PillarComparison,
  SubFactorAccordion,
  DataTableNote,
  CountryFlag,
  JsonLd,
} from '@/components/gtmi';
import { absoluteUrl, SITE_URL } from '@/lib/site-url';
import { getProgramDetail } from '@/lib/queries/program-detail';
import { loadContent } from '@/lib/content';
import type { PillarKey } from '@/lib/theme';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import { db } from '@gtmi/db';
import { sql } from 'drizzle-orm';

export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Pre-render the most-popular program detail pages at build time. Less-
 * popular programs render on-demand and cache via ISR (revalidate=3600).
 *
 * Phase 4.5 reality: the most-popular set is "every scored program" plus
 * the seeded ones in the IMD Top 30. Returning every program from the
 * live DB is fine at 85-row scale.
 */
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  try {
    const rows = (await db.execute(sql`SELECT id FROM programs LIMIT 200`)) as unknown as Array<{
      id: string;
    }>;
    return rows.map((r) => ({ id: r.id }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProgramDetail(id);
  if (!detail) return { title: 'Program not found' };
  const canonical = absoluteUrl(`/programs/${id}`);
  const title = `${detail.header.programName} — ${detail.header.countryName}`;
  const description =
    detail.header.programDescriptionMd?.slice(0, 160) ??
    `${detail.header.programName} in ${detail.header.countryName} — GTMI program profile with composite score, pillar breakdown, and source provenance.`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const FIELDS_TOTAL = 48;

function indicatorCountsByPillar(fieldValues: { pillar: PillarKey }[]): Record<PillarKey, number> {
  const counts: Record<PillarKey, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fv of fieldValues) counts[fv.pillar] += 1;
  return counts;
}

/**
 * Resolve the editorial-summary file for this program. Pattern:
 *   apps/web/content/programs/<countryIso-lower>-<slug-of-name>.md
 *
 * Slug normalises whitespace + punctuation to dashes and lowercases. If
 * the file is missing or empty, loadContent returns "" and the page
 * renders the "Summary forthcoming" placeholder.
 */
function narrativeFileFor(countryIso: string, programName: string): string {
  const slug = programName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `programs/${countryIso.toLowerCase()}-${slug}.md`;
}

async function renderMarkdown(md: string): Promise<string> {
  const file = await remark().use(remarkHtml).process(md);
  return String(file);
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getProgramDetail(id);
  if (!detail) notFound();

  // Count any field value that has a non-empty raw extraction. Phase 2
  // retrospective coverage was reported as 30/48 (AUS) and 34/48 (SGP) on
  // the all-extracted basis, not the approved-only basis. Approved-only
  // coverage is a separate metric — surfaced via the Pre-calibration chip
  // and the per-indicator status pill.
  const populated = detail.fieldValues.filter(
    (fv) => fv.valueRaw !== null && fv.valueRaw !== ''
  ).length;

  const indicatorCounts = indicatorCountsByPillar(detail.fieldValues);

  const isScored = detail.score !== null;
  const isPlaceholder = detail.score?.phase2Placeholder === true;

  // Editorial summary: prefer DB column, fall back to content/programs/*.md
  // for the seeded AUS/SGP stubs. Empty bodies render the placeholder.
  const summaryFromDb = detail.longSummary.bodyMd?.trim();
  const summaryFromFile = await loadContent(
    narrativeFileFor(detail.header.countryIso, detail.header.programName)
  );
  const summaryHtml = summaryFromDb ? await renderMarkdown(summaryFromDb) : summaryFromFile;

  const datasetJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${detail.header.programName} — ${detail.header.countryName} (GTMI)`,
    description: `GTMI program profile for ${detail.header.programName}, including the composite GTMI score, the per-pillar score breakdown across Access, Process, Rights, Pathway, and Stability, and source provenance for every published indicator value.`,
    url: absoluteUrl(`/programs/${detail.header.programId}`),
    license: `${SITE_URL}/about`,
    creator: { '@type': 'Organization', name: 'TTR Group', url: SITE_URL },
    keywords: [
      'GTMI',
      detail.header.countryName,
      detail.header.programCategory,
      'talent visa',
      'mobility programme',
    ],
    isAccessibleForFree: true,
    sourceOrganization: { '@type': 'Organization', name: 'TTR Group' },
    ...(detail.score?.composite !== null && detail.score?.composite !== undefined
      ? {
          variableMeasured: [
            { '@type': 'PropertyValue', name: 'Composite score', value: detail.score.composite },
            { '@type': 'PropertyValue', name: 'CME score', value: detail.score.cme ?? null },
            { '@type': 'PropertyValue', name: 'PAQ score', value: detail.score.paq ?? null },
          ],
        }
      : {}),
  };

  return (
    <>
      <JsonLd data={datasetJsonLd} />
      <header className="mx-auto max-w-page px-6 pt-12">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          <Link href="/programs" className="hover:text-foreground">
            Programs
          </Link>
          {' / '}
          <Link href={`/countries/${detail.header.countryIso}`} className="hover:text-foreground">
            {detail.header.countryName}
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <CountryFlag
            iso={detail.header.countryIso}
            countryName={detail.header.countryName}
            size="md"
          />
          <h1 className="font-serif text-display-lg text-ink">{detail.header.programName}</h1>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-data-sm text-muted-foreground">
          <span className="rounded-button bg-muted px-2 py-0.5 font-medium">
            {detail.header.programCategory}
          </span>
          <span className="rounded-button bg-muted px-2 py-0.5">{detail.header.programStatus}</span>
          {isScored && <CoverageChip populated={populated} total={FIELDS_TOTAL} />}
          {isPlaceholder && <PreCalibrationChip size="md" />}
        </div>
      </header>

      {isPlaceholder && (
        <section className="mx-auto mt-8 max-w-page px-6">
          <div
            role="note"
            className="rounded-card border-l-2 border-precalib-fg bg-precalib-bg/50 px-4 py-3 text-data-md text-foreground"
          >
            This score uses Phase 2 pre-calibration normalisation. Calibration against the full
            pilot cohort completes in Phase 3; absolute values will shift, relative methodology
            application is correct.
          </div>
        </section>
      )}

      <section className="mx-auto mt-10 max-w-page px-6">
        {detail.score && detail.score.pillarScores ? (
          <CompositeScoreDisplay
            composite={detail.score.composite}
            cme={detail.score.cme}
            paq={detail.score.paq}
            phase2Placeholder={isPlaceholder}
            rank={null}
            scoredCount={detail.cohort.scoredCount}
          />
        ) : (
          <EmptyState
            title="Awaiting Phase 3 scoring"
            body="This programme is seeded but has no field values or scores yet. Phase 3 will score the full 5-country pilot — see the methodology page for what each pillar measures."
            ctaHref="/methodology"
            ctaLabel="See methodology"
          />
        )}
      </section>

      {detail.score?.pillarScores && (
        <section className="mx-auto mt-12 max-w-page px-6">
          <PillarComparison
            programLabel={detail.header.programName}
            programPillarScores={detail.score.pillarScores}
            cohortMedian={detail.cohort.medianPillarScores}
            cohortScoredCount={detail.cohort.scoredCount}
            compareCandidates={detail.cohort.compareCandidates}
            indicatorCounts={indicatorCounts}
          />
        </section>
      )}

      {isScored && (
        <section className="mx-auto mt-12 max-w-page px-6">
          <SubFactorAccordion
            fieldValues={detail.fieldValues}
            subFactorScores={detail.score?.subFactorScores ?? null}
            phase2Placeholder={isPlaceholder}
          />
        </section>
      )}

      <section className="mx-auto mt-12 max-w-page px-6">
        <h2 className="font-serif text-display-md text-ink">What this means</h2>
        {summaryHtml ? (
          <div
            className="prose prose-neutral mt-4 max-w-prose text-foreground"
            dangerouslySetInnerHTML={{ __html: summaryHtml }}
          />
        ) : (
          <p className="mt-4 max-w-prose text-data-md text-muted-foreground">
            Summary forthcoming. The editorial &ldquo;What this means&rdquo; panel is being drafted.
          </p>
        )}
        {detail.longSummary.updatedAt && (
          <p className="mt-2 text-data-sm text-muted-foreground">
            Last edited{' '}
            <time dateTime={detail.longSummary.updatedAt}>
              {detail.longSummary.updatedAt.slice(0, 10)}
            </time>
            {detail.longSummary.reviewer && ' · reviewed'}
          </p>
        )}
      </section>

      <section className="mx-auto mt-12 max-w-page px-6">
        <h2 className="font-serif text-display-md text-ink">Policy change timeline</h2>
        <div className="mt-4">
          <PolicyTimeline events={detail.policyChanges} />
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-page px-6">
        <h2 className="font-serif text-display-md text-ink">Government sources</h2>
        {detail.sources.length === 0 ? (
          <p className="mt-4 text-data-md text-muted-foreground">
            No sources tracked for this programme yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2 text-data-md">
            {detail.sources.map((s) => (
              <li
                key={s.id}
                className="flex items-baseline justify-between gap-3 border-b border-border pb-2 last:border-b-0"
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {s.url}
                </a>
                <span className="font-mono text-data-sm text-muted-foreground">
                  Tier {s.tier} · {s.sourceCategory}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto mt-12 max-w-page px-6 pb-24">
        <DataTableNote>
          Every numeric value above is sourced from a Tier 1 government page, extracted by an LLM,
          validated by an independent LLM call, and queued for human review when confidence falls
          below 0.85. Hover any number to see the exact source sentence.
        </DataTableNote>
      </section>
    </>
  );
}
