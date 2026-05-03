import { db, methodologyVersions } from '@gtmi/db';
import { desc } from 'drizzle-orm';
import { updateMethodologyChangeNotes } from './actions';

export const dynamic = 'force-dynamic';

interface MethodologyRow {
  id: string;
  versionTag: string;
  publishedAt: Date | null;
  calibratedAt: Date | null;
  calibratedNPrograms: number | null;
  changeNotes: string | null;
  pillarWeights: unknown;
  subFactorWeights: unknown;
  normalizationChoices: unknown;
  cmePaqSplit: unknown;
  calibratedParams: unknown;
}

async function loadMethodologyRows(): Promise<MethodologyRow[]> {
  const rows = await db
    .select({
      id: methodologyVersions.id,
      versionTag: methodologyVersions.versionTag,
      publishedAt: methodologyVersions.publishedAt,
      calibratedAt: methodologyVersions.calibratedAt,
      calibratedNPrograms: methodologyVersions.calibratedNPrograms,
      changeNotes: methodologyVersions.changeNotes,
      pillarWeights: methodologyVersions.pillarWeights,
      subFactorWeights: methodologyVersions.subFactorWeights,
      normalizationChoices: methodologyVersions.normalizationChoices,
      cmePaqSplit: methodologyVersions.cmePaqSplit,
      calibratedParams: methodologyVersions.calibratedParams,
    })
    .from(methodologyVersions)
    .orderBy(desc(methodologyVersions.publishedAt));
  return rows;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

export default async function AdminMethodologyPage() {
  const rows = await loadMethodologyRows();

  return (
    <main className="px-8 py-8">
      <div className="max-w-5xl">
        <p className="eyebrow mb-3">Admin · Methodology</p>
        <h1 className="serif text-ink" style={{ fontSize: 36, fontWeight: 400, marginBottom: 8 }}>
          Methodology versions.
        </h1>
        <p className="text-ink-3" style={{ fontSize: 13, marginBottom: 24, maxWidth: 640 }}>
          One row per methodology version. Weights, normalization choices, and the CME/PAQ split are{' '}
          <em>not</em> editable from this UI — those are source-of-truth in{' '}
          <code className="num">packages/scoring</code> and the seed. The only thing this surface
          edits is <code className="num">change_notes</code> (the human-readable changelog) so
          analysts can record what changed without a deploy.
        </p>

        {rows.length === 0 ? (
          <p className="italic text-ink-4" style={{ fontSize: 13 }}>
            No methodology rows. Run <code className="num">pnpm seed</code> to bootstrap one.
          </p>
        ) : (
          <ul className="grid gap-6" data-testid="admin-methodology-list">
            {rows.map((r) => (
              <li
                key={r.id}
                className="border p-4"
                style={{ borderColor: 'var(--rule)' }}
                data-testid="admin-methodology-row"
                data-version-tag={r.versionTag}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
                  <div>
                    <span
                      className="serif text-ink"
                      style={{ fontSize: 18, fontWeight: 500, marginRight: 12 }}
                    >
                      {r.versionTag}
                    </span>
                    <span className="num text-ink-4" style={{ fontSize: 11 }}>
                      {r.id.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="num text-ink-3 flex gap-4" style={{ fontSize: 11 }}>
                    <span>
                      published <span className="text-ink">{formatDate(r.publishedAt)}</span>
                    </span>
                    <span>
                      calibrated <span className="text-ink">{formatDate(r.calibratedAt)}</span>
                    </span>
                    {r.calibratedNPrograms !== null && (
                      <span>
                        n=<span className="text-ink">{r.calibratedNPrograms}</span>
                      </span>
                    )}
                  </div>
                </div>

                <details className="mb-3">
                  <summary className="cursor-pointer num text-ink-3" style={{ fontSize: 11 }}>
                    Pillar weights, sub-factor weights, normalization choices, calibrated params
                    (read-only)
                  </summary>
                  <div className="grid gap-3 mt-2 md:grid-cols-2">
                    <JsonBlock label="pillar_weights" value={r.pillarWeights} />
                    <JsonBlock label="sub_factor_weights" value={r.subFactorWeights} />
                    <JsonBlock label="normalization_choices" value={r.normalizationChoices} />
                    <JsonBlock label="cme_paq_split" value={r.cmePaqSplit} />
                    {r.calibratedParams !== null && (
                      <div className="md:col-span-2">
                        <JsonBlock label="calibrated_params" value={r.calibratedParams} />
                      </div>
                    )}
                  </div>
                </details>

                <form
                  action={updateMethodologyChangeNotes}
                  className="grid gap-2"
                  data-testid="admin-methodology-notes-form"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <label className="grid gap-1">
                    <span className="text-ink-3" style={{ fontSize: 11 }}>
                      change_notes
                    </span>
                    <textarea
                      name="changeNotes"
                      defaultValue={r.changeNotes ?? ''}
                      rows={3}
                      className="border bg-paper px-2 py-1"
                      style={{ borderColor: 'var(--rule)', fontSize: 12, fontFamily: 'inherit' }}
                      data-testid="admin-methodology-notes-input"
                    />
                  </label>
                  <button
                    type="submit"
                    className="border px-3 py-1 self-start text-ink"
                    style={{ borderColor: 'var(--ink)', fontSize: 12 }}
                    data-testid="admin-methodology-notes-save"
                  >
                    Save notes
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="num text-ink-4 mb-1" style={{ fontSize: 10 }}>
        {label}
      </p>
      <pre
        className="num overflow-x-auto"
        style={{
          fontSize: 11,
          background: 'var(--rule-soft)',
          padding: '8px',
          margin: 0,
          maxHeight: 200,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
