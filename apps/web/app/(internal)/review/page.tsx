import {
  ReviewQueueStats,
  ReviewQueueTable,
  ReviewQueueKeyboard,
  ReviewFilterTabs,
  BulkApproveDialog,
  BulkApproveAllDialog,
  RescoreCohortDialog,
  DataTableNote,
} from '@/components/gtmi';
import { listPendingReview, listRecentlyReviewed } from '@/lib/review-queries';
import { getReviewQueueStats } from '@/lib/review-queue-stats';
import {
  matchesReviewTab,
  readProvenanceConfidence,
  readQualitySignals,
  type ReviewFilterTab,
} from '@/lib/review-queue-helpers';
import type { ReviewListRow } from '@/lib/review-queries';
import { assignReviewer, bulkApproveAllPending, bulkApproveHighConfidence } from './actions';
import { rescoreCohort } from './rescore-actions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = 'force-dynamic';

const VALID_TABS: ReviewFilterTab[] = [
  'all',
  'pending',
  'in-review',
  'flagged',
  'high-confidence',
  'quality-signals',
  'my-queue',
];

function parseTab(raw: string | undefined): ReviewFilterTab {
  return VALID_TABS.includes(raw as ReviewFilterTab) ? (raw as ReviewFilterTab) : 'all';
}

function parseReviewer(raw: string | undefined): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string; reviewer?: string }>;
}) {
  const { tab: rawTab, view: rawView, reviewer: rawReviewer } = await searchParams;
  const activeTab = parseTab(rawTab);
  const view = rawView === 'reviewed' ? 'reviewed' : 'pending';
  const reviewerId = parseReviewer(rawReviewer);

  const [pendingRows, recentRows, stats] = await Promise.all([
    listPendingReview(),
    listRecentlyReviewed(20),
    getReviewQueueStats(),
  ]);

  const datasetRows: ReviewListRow[] = view === 'reviewed' ? recentRows : pendingRows;

  // Bucket counts for the chip badges (computed against the active dataset
  // so the numbers match what the table will show on tab change).
  const counts: Record<ReviewFilterTab, number> = {
    all: datasetRows.length,
    pending: 0,
    'in-review': 0,
    flagged: 0,
    'high-confidence': 0,
    'quality-signals': 0,
    'my-queue': 0,
  };
  for (const row of datasetRows) {
    const prov = readProvenanceConfidence(row.provenance);
    const qs = readQualitySignals(row.provenance);
    for (const t of VALID_TABS) {
      if (t === 'all') continue;
      if (matchesReviewTab(t, row.status, prov, qs, row.assignedTo, reviewerId)) counts[t] += 1;
    }
  }

  const visible = datasetRows.filter((row) =>
    matchesReviewTab(
      activeTab,
      row.status,
      readProvenanceConfidence(row.provenance),
      readQualitySignals(row.provenance),
      row.assignedTo,
      reviewerId
    )
  );

  // Pinned at SSR so the queue table's relative-age column doesn't drift on
  // hydration. Re-renders with the next request.
  const renderedAt = new Date();

  return (
    <main className="px-8 pb-16 pt-10" style={{ background: 'var(--paper)' }}>
      <div className="mx-auto max-w-page-wide">
        <header
          className="mb-8 grid items-end gap-12 md:grid-cols-[1.4fr_1fr]"
          data-testid="review-queue-header"
        >
          <div>
            <p className="eyebrow mb-3">Review queue · Editorial</p>
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
              Pending review.
            </h1>
            <p className="mt-4 max-w-[540px] text-ink-3" style={{ fontSize: 15, lineHeight: 1.6 }}>
              Indicator updates flagged by the extraction pipeline that need editorial sign-off
              before the public composite recomputes.
            </p>
          </div>
          <ReviewQueueStats stats={stats} />
        </header>

        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y py-3"
          style={{ borderColor: 'var(--rule)' }}
        >
          <ReviewFilterTabs counts={counts} active={activeTab} reviewerId={reviewerId} />
          <div className="flex flex-wrap items-center gap-3">
            <ViewToggle active={view} reviewerId={reviewerId} />
            <BulkApproveDialog
              candidateCount={stats.highConfidence}
              onConfirm={bulkApproveHighConfidence}
            />
            <BulkApproveAllDialog pendingCount={stats.inQueue} onConfirm={bulkApproveAllPending} />
            <RescoreCohortDialog onConfirm={rescoreCohort} />
          </div>
        </div>

        <ReviewQueueTable
          rows={visible}
          now={renderedAt}
          reviewerId={reviewerId}
          onAssign={assignReviewer}
        />
        <ReviewQueueKeyboard />

        <div className="mt-6">
          <DataTableNote>
            Bulk approve gate: <code className="num">extractionConfidence ≥ 0.85</code> AND{' '}
            <code className="num">validationConfidence ≥ 0.85</code> AND the validator did not flag
            the source sentence as a mismatch. Composite-impact deltas (Q9) are not yet computed —
            the Impact column shows <span className="num">—</span> for every row.
          </DataTableNote>
        </div>
      </div>
    </main>
  );
}

function ViewToggle({
  active,
  reviewerId,
}: {
  active: 'pending' | 'reviewed';
  reviewerId: string | null;
}) {
  // Server component link toggle so URL state is the single source of truth.
  // Preserves ?reviewer=… across the toggle so D.3's "My queue" tab survives.
  const reviewerQs = reviewerId ? `reviewer=${encodeURIComponent(reviewerId)}` : '';
  const pendingHref = reviewerQs ? `/review?${reviewerQs}` : '/review';
  const reviewedHref = reviewerQs ? `/review?view=reviewed&${reviewerQs}` : '/review?view=reviewed';
  return (
    <div
      className="flex border"
      style={{ borderColor: 'var(--rule)' }}
      data-testid="review-view-toggle"
    >
      <a
        href={pendingHref}
        className={`chip h-7 cursor-pointer border-0 ${active === 'pending' ? 'chip-ink' : ''}`}
        aria-pressed={active === 'pending'}
      >
        Pending
      </a>
      <a
        href={reviewedHref}
        className={`chip h-7 cursor-pointer border-0 border-l ${active === 'reviewed' ? 'chip-ink' : ''}`}
        style={{ borderLeftColor: 'var(--rule)' }}
        aria-pressed={active === 'reviewed'}
      >
        Recently reviewed
      </a>
    </div>
  );
}
