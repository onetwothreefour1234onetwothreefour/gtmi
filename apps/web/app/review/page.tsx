import Link from 'next/link';
import { listPendingReview } from '@/lib/review-queries';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const rows = await listPendingReview();

  const groups = new Map<string, { label: string; rows: typeof rows }>();
  for (const row of rows) {
    const key = `${row.countryIso}::${row.programId}`;
    if (!groups.has(key)) {
      groups.set(key, { label: `${row.countryName} — ${row.programName}`, rows: [] });
    }
    groups.get(key)!.rows.push(row);
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <p className="text-sm text-gray-600">
          {rows.length} field value{rows.length === 1 ? '' : 's'} pending review.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-gray-500">Nothing to review.</p>
      ) : (
        Array.from(groups.entries()).map(([key, group]) => (
          <section key={key} className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">{group.label}</h2>
            <ul className="divide-y divide-gray-200 rounded border border-gray-200">
              {group.rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/review/${row.id}`}
                    className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-mono text-gray-700">
                        {row.fieldKey} · pillar {row.pillar}
                      </div>
                      <div className="text-sm text-gray-900">{row.fieldLabel}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {row.valueRaw ?? <em>(no raw value)</em>}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {row.extractedAt?.toISOString().slice(0, 10) ?? '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
