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
import { rescoreFieldValue } from '@/app/(internal)/review/rescore-actions';
import { reextractFieldValue } from '@/app/(internal)/review/reextract-actions';

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

// Phase 3.8 / P2.5 — surface the publish-time gate reason. publish.ts
// stamps provenance.normalizationError with `missing_provenance`,
// `out_of_sanity_range: ...`, or `normalize_failed: ...` when a row is
// forced to pending_review; show that to the analyst so the reason is
// obvious without expanding the provenance JSON block.
function readNormalizationError(raw: unknown): string | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>).normalizationError;
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

// Phase 3.8 / P2 — extract the rubric vocabulary for rubric-aware
// editor rendering. Returns an array of {value, description} when the
// rubric is the canonical {categories: [...]} shape, else null.
interface RubricCategory {
  value: string;
  description?: string;
  score?: number;
}
function readRubricCategories(rubric: unknown): RubricCategory[] | null {
  if (!rubric || typeof rubric !== 'object') return null;
  const cats = (rubric as { categories?: unknown }).categories;
  if (!Array.isArray(cats)) return null;
  return cats
    .filter(
      (c): c is RubricCategory =>
        typeof c === 'object' && c !== null && typeof (c as RubricCategory).value === 'string'
    )
    .map((c) => ({ value: c.value, description: c.description, score: c.score }));
}

