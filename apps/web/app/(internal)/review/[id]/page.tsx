import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProvenanceHighlight, CountryFlag, DataTableNote } from '@/components/gtmi';
import { getReviewDetail, listPendingReview } from '@/lib/review-queries';
import { reviewIdTag, relativeAge } from '@/lib/review-queue-helpers';
import {
  approveFieldValue,
  editApprovedFieldValue,
  rejectFieldValue,
  unapproveFieldValue,
} from '@/app/(internal)/review/actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function readCharOffsets(raw: unknown): [number, number] | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>).charOffsets;
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
    return [v[0], v[1]];
  }
  return null;
}

function readSourceTier(raw: unknown): number | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>).sourceTier;
  return typeof v === 'number' ? v : null;
}

function readScrapedAt(raw: unknown): string | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>).scrapedAt;
  return typeof v === 'string' ? v : null;
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [row, pendingRows] = await Promise.all([getReviewDetail(id), listPendingReview()]);
  if (!row) notFound();

  const ids = pendingRows.map((p) => p.id);
  const idx = ids.indexOf(id);
  const prevId = idx > 0 ? ids[idx - 1] : null;
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  // Both wrappers read `id` from a hidden form input rather than relying
  // on the closure binding (inline server actions inside server components
  // have historically been finicky about closures across Next.js minor
  // versions — a hidden input is robust regardless).
  async function approve(fd: FormData): Promise<void> {
    'use server';
    const fvId = (fd.get('id') as string | null) ?? '';
    if (!fvId) throw new Error('approve: missing field_value id');
    const edited = fd.get('editedRaw') as string | null;
    await approveFieldValue(fvId, edited ?? undefined);
  }

  async function reject(fd: FormData): Promise<void> {
    'use server';
    const fvId = (fd.get('id') as string | null) ?? '';
    if (!fvId) throw new Error('reject: missing field_value id');
    const reason = (fd.get('reason') as string | null)?.trim() || undefined;
    await rejectFieldValue(fvId, reason);
  }

  // Phase 3.7 / ADR-017 — bidirectional review actions.
  async function editApproved(fd: FormData): Promise<void> {
    'use server';
    const fvId = (fd.get('id') as string | null) ?? '';
    const edited = (fd.get('editedRaw') as string | null) ?? '';
    if (!fvId) throw new Error('editApproved: missing field_value id');
    if (!edited.trim()) throw new Error('editApproved: editedRaw is required');
    await editApprovedFieldValue(fvId, edited);
  }

  async function unapprove(fd: FormData): Promise<void> {
    'use server';
    const fvId = (fd.get('id') as string | null) ?? '';
    if (!fvId) throw new Error('unapprove: missing field_value id');
    await unapproveFieldValue(fvId);
  }

  const isPending = row.status === 'pending_review';
  const isApproved = row.status === 'approved';
  const isRejected = row.status === 'rejected';
  const charOffsets = readCharOffsets(row.provenance);
  const sourceTier = row.sourceTier ?? readSourceTier(row.provenance);
  const scrapedAt = readScrapedAt(row.provenance);

  return (
    <main className="px-8 pb-16 pt-8" style={{ background: 'var(--paper)' }}>
      <div className="mx-auto max-w-[960px]">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-data-sm text-ink-4"
        >
          <Link href="/review" className="hover:text-ink">
            ← Review queue
          </Link>
          <span aria-hidden>·</span>
          <span className="num text-ink">{reviewIdTag(row.id)}</span>
        </nav>

        <header
          className="mb-6 grid items-end gap-8 md:grid-cols-[1.4fr_1fr]"
          data-testid="review-detail-header"
        >
          <div>
            <p className="eyebrow mb-2">
              <span className="num text-ink-3">{row.fieldKey}</span> · {row.countryName} ·{' '}
              {row.programName}
            </p>
            <h1
              className="serif text-ink"
              style={{
                fontSize: 36,
                fontWeight: 400,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {row.fieldLabel}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-data-sm text-ink-4">
              <span className="inline-flex items-center gap-2">
                <CountryFlag iso={row.countryIso} countryName={row.countryName} size="sm" />
                {row.countryName}
              </span>
              <span aria-hidden>·</span>
              <Link
                href={`/programs/${row.programId}`}
                className="serif italic hover:text-ink"
                target="_blank"
                rel="noreferrer"
              >
                {row.programName}
              </Link>
              <span aria-hidden>·</span>
              <span className="num">Pillar {row.pillar}</span>
              {row.extractedAt && (
                <>
                  <span aria-hidden>·</span>
                  <span className="num">{relativeAge(row.extractedAt)}</span>
                </>
              )}
            </div>
          </div>
          <StatusBanner status={row.status} />
        </header>

        <section
          className="mb-6 border bg-paper-2 p-5"
          style={{ borderColor: 'var(--rule)' }}
          data-testid="review-detail-source"
        >
          <p className="eyebrow mb-3">Extracted source</p>

          {row.sourceSentence ? (
            charOffsets ? (
              <ProvenanceHighlight sentence={row.sourceSentence} charOffsets={charOffsets} />
            ) : (
              <p
                className="serif"
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--ink-2)',
                  fontStyle: 'italic',
                }}
              >
                {row.sourceSentence}
              </p>
            )
          ) : (
            <p className="italic text-ink-4" data-testid="no-source-sentence">
              No source sentence stored on this row.
            </p>
          )}

          <dl
            className="num mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-3 text-ink-4 md:grid-cols-4"
            style={{ borderColor: 'var(--rule)', fontSize: 11 }}
          >
            <div>
              <dt className="text-ink-5">Extraction conf.</dt>
              <dd
                className={
                  row.extractionConfidence !== null && row.extractionConfidence < 0.85
                    ? 'text-warning'
                    : 'text-positive'
                }
                data-testid="extraction-confidence"
              >
                {row.extractionConfidence !== null
                  ? `${(row.extractionConfidence * 100).toFixed(0)}%`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-5">Validation conf.</dt>
              <dd
                className={
                  row.validationConfidence !== null && row.validationConfidence < 0.85
                    ? 'text-warning'
                    : 'text-positive'
                }
                data-testid="validation-confidence"
              >
                {row.validationConfidence !== null
                  ? `${(row.validationConfidence * 100).toFixed(0)}%`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-5">Tier</dt>
              <dd>{sourceTier !== null ? `Tier ${sourceTier}` : '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-5">Scraped</dt>
              <dd>{scrapedAt ? scrapedAt.slice(0, 10) : '—'}</dd>
            </div>
          </dl>

          {row.sourceUrl && (
            <p className="mt-3 break-all text-data-sm">
              <a
                href={row.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {row.sourceUrl} ↗
              </a>
            </p>
          )}
        </section>

        <section
          className="mb-6 grid items-start gap-4 border bg-paper p-5 md:grid-cols-[1.6fr_1fr]"
          style={{ borderColor: 'var(--rule)' }}
          data-testid="review-decision-section"
          data-status={row.status}
        >
          <div className="flex flex-col gap-2">
            <label className="eyebrow" htmlFor="editedRaw">
              Raw value{' '}
              <span className="text-ink-5">
                {isApproved
                  ? '(edit to update the approved value; re-runs scoring)'
                  : isRejected
                    ? '(edit before re-pending or approving if you change your mind)'
                    : '(edit before approving if needed)'}
              </span>
            </label>
            <textarea
              id="editedRaw"
              name="editedRaw"
              form="primary-action-form"
              defaultValue={row.valueRaw ?? ''}
              rows={3}
              className="num border bg-paper p-2 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ borderColor: 'var(--rule)', fontSize: 13 }}
            />

            {isPending && (
              <form id="primary-action-form" action={approve} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={id} />
                <p className="text-data-sm text-ink-4">
                  Leave unchanged to approve the LLM-extracted value as-is.
                </p>
                <button
                  type="submit"
                  className="btn mt-2 w-fit"
                  style={{ background: 'var(--positive)', borderColor: 'var(--positive)' }}
                  data-testid="approve-button"
                >
                  Approve
                </button>
              </form>
            )}

            {isApproved && (
              <div className="flex flex-wrap gap-2">
                <form id="primary-action-form" action={editApproved}>
                  <input type="hidden" name="id" value={id} />
                  <button
                    type="submit"
                    className="btn"
                    style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                    data-testid="edit-approved-button"
                  >
                    Save edit
                  </button>
                </form>
                <form action={unapprove}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="btn" data-testid="repend-button">
                    Re-pend
                  </button>
                </form>
              </div>
            )}

            {isRejected && (
              <div className="flex flex-wrap gap-2">
                <form id="primary-action-form" action={approve}>
                  <input type="hidden" name="id" value={id} />
                  <button
                    type="submit"
                    className="btn"
                    style={{ background: 'var(--positive)', borderColor: 'var(--positive)' }}
                    data-testid="approve-button"
                  >
                    Approve
                  </button>
                </form>
                <form action={unapprove}>
                  <input type="hidden" name="id" value={id} />
                  <button type="submit" className="btn" data-testid="repend-button">
                    Re-pend
                  </button>
                </form>
              </div>
            )}
          </div>

          <form action={reject} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={id} />
            <p className="eyebrow">Reject{isRejected ? ' (already rejected)' : ''}</p>
            <p className="text-data-sm text-ink-3">
              Mark the row rejected. It will not contribute to scoring; the row stays on{' '}
              <span className="num">field_values</span> with{' '}
              <span className="num">status=&apos;rejected&apos;</span> for audit.
            </p>
            <label className="eyebrow text-ink-5" htmlFor="reject-reason">
              Reason (optional)
            </label>
            <input
              id="reject-reason"
              name="reason"
              type="text"
              maxLength={200}
              placeholder="e.g. wrong page; out of rubric"
              className="num border bg-paper p-2 text-data-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ borderColor: 'var(--rule)', fontSize: 12 }}
            />
            <button
              type="submit"
              className="btn w-fit"
              style={{ background: 'var(--negative)', borderColor: 'var(--negative)' }}
              data-testid="reject-button"
            >
              Reject
            </button>
          </form>
        </section>

        <section
          className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2"
          data-testid="review-detail-meta"
        >
          <details className="border p-4" style={{ borderColor: 'var(--rule)' }}>
            <summary className="cursor-pointer text-data-sm text-ink-3">
              Normalized value (JSON)
            </summary>
            <pre
              className="num mt-3 overflow-auto bg-paper-2 p-3 text-data-sm"
              style={{ fontSize: 11 }}
            >
              {JSON.stringify(row.valueNormalized, null, 2)}
            </pre>
          </details>

          <details className="border p-4" style={{ borderColor: 'var(--rule)' }}>
            <summary className="cursor-pointer text-data-sm text-ink-3">Provenance JSONB</summary>
            <pre
              className="num mt-3 overflow-auto bg-paper-2 p-3 text-data-sm"
              style={{ fontSize: 11 }}
            >
              {JSON.stringify(row.provenance, null, 2)}
            </pre>
          </details>

          {row.extractionPromptMd && (
            <details className="border p-4" style={{ borderColor: 'var(--rule)' }}>
              <summary className="cursor-pointer text-data-sm text-ink-3">
                Extraction prompt
              </summary>
              <pre
                className="num mt-3 overflow-auto bg-paper-2 p-3 text-data-sm"
                style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}
              >
                {row.extractionPromptMd}
              </pre>
            </details>
          )}

          {!!row.scoringRubricJsonb && (
            <details className="border p-4" style={{ borderColor: 'var(--rule)' }}>
              <summary className="cursor-pointer text-data-sm text-ink-3">Scoring rubric</summary>
              <pre
                className="num mt-3 overflow-auto bg-paper-2 p-3 text-data-sm"
                style={{ fontSize: 11 }}
              >
                {JSON.stringify(row.scoringRubricJsonb, null, 2)}
              </pre>
            </details>
          )}
        </section>

        <nav
          aria-label="Review queue navigation"
          className="mt-6 flex items-center justify-between border-t pt-4 text-data-sm"
          style={{ borderColor: 'var(--rule)' }}
          data-testid="review-detail-pagination"
        >
          <span className="num text-ink-4">
            {idx >= 0 ? `${idx + 1} of ${pendingRows.length} pending` : '—'}
          </span>
          <div className="flex items-center gap-3">
            {prevId ? (
              <Link href={`/review/${prevId}`} className="btn-link">
                ← Previous
              </Link>
            ) : (
              <span className="text-ink-5">← Previous</span>
            )}
            {nextId ? (
              <Link href={`/review/${nextId}`} className="btn-link">
                Next →
              </Link>
            ) : (
              <span className="text-ink-5">Next →</span>
            )}
          </div>
        </nav>

        <div className="mt-6">
          <DataTableNote>
            Approve writes <code className="num">field_values.status=&apos;approved&apos;</code> and
            re-runs the normalization function if the raw value was edited. Reject writes{' '}
            <code className="num">status=&apos;rejected&apos;</code> and removes the row from
            scoring; the audit trail stays.
          </DataTableNote>
        </div>
      </div>
    </main>
  );
}

function StatusBanner({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <div
        className="border bg-paper p-4"
        style={{ borderColor: 'var(--positive)' }}
        data-testid="review-status-banner"
        data-status="approved"
      >
        <p className="eyebrow" style={{ color: 'var(--positive)' }}>
          Approved
        </p>
        <p className="serif mt-1" style={{ fontSize: 17, fontWeight: 500 }}>
          Already accepted into the public score.
        </p>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div
        className="border bg-paper p-4"
        style={{ borderColor: 'var(--negative)' }}
        data-testid="review-status-banner"
        data-status="rejected"
      >
        <p className="eyebrow" style={{ color: 'var(--negative)' }}>
          Rejected
        </p>
        <p className="serif mt-1" style={{ fontSize: 17, fontWeight: 500 }}>
          Excluded from scoring; row retained for audit.
        </p>
      </div>
    );
  }
  return (
    <div
      className="border bg-paper-2 p-4"
      style={{ borderColor: 'var(--rule)' }}
      data-testid="review-status-banner"
      data-status="pending"
    >
      <p className="eyebrow">Pending review</p>
      <p
        className="serif mt-1"
        style={{ fontSize: 14, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.45 }}
      >
        Read the source sentence; verify that the raw value matches; approve to flow it into the
        public composite, or reject to leave the indicator empty.
      </p>
    </div>
  );
}
