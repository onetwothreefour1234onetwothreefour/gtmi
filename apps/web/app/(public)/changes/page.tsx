import type { Metadata } from 'next';
import { ChangesAudit, DataTableNote, PreviewBanner } from '@/components/gtmi';
import { getPolicyChanges } from '@/lib/queries/policy-changes';
import { loadContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Changes log',
  description:
    'Every score change, written down — Tier 1 government source revisions tracked, classified by severity, with diff and impact recorded.',
};

// Runtime render — getPolicyChanges hits DATABASE_URL.
// unstable_cache inside the query handles cross-request caching (10min TTL).
export const dynamic = 'force-dynamic';

export default async function ChangesPage() {
  const [events, emptyHtml, previewBannerHtml] = await Promise.all([
    getPolicyChanges({}),
    loadContent('changes-empty.md'),
    loadContent('preview-banner.md'),
  ]);

  return (
    <>
      <PreviewBanner bodyHtml={previewBannerHtml || null} />

      <header
        className="paper-grain border-b px-12 pb-12 pt-14"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper)' }}
        data-testid="changes-header"
      >
        <div className="mx-auto max-w-page">
          <p className="eyebrow mb-3">Changes log · always public</p>
          <h1
            className="serif text-ink"
            style={{
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Every score change, written down.
          </h1>
          <p className="mt-4 max-w-[640px] text-ink-3" style={{ fontSize: 16, lineHeight: 1.55 }}>
            When data, methodology, or provenance changes, the affected scores recompute and the
            change is recorded here with its source, hash, and impact.
          </p>
        </div>
      </header>

      <section className="px-12 py-12" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto max-w-[1080px]">
          <ChangesAudit events={events} emptyHtml={emptyHtml || null} />
        </div>
      </section>

      <section className="px-12 pb-16" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto max-w-page">
          <DataTableNote>
            The query that drives this page (<code className="num">getPolicyChanges</code>) executes
            a real <code className="num">SELECT</code> against{' '}
            <code className="num">policy_changes</code> with RLS gating{' '}
            <code className="num">summary_human_approved=true</code>. Phase 5 populates the table;
            this page activates with zero code change.
          </DataTableNote>
        </div>
      </section>
    </>
  );
}