// Phase 3.8 / P2 — sanity-range hints for numeric editor inputs.
// Mirrors NUMERIC_SANITY_RANGES in @gtmi/extraction; duplicated here to
// avoid pulling the extraction package into the web bundle. If these
// drift, the publish-time gate is still authoritative — the UI hints
// are advisory only.
const NUMERIC_HINTS: Record<string, { min: number; max: number; unit?: string }> = {
  'A.1.1': { min: 0, max: 1000, unit: '% of local median wage' },
  'A.1.3': { min: 0, max: 30, unit: 'years (work experience)' },
  'A.1.5': { min: 0, max: 999, unit: 'years (999 = no cap)' },
  'A.2.1': { min: 0, max: 20, unit: 'mandatory criteria' },
  'A.2.3': { min: 0, max: 20, unit: 'qualifying tracks' },
  'B.1.1': { min: 0, max: 3650, unit: 'days (standard SLA)' },
  'B.2.1': { min: 0, max: 50, unit: 'steps' },
  'B.2.2': { min: 0, max: 20, unit: 'in-person touchpoints' },
  'B.3.1': { min: 0, max: 1_000_000, unit: 'USD (principal + 1 spouse + 2 children)' },
  'C.2.2': { min: 0, max: 999, unit: 'years (999 = no cap)' },
  'D.1.2': { min: 0, max: 50, unit: 'years' },
  'D.2.2': { min: 0, max: 99, unit: 'years' },
  'D.3.1': { min: 0, max: 366, unit: 'days/year' },
  'E.1.1': { min: 0, max: 1000, unit: 'severity-weighted count' },
  'E.1.3': { min: 0, max: 200, unit: 'years' },
  'E.3.1': { min: -5, max: 5, unit: 'WGI score' },
  'E.3.2': { min: -5, max: 5, unit: 'WGI score' },
};

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

  // Phase 3.8 / ADR-020 — recompute value_indicator_score for this row
  // from the stored value_normalized + current PHASE2_PLACEHOLDER_PARAMS.
  async function rescore(fd: FormData): Promise<void> {
    'use server';
    const fvId = (fd.get('id') as string | null) ?? '';
    if (!fvId) throw new Error('rescore: missing field_value id');
    await rescoreFieldValue(fvId);
  }

  // Phase 3.8 / P3.5 — re-run extraction against the cached scrape with
  // a rubric-grounded focused prompt that includes the previous valueRaw
  // and the analyst's reject reason. Routes the new value back through
  // pending_review.
  async function reextract(fd: FormData): Promise<void> {
    'use server';
    const fvId = (fd.get('id') as string | null) ?? '';
    if (!fvId) throw new Error('reextract: missing field_value id');
    const reason = (fd.get('reason') as string | null)?.trim() || undefined;
    await reextractFieldValue(fvId, reason);
  }

  const isPending = row.status === 'pending_review';
  const isApproved = row.status === 'approved';
  const isRejected = row.status === 'rejected';
  const charOffsets = readCharOffsets(row.provenance);
  const sourceTier = row.sourceTier ?? readSourceTier(row.provenance);
  const scrapedAt = readScrapedAt(row.provenance);
  const normalizationError = readNormalizationError(row.provenance);

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

        {normalizationError && (
          <section
            className="mb-6 border bg-paper p-4"
            style={{ borderColor: 'var(--warning)' }}
            data-testid="review-gate-reason"
          >
            <p className="eyebrow" style={{ color: 'var(--warning)' }}>
              Why this is in review
            </p>
            <p className="serif mt-1" style={{ fontSize: 14, lineHeight: 1.45 }}>
              {normalizationError.startsWith('missing_provenance') ? (
                <>
                  The extractor returned a value but no source sentence to back it up. Verify the
                  value against the source URL below before approving.
                </>
              ) : normalizationError.startsWith('out_of_sanity_range') ? (
                <>
                  The extracted numeric is outside the field&apos;s sanity range —{' '}
                  <span className="num">{normalizationError}</span>. Likely an LLM unit / format
                  error; correct the raw value before approving.
                </>
              ) : normalizationError.startsWith('normalize_failed') ? (
                <>
                  Normalisation rejected the raw value:{' '}
                  <span className="num">{normalizationError}</span>. Edit the raw to match the
                  field&apos;s expected shape, or reject.
                </>
              ) : (
                <span className="num">{normalizationError}</span>
              )}
            </p>
          </section>
        )}

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

        {readRubricCategories(row.scoringRubricJsonb) && (
          <section
            className="mb-6 border bg-paper-2 p-4"
            style={{ borderColor: 'var(--rule)' }}
            data-testid="review-rubric-pinned"
          >
            <p className="eyebrow mb-2">Allowed values</p>
            <ul className="text-data-sm" style={{ lineHeight: 1.5 }}>
              {readRubricCategories(row.scoringRubricJsonb)!.map((c) => (
                <li key={c.value} className="flex gap-3">
                  <span className="num text-ink" style={{ minWidth: 140 }}>
                    {c.value}
                    {typeof c.score === 'number' ? ` (${c.score})` : ''}
                  </span>
                  <span className="text-ink-3">{c.description ?? ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
            <RubricAwareEditor
              normalizationFn={row.normalizationFn}
              fieldKey={row.fieldKey}
              currentRaw={row.valueRaw ?? ''}
              rubric={readRubricCategories(row.scoringRubricJsonb)}
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
          className="mb-6 flex flex-wrap items-center gap-3 border bg-paper-2 p-4"
          style={{ borderColor: 'var(--rule)' }}
          data-testid="review-detail-rescore"
        >
          <div className="grow text-data-sm text-ink-3">
            <p className="eyebrow mb-1">Re-score this row</p>
            <p>
              Recompute <span className="num">value_indicator_score</span> from the stored
              normalised value using the current{' '}
              <span className="num">PHASE2_PLACEHOLDER_PARAMS</span>. Use after a calibration
              commit, or when the displayed score looks stale.
            </p>
          </div>
          <form action={rescore}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="btn" data-testid="rescore-button">
              Re-score
            </button>
          </form>
        </section>

        <section
          className="mb-6 flex flex-wrap items-center gap-3 border bg-paper-2 p-4"
          style={{ borderColor: 'var(--rule)' }}
          data-testid="review-detail-reextract"
        >
          <div className="grow text-data-sm text-ink-3">
            <p className="eyebrow mb-1">Re-extract from source</p>
            <p>
              Re-runs the LLM against the cached scrape with a focused prompt that includes the
              rubric vocabulary, the previous <span className="num">value_raw</span>, and any reason
              you supply below. The new value comes back as{' '}
              <span className="num">pending_review</span>.
            </p>
          </div>
          <form action={reextract} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <input
              name="reason"
              type="text"
              maxLength={300}
              placeholder="Why was the previous value wrong? (optional)"
              className="num border bg-paper p-2 text-data-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ borderColor: 'var(--rule)', fontSize: 12, minWidth: 280 }}
            />
            <button type="submit" className="btn" data-testid="reextract-button">
              Re-extract
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

// Phase 3.8 / P2 — rubric-aware editor. Switches the input shape based
// on the field's normalizationFn so the analyst always sees the legal
// vocabulary (or the legal numeric range) without having to expand the
// rubric block. All shapes still post `editedRaw` so the existing
// approveFieldValue / editApprovedFieldValue server actions accept the
// payload unchanged. boolean_with_annotation falls back to a textarea
// for now (structured form is a follow-up).
function RubricAwareEditor({
  normalizationFn,
  fieldKey,
  currentRaw,
  rubric,
}: {
  normalizationFn: string;
  fieldKey: string;
  currentRaw: string;
  rubric: RubricCategory[] | null;
}) {
  const isCategoricalLike =
    normalizationFn === 'categorical' || normalizationFn === 'country_substitute_regional';

  if (isCategoricalLike && rubric && rubric.length > 0) {
    const inRubric = rubric.some((c) => c.value === currentRaw);
    return (
      <div className="flex flex-col gap-2">
        <select
          id="editedRaw"
          name="editedRaw"
          form="primary-action-form"
          defaultValue={inRubric ? currentRaw : ''}
          className="num border bg-paper p-2 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ borderColor: 'var(--rule)', fontSize: 13 }}
          data-testid="rubric-select"
        >
          {!inRubric && (
            <option value="" disabled>
              {currentRaw ? `Off-rubric: "${currentRaw}" — pick a valid value` : 'Pick a value'}
            </option>
          )}
          {rubric.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value}
              {typeof c.score === 'number' ? ` — ${c.score}` : ''}
              {c.description ? ` · ${c.description}` : ''}
            </option>
          ))}
        </select>
        {!inRubric && currentRaw && (
          <p className="text-data-sm text-warning">
            Stored raw <span className="num">&quot;{currentRaw}&quot;</span> is not in the rubric.
            Pick the correct value above; the form will overwrite it on save.
          </p>
        )}
      </div>
    );
  }

  if (normalizationFn === 'boolean') {
    const truthy = currentRaw === 'true' || currentRaw.toLowerCase() === 'permitted';
    const falsy = currentRaw === 'false' || currentRaw.toLowerCase() === 'not_permitted';
    return (
      <select
        id="editedRaw"
        name="editedRaw"
        form="primary-action-form"
        defaultValue={truthy ? 'true' : falsy ? 'false' : ''}
        className="num border bg-paper p-2 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ borderColor: 'var(--rule)', fontSize: 13 }}
        data-testid="boolean-select"
      >
        <option value="" disabled>
          Pick true / false
        </option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (normalizationFn === 'min_max' || normalizationFn === 'z_score') {
    const hint = NUMERIC_HINTS[fieldKey];
    return (
      <div className="flex flex-col gap-1">
        <input
          id="editedRaw"
          name="editedRaw"
          form="primary-action-form"
          type="text"
          inputMode="decimal"
          defaultValue={currentRaw}
          className="num border bg-paper p-2 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ borderColor: 'var(--rule)', fontSize: 13 }}
          data-testid="numeric-input"
        />
        {hint && (
          <p className="text-data-sm text-ink-4">
            Range: <span className="num">{hint.min}</span> – <span className="num">{hint.max}</span>
            {hint.unit ? ` (${hint.unit})` : ''}. Values outside this range route the row back to
            review with score=null.
          </p>
        )}
      </div>
    );
  }

  // boolean_with_annotation and any unknown shape — keep the textarea
  // so the analyst can paste the structured JSON. A structured form
  // editor is a follow-up.
  return (
    <textarea
      id="editedRaw"
      name="editedRaw"
      form="primary-action-form"
      defaultValue={currentRaw}
      rows={3}
      className="num border bg-paper p-2 text-data-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ borderColor: 'var(--rule)', fontSize: 13 }}
      data-testid="textarea-fallback"
    />
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
