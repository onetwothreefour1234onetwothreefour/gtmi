import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  CoverageChip,
  EmptyState,
  ProgramHeader,
  PillarStrip,
  PillarBreakdown,
  PolicyTimeline,
  DataTableNote,
  JsonLd,
} from '@/components/gtmi';
import { absoluteUrl, SITE_URL } from '@/lib/site-url';
import { getProgramDetail } from '@/lib/queries/program-detail';
import { loadContent } from '@/lib/content';
import type { PillarKey } from '@/lib/theme';
import { remark } from 'remark';
import remarkHtml from 'remark-html';

// Render on request, not at build. DATABASE_URL is a runtime-only secret
// in the Cloud Run service. Cross-request caching is preserved by the
// `unstable_cache` wrapper inside `getProgramDetail`.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const FIELDS_TOTAL = 48;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProgramDetail(id);
  if (!detail) return { title: 'Programme not found' };
  const canonical = absoluteUrl(`/programs/${id}`);
  const title = `${detail.header.programName} — ${detail.header.countryName}`;
  const description =
    detail.header.programDescriptionMd?.slice(0, 160) ??
    `${detail.header.programName} in ${detail.header.countryName} — GTMI programme profile with composite score, pillar breakdown, and source provenance.`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'article', url: canonical, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function indicatorCountsByPillar(fieldValues: { pillar: PillarKey }[]): Record<PillarKey, number> {
  const counts: Record<PillarKey, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const fv of fieldValues) counts[fv.pillar] += 1;
  return counts;
}

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

  const populated = detail.fieldValues.filter(
    (fv) => fv.valueRaw !== null && fv.valueRaw !== ''
  ).length;

  const indicatorCounts = indicatorCountsByPillar(detail.fieldValues);
  const isScored = detail.score !== null;
  const isPlaceholder = detail.score?.phase2Placeholder === true;

  const summaryFromDb = detail.longSummary.bodyMd?.trim();
  const summaryFromFile = await loadContent(
    narrativeFileFor(detail.header.countryIso, detail.header.programName)
  );
  const summaryHtml = summaryFromDb ? await renderMarkdown(summaryFromDb) : summaryFromFile;

  const datasetJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${detail.header.programName} — ${detail.header.countryName} (GTMI)`,
    description: `GTMI programme profile for ${detail.header.programName}, including the composite GTMI score, the per-pillar score breakdown across Access, Process, Rights, Pathway, and Stability, and source provenance for every published indicator value.`,
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

      <ProgramHeader
        countryIso={detail.header.countryIso}
        countryName={detail.header.countryName}
        programName={detail.header.programName}
        programCategory={detail.header.programCategory}
        programStatus={detail.header.programStatus}
        programDescriptionMd={detail.header.programDescriptionMd}
        composite={detail.score?.composite ?? null}
        cme={detail.score?.cme ?? null}
        paq={detail.score?.paq ?? null}
        rank={null}
        scoredCount={detail.cohort.scoredCount}
        fieldsPopulated={populated}
        fieldsTotal={FIELDS_TOTAL}
        phase2Placeholder={isPlaceholder}
      />

      {isPlaceholder && (
        <section
          className="border-b px-12 py-3"
          style={{ borderColor: '#E0C896', background: '#FBF3DC', color: 'var(--ink-2)' }}
          role="note"
        >
          <p className="mx-auto max-w-page text-data-sm">
            <strong className="font-semibold">Pre-calibration.</strong> This composite uses Phase 2
            engineer-chosen normalization. Calibration completes in Phase 5 against the full pilot
            cohort; relative methodology application is correct, absolute values will shift.
          </p>
        </section>
      )}

      {isScored && detail.score?.pillarScores ? (
        <PillarStrip pillarScores={detail.score.pillarScores} indicatorCounts={indicatorCounts} />
      ) : (
        <section className="px-12 pt-10">
          <div className="mx-auto max-w-page">
            <EmptyState
              title="Awaiting Phase 5 calibration"
              body="This programme is seeded but has no field values or scores yet. Phase 5 will score the full 5-country pilot — see the methodology page for what each pillar measures."
              ctaHref="/methodology"
              ctaLabel="See methodology"
            />
          </div>
        </section>
      )}

      {isScored && (
        <PillarBreakdown
          fieldValues={detail.fieldValues}
          pillarScores={detail.score?.pillarScores ?? null}
          cohortMedianPillarScores={detail.cohort.medianPillarScores}
          cohortScoredCount={detail.cohort.scoredCount}
          subFactorScores={detail.score?.subFactorScores ?? null}
          phase2Placeholder={isPlaceholder}
        />
      )}

      {/* Editorial "What this means" panel — Markdown long-form. */}
      <section
        className="border-t px-12 py-12"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Editorial</p>
          <h2
            className="serif text-ink"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            What this means
          </h2>
          {summaryHtml ? (
            <div
              className="prose prose-neutral mt-5 max-w-prose text-ink-2"
              style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          ) : (
            <p
              className="mt-5 max-w-prose italic text-ink-4"
              style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: 16 }}
            >
              Summary forthcoming. The editorial &ldquo;What this means&rdquo; panel is being
              drafted.
            </p>
          )}
          {detail.longSummary.updatedAt && (
            <p className="mt-3 text-data-sm text-ink-4">
              Last edited{' '}
              <time dateTime={detail.longSummary.updatedAt}>
                {detail.longSummary.updatedAt.slice(0, 10)}
              </time>
              {detail.longSummary.reviewer && ' · reviewed'}
            </p>
          )}
        </div>
      </section>

      <section className="px-12 py-12" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Policy change timeline</p>
          <h2
            className="serif text-ink"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Recorded amendments to this programme.
          </h2>
          <div className="mt-6">
            <PolicyTimeline events={detail.policyChanges} />
          </div>
        </div>
      </section>

      <section className="px-12 py-12" style={{ background: 'var(--paper-2)' }}>
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Government sources</p>
          <h2
            className="serif text-ink"
            style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Tier 1 sources tracked for this programme.
          </h2>
          {detail.sources.length === 0 ? (
            <p className="mt-5 italic text-ink-4">No sources tracked for this programme yet.</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2 text-data-md">
              {detail.sources.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-2 last:border-b-0"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {s.url}
                  </a>
                  <span className="num text-data-sm text-ink-4">
                    Tier {s.tier} · {s.sourceCategory}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="px-12 py-10">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4">
          <CoverageChip populated={populated} total={FIELDS_TOTAL} format="fraction" />
          <DataTableNote>
            Every numeric value above is sourced from a Tier 1 government page, extracted by an LLM,
            validated by an independent LLM call, and queued for human review when confidence falls
            below 0.85. Click the provenance trigger on any indicator to inspect the exact source
            sentence, character offsets, content hash, and scrape timestamp.
          </DataTableNote>
        </div>
      </section>
    </>
  );
}
