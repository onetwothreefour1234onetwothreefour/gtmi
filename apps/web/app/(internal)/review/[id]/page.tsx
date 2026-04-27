import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReviewDetail } from '@/lib/review-queries';
import { approveFieldValue, rejectFieldValue } from '@/app/(internal)/review/actions';

export const dynamic = 'force-dynamic';

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getReviewDetail(id);
  if (!row) notFound();

  // Both wrappers read `id` from a hidden form input rather than relying on
  // the closure binding. Inline server actions inside server components have
  // historically been finicky about closures across Next.js minor versions —
  // a hidden input is robust regardless.
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
    await rejectFieldValue(fvId);
  }

  const isPending = row.status === 'pending_review';
  const statusBanner =
    row.status === 'approved' ? (
      <div className="mb-6 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Approved
      </div>
    ) : row.status === 'rejected' ? (
      <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Rejected
      </div>
    ) : null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-4 text-sm">
        <Link href="/review" className="text-blue-600 hover:underline">
          ← Review Queue
        </Link>
      </div>

      <header className="mb-6">
        <p className="text-sm text-gray-500">
          {row.countryName} — {row.programName}
        </p>
        <h1 className="text-2xl font-bold">
          <span className="font-mono">{row.fieldKey}</span>
        </h1>
        <p className="mt-1 text-xs text-gray-500">{row.fieldLabel}</p>
      </header>

      {statusBanner}

      <section className="mb-6 rounded border border-gray-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Raw value</h2>
        <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">
          {row.valueRaw ?? <em className="text-gray-400">(no raw value)</em>}
        </p>

        {row.sourceSentence && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-gray-500">Source sentence</p>
            <blockquote className="border-l-2 border-gray-300 pl-3 text-sm italic text-gray-700">
              {row.sourceSentence}
            </blockquote>
          </div>
        )}

        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          {row.extractionConfidence !== null && (
            <span>
              Extraction confidence:{' '}
              <span
                className={row.extractionConfidence >= 0.85 ? 'text-green-600' : 'text-amber-600'}
              >
                {(row.extractionConfidence * 100).toFixed(0)}%
              </span>
            </span>
          )}
          {row.validationConfidence !== null && (
            <span>
              Validation confidence:{' '}
              <span
                className={row.validationConfidence >= 0.85 ? 'text-green-600' : 'text-amber-600'}
              >
                {(row.validationConfidence * 100).toFixed(0)}%
              </span>
            </span>
          )}
        </div>

        <div className="mt-3">
          <details>
            <summary className="cursor-pointer text-xs text-gray-500">
              Normalized value (JSON)
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(row.valueNormalized, null, 2)}
            </pre>
          </details>
        </div>

        <div className="mt-3">
          <details>
            <summary className="cursor-pointer text-xs text-gray-500">Provenance</summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(row.provenance, null, 2)}
            </pre>
          </details>
        </div>
      </section>

      {row.sourceUrl && (
        <section className="mb-6 rounded border border-gray-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Source</h2>
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-blue-600 hover:underline"
          >
            {row.sourceUrl}
          </a>
          {row.sourceTier && <p className="mt-1 text-xs text-gray-500">Tier {row.sourceTier}</p>}
        </section>
      )}

      {isPending && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Decision</h2>
          <div className="flex flex-col gap-3">
            <form action={approve}>
              <input type="hidden" name="id" value={id} />
              <label className="text-sm font-medium text-gray-700">
                Edit raw value before approving <span className="text-gray-400">(optional)</span>
              </label>
              <input
                name="editedRaw"
                defaultValue={row.valueRaw ?? ''}
                className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-sm"
              />
              <p className="text-xs text-gray-500">Leave unchanged to approve as-is.</p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="mt-2 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                >
                  Approve
                </button>
              </div>
            </form>

            <form action={reject}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Reject
              </button>
            </form>
          </div>
        </section>
      )}

      {row.extractionPromptMd && (
        <section className="mb-6">
          <details>
            <summary className="cursor-pointer text-sm text-gray-500">Extraction prompt</summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs">
              {row.extractionPromptMd}
            </pre>
          </details>
        </section>
      )}

      {!!row.scoringRubricJsonb && (
        <section className="mb-6">
          <details>
            <summary className="cursor-pointer text-sm text-gray-500">Scoring rubric</summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(row.scoringRubricJsonb, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
