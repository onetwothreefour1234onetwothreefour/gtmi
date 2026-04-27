import Link from 'next/link';
import { listPendingReview, listRecentlyReviewed } from '@/lib/review-queries';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === 'reviewed' ? 'reviewed' : 'pending';

  const [pendingRows, recentRows] = await Promise.all([
    listPendingReview(),
    listRecentlyReviewed(20),
  ]);

  const rows = activeTab === 'pending' ? pendingRows : recentRows;

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
      </header>

      <nav className="mb-6 flex gap-1 border-b border-gray-200">
        <Link
          href="/review"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'pending'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending{' '}
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {pendingRows.length}
          </span>
        </Link>
        <Link
          href="/review?tab=reviewed"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'reviewed'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Recently Reviewed
        </Link>
      </nav>

      {rows.length === 0 ? (
        <p className="text-gray-500">
          {activeTab === 'pending' ? 'Nothing to review.' : 'No recently reviewed items.'}
        </p>
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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {activeTab === 'reviewed' && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {row.status}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {row.extractedAt?.toISOString().slice(0, 10) ?? '—'}
                      </span>
                    </div>
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
