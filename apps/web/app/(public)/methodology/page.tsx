import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MethodologyBar, DataTableNote, EmptyState } from '@/components/gtmi';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import { getMethodologyCurrent } from '@/lib/queries/methodology-current';
import { loadContent } from '@/lib/content';
import type {
  MethodologyPillar,
  MethodologySubFactor,
} from '@/lib/queries/methodology-current-types';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'Every weight, every indicator, every normalisation choice — read live from the GTMI methodology version table.',
};

export const revalidate = 3600;

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

export default async function MethodologyPage() {
  const methodology = await getMethodologyCurrent();
  if (!methodology) notFound();

  const pillarWeights = Object.fromEntries(
    methodology.pillars.map((p) => [p.key, p.weightWithinPaq])
  ) as Record<PillarKey, number>;

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

  const totalIndicators = methodology.pillars.reduce((s, p) => s + p.indicatorCount, 0);

  return (
    <>
      <header className="mx-auto max-w-page px-6 pt-12">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">Methodology</p>
        <h1 className="mt-2 font-serif text-display-lg text-ink">
          GTMI methodology v{methodology.versionTag}
        </h1>
        <p className="mt-3 text-data-sm text-muted-foreground">
          {totalIndicators} indicators · {methodology.pillars.length} pillars ·{' '}
          {methodology.pillars.reduce((s, p) => s + p.subFactors.length, 0)} sub-factors
          {methodology.publishedAt && (
            <>
              {' · published '}
              <time dateTime={methodology.publishedAt}>{methodology.publishedAt.slice(0, 10)}</time>
            </>
          )}
        </p>
      </header>

      <Section eyebrow="01" title="What GTMI measures">
        <Prose html={introHtml} />
      </Section>

      <Section eyebrow="02" title="Composite structure">
        <p className="max-w-prose text-dek text-muted-foreground">
          The composite score combines{' '}
          <span className="font-mono tnum">{Math.round(methodology.cmePaqSplit.cme * 100)}%</span>{' '}
          Country Mobility Environment with{' '}
          <span className="font-mono tnum">{Math.round(methodology.cmePaqSplit.paq * 100)}%</span>{' '}
          Program Architecture Quality. Hover any pillar segment for its weight.
        </p>
        <div className="mt-4">
          <MethodologyBar cmePaqSplit={methodology.cmePaqSplit} pillarWeights={pillarWeights} />
        </div>
      </Section>

      <Section eyebrow="03" title="The 5 pillars">
        <div className="flex flex-col gap-10">
          {methodology.pillars.map((p) => (
            <PillarBlock key={p.key} pillar={p} rationaleHtml={pillarRationale[p.key]} />
          ))}
        </div>
      </Section>

      <Section eyebrow="04" title="Normalization">
        <Prose html={normalizationHtml} />
      </Section>

      <Section eyebrow="05" title="Data integrity">
        <Prose html={dataIntegrityHtml} />
      </Section>

      <Section eyebrow="06" title="Sensitivity analyses">
        <Prose html={sensitivityHtml} />
      </Section>

      <Section eyebrow="07" title="What GTMI does not measure">
        <Prose html={notMeasuredHtml} />
      </Section>

      <Section eyebrow="08" title="Versions">
        {methodology.history.length === 0 ? (
          <EmptyState title="No version history" body="The methodology version table is empty." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {methodology.history.map((v) => (
              <li
                key={v.versionTag}
                className="flex flex-col gap-1 px-4 py-3"
                data-testid={`methodology-version-${v.versionTag}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-data-md font-semibold tnum">v{v.versionTag}</span>
                  <span className="text-data-sm text-muted-foreground">
                    {v.publishedAt ? v.publishedAt.slice(0, 10) : 'unpublished'}
                  </span>
                </div>
                {v.changeNotes && (
                  <p className="max-w-prose text-data-sm text-muted-foreground">{v.changeNotes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <section className="mx-auto mt-12 max-w-page px-6 pb-24">
        <DataTableNote>
          Every weight on this page is read live from{' '}
          <code className="font-mono">methodology_versions</code> and{' '}
          <code className="font-mono">field_definitions</code>. Scores carried by every program row
          are stamped with their methodology_version_id so a re-run of the scoring engine against
          the same row produces byte-identical output.
        </DataTableNote>
      </section>
    </>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-16 max-w-page px-6">
      <header className="flex items-baseline gap-3">
        <span className="font-mono text-data-sm tnum text-muted-foreground">{eyebrow}</span>
        <h2 className="font-serif text-display-md text-ink">{title}</h2>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Prose({ html }: { html: string }) {
  if (!html.trim()) {
    return (
      <p className="max-w-prose text-data-md italic text-muted-foreground">Content forthcoming.</p>
    );
  }
  return (
    <div
      className="prose prose-neutral max-w-prose text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PillarBlock({
  pillar,
  rationaleHtml,
}: {
  pillar: MethodologyPillar;
  rationaleHtml: string;
}) {
  return (
    <article
      className="rounded-card border border-border bg-surface p-5"
      style={{ borderLeftWidth: 3, borderLeftColor: PILLAR_COLORS[pillar.key] }}
      data-testid={`methodology-pillar-${pillar.key}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-data-lg">
          <span className="font-mono tnum">{pillar.key}</span> · {PILLAR_LABEL[pillar.key]}
        </h3>
        <span className="font-mono text-data-sm tnum text-muted-foreground">
          {Math.round(pillar.weightWithinPaq * 100)}% of PAQ · {pillar.indicatorCount} indicator
          {pillar.indicatorCount === 1 ? '' : 's'}
        </span>
      </header>
      <Prose html={rationaleHtml} />
      <ul className="mt-4 flex flex-col divide-y divide-border rounded-card border border-border bg-paper">
        {pillar.subFactors.map((sf) => (
          <SubFactorRow key={sf.code} subFactor={sf} pillar={pillar.key} />
        ))}
      </ul>
    </article>
  );
}

function SubFactorRow({
  subFactor,
  pillar,
}: {
  subFactor: MethodologySubFactor;
  pillar: PillarKey;
}) {
  return (
    <li
      className="flex flex-col gap-2 px-3 py-2.5"
      data-testid={`methodology-subfactor-${subFactor.code}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-data-md font-semibold tnum">{subFactor.code}</span>
        <span className="font-mono text-data-sm tnum text-muted-foreground">
          {Math.round(subFactor.weightWithinPillar * 100)}% of pillar {pillar}
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-data-sm">
        {subFactor.indicators.map((ind) => (
          <li
            key={ind.key}
            className="grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-3"
            data-testid={`methodology-indicator-${ind.key}`}
          >
            <span className="font-mono tnum text-muted-foreground">{ind.key}</span>
            <span className="text-foreground">{ind.label}</span>
            <span className="font-mono tnum text-muted-foreground">
              {Math.round(ind.weightWithinSubFactor * 100)}%
            </span>
            <span className="text-muted-foreground">{ind.normalizationFn}</span>
            <span className="text-muted-foreground">{ind.direction.replace(/_/g, ' ')}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
