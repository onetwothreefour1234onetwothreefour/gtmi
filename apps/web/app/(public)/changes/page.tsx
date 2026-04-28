import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, DataTableNote } from '@/components/gtmi';
import { getPolicyChanges } from '@/lib/queries/policy-changes';
import { loadContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Policy changes',
  description:
    'Tier 1 government source changes detected and classified by severity. Phase 5 lights up the live timeline.',
};

// Runtime render — getPolicyChanges hits DATABASE_URL.
// unstable_cache inside the query handles cross-request caching (10min TTL).
export const dynamic = 'force-dynamic';

export default async function ChangesPage() {
  const [events, emptyHtml] = await Promise.all([
    getPolicyChanges({}),
    loadContent('changes-empty.md'),
  ]);

  const isEmpty = events.length === 0;

  return (
    <>
      <header className="mx-auto max-w-page px-6 pt-12">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          Policy changes
        </p>
        <h1 className="mt-2 font-serif text-display-lg text-ink">Detected policy changes</h1>
        <p className="mt-3 max-w-prose text-dek text-muted-foreground">
          Live monitoring of Tier&nbsp;1 government sources. Re-scrapes weekly, classifies changes
          by severity (minor / material / breaking), preserves before/after diffs.
        </p>
      </header>

      <section className="mx-auto mt-10 max-w-page px-6">
        <fieldset
          aria-label="Filters"
          disabled={isEmpty}
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 disabled:opacity-60"
          data-testid="changes-filters"
        >
          <header className="flex items-baseline justify-between gap-2">
            <p className="text-data-sm uppercase tracking-widest text-muted-foreground">Filters</p>
            <p className="text-data-sm text-muted-foreground">
              <span className="font-mono tnum text-foreground">{events.length}</span> event
              {events.length === 1 ? '' : 's'}
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FilterPlaceholder label="Severity">
              <option>Any severity</option>
              <option>Minor</option>
              <option>Material</option>
              <option>Breaking</option>
            </FilterPlaceholder>
            <FilterPlaceholder label="Country">
              <option>Any country</option>
            </FilterPlaceholder>
            <FilterPlaceholder label="Pillar affected">
              <option>Any pillar</option>
              <option>A · Access</option>
              <option>B · Process</option>
              <option>C · Rights</option>
              <option>D · Pathway</option>
              <option>E · Stability</option>
            </FilterPlaceholder>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-data-sm text-muted-foreground">Date range</legend>
              <div className="flex items-center gap-2">
                <DateInput label="From" />
                <span aria-hidden className="text-muted-foreground">
                  —
                </span>
                <DateInput label="To" />
              </div>
            </fieldset>
          </div>
        </fieldset>
      </section>

      <section className="mx-auto mt-8 max-w-page px-6">
        {isEmpty ? (
          <EmptyState
            title="Phase 5 lights up the timeline"
            body={
              emptyHtml ? (
                <span dangerouslySetInnerHTML={{ __html: emptyHtml }} />
              ) : (
                'Policy change detection ships in Phase 5. Once live, every Tier 1 source we track will be re-scraped weekly. Detected changes appear here within 24 hours, classified by severity, with diffs and Wayback-archived snapshots.'
              )
            }
          />
        ) : (
          <ol
            className="flex flex-col gap-4 border-l border-border pl-5"
            data-testid="changes-timeline"
          >
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[27px] top-1 inline-block h-3 w-3 rounded-full bg-accent"
                />
                <div className="flex flex-wrap items-baseline gap-2 text-data-sm">
                  <time dateTime={e.detectedAt} className="font-mono tnum text-muted-foreground">
                    {e.detectedAt.slice(0, 10)}
                  </time>
                  <SeverityChip severity={e.severity} />
                  <Link
                    href={`/programs/${e.programId}`}
                    className="text-foreground hover:text-accent"
                  >
                    {e.programName}
                  </Link>
                  <Link
                    href={`/countries/${e.countryIso}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    · {e.countryName}
                  </Link>
                  <span className="font-mono tnum">{e.fieldKey}</span>
                  {typeof e.paqDelta === 'number' && (
                    <span className="ml-auto font-mono tnum text-muted-foreground">
                      Δ PAQ {e.paqDelta > 0 ? '+' : ''}
                      {e.paqDelta.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-data-md text-foreground">{e.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mx-auto mt-12 max-w-page px-6 pb-24">
        <DataTableNote>
          The query that drives this page (`getPolicyChanges`) executes a real SELECT against
          `policy_changes` with RLS gating `summary_human_approved=true`. Phase 5 populates the
          table; this page activates with zero code change.
        </DataTableNote>
      </section>
    </>
  );
}

function FilterPlaceholder({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-data-sm text-muted-foreground">{label}</span>
      <select
        disabled
        className="rounded-button border border-border bg-paper px-2 py-1 text-data-md disabled:cursor-not-allowed"
      >
        {children}
      </select>
    </label>
  );
}

function DateInput({ label }: { label: string }) {
  return (
    <input
      type="date"
      disabled
      aria-label={label}
      className="rounded-button border border-border bg-paper px-2 py-1 font-mono text-data-md tnum disabled:cursor-not-allowed"
    />
  );
}

function SeverityChip({
  severity,
}: {
  severity: 'minor' | 'material' | 'breaking' | 'url_broken';
}) {
  const styles =
    severity === 'breaking'
      ? 'bg-destructive/10 text-destructive border-destructive/40'
      : severity === 'material'
        ? 'bg-precalib-bg text-precalib-fg border-precalib-fg/40'
        : severity === 'url_broken'
          ? 'bg-precalib-bg text-precalib-fg border-precalib-fg/40'
          : 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={`inline-flex h-5 items-center rounded-button border px-1.5 font-sans text-[10px] font-medium uppercase tracking-wider ${styles}`}
    >
      {severity}
    </span>
  );
}
