import { db, methodologyVersions } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface VersionRow {
  id: string;
  versionTag: string;
  publishedAt: Date | null;
  pillarWeights: unknown;
  subFactorWeights: unknown;
  normalizationChoices: unknown;
  cmePaqSplit: unknown;
  calibratedParams: unknown;
  changeNotes: string | null;
}

async function loadVersion(id: string): Promise<VersionRow | null> {
  const rows = await db
    .select({
      id: methodologyVersions.id,
      versionTag: methodologyVersions.versionTag,
      publishedAt: methodologyVersions.publishedAt,
      pillarWeights: methodologyVersions.pillarWeights,
      subFactorWeights: methodologyVersions.subFactorWeights,
      normalizationChoices: methodologyVersions.normalizationChoices,
      cmePaqSplit: methodologyVersions.cmePaqSplit,
      calibratedParams: methodologyVersions.calibratedParams,
      changeNotes: methodologyVersions.changeNotes,
    })
    .from(methodologyVersions)
    .where(eq(methodologyVersions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function loadVersionList(): Promise<{ id: string; versionTag: string }[]> {
  return db
    .select({ id: methodologyVersions.id, versionTag: methodologyVersions.versionTag })
    .from(methodologyVersions)
    .orderBy(methodologyVersions.versionTag);
}

function flatten(value: unknown, prefix = ''): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (value === null || value === undefined) {
    if (prefix) out[prefix] = null;
    return out;
  }
  if (typeof value !== 'object') {
    out[prefix] = value as string | number | boolean;
    return out;
  }
  if (Array.isArray(value)) {
    out[prefix] = JSON.stringify(value);
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    Object.assign(out, flatten(v, path));
  }
  return out;
}

interface DiffRow {
  key: string;
  from: string | number | boolean | null | undefined;
  to: string | number | boolean | null | undefined;
  delta: number | null;
  changed: boolean;
}

function diffSection(label: string, fromVal: unknown, toVal: unknown): DiffSection {
  const flatFrom = flatten(fromVal);
  const flatTo = flatten(toVal);
  const keys = Array.from(new Set([...Object.keys(flatFrom), ...Object.keys(flatTo)])).sort();
  const rows: DiffRow[] = keys.map((k) => {
    const from = flatFrom[k];
    const to = flatTo[k];
    const fromN = typeof from === 'number' ? from : Number(from);
    const toN = typeof to === 'number' ? to : Number(to);
    const delta = Number.isFinite(fromN) && Number.isFinite(toN) ? toN - fromN : null;
    const changed = JSON.stringify(from) !== JSON.stringify(to);
    return { key: k, from, to, delta, changed };
  });
  const changedCount = rows.filter((r) => r.changed).length;
  return { label, rows, changedCount };
}

interface DiffSection {
  label: string;
  rows: DiffRow[];
  changedCount: number;
}

export default async function CompareMethodologyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: rawFrom, to: rawTo } = await searchParams;
  const fromId = rawFrom && UUID_RE.test(rawFrom) ? rawFrom : null;
  const toId = rawTo && UUID_RE.test(rawTo) ? rawTo : null;

  const list = await loadVersionList();

  if (!fromId || !toId) {
    return (
      <main className="px-8 py-8">
        <div className="max-w-3xl">
          <p className="eyebrow mb-3">
            <Link href="/admin/methodology" className="text-ink-3 hover:text-ink">
              ← Methodology versions
            </Link>
          </p>
          <h1 className="serif text-ink" style={{ fontSize: 28, fontWeight: 500, marginBottom: 6 }}>
            Compare methodology versions.
          </h1>
          <p className="text-ink-3" style={{ fontSize: 13, marginBottom: 24 }}>
            Pick a baseline and a target version. The diff shows each scalar that changed — pillar
            weights, sub-factor weights, normalization choices, the CME/PAQ split, and calibrated
            params.
          </p>
          <form method="GET" className="grid gap-3 md:grid-cols-2" data-testid="compare-form">
            <SelectField label="From" name="from" defaultValue={fromId ?? ''} options={list} />
            <SelectField label="To" name="to" defaultValue={toId ?? ''} options={list} />
            <button
              type="submit"
              className="border px-3 py-1 self-start text-ink md:col-span-2"
              style={{ borderColor: 'var(--ink)', fontSize: 12 }}
            >
              Compare
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (fromId === toId) {
    return (
      <main className="px-8 py-8">
        <p className="italic text-ink-4" style={{ fontSize: 13 }}>
          Pick two different versions to compare.{' '}
          <Link href="/admin/methodology/compare" className="text-accent hover:underline">
            ← reset
          </Link>
        </p>
      </main>
    );
  }

  const [fromRow, toRow] = await Promise.all([loadVersion(fromId), loadVersion(toId)]);
  if (!fromRow || !toRow) {
    return (
      <main className="px-8 py-8">
        <p className="italic text-ink-4" style={{ fontSize: 13 }}>
          One or both versions not found.{' '}
          <Link href="/admin/methodology/compare" className="text-accent hover:underline">
            ← reset
          </Link>
        </p>
      </main>
    );
  }

  const sections: DiffSection[] = [
    diffSection('pillar_weights', fromRow.pillarWeights, toRow.pillarWeights),
    diffSection('sub_factor_weights', fromRow.subFactorWeights, toRow.subFactorWeights),
    diffSection('normalization_choices', fromRow.normalizationChoices, toRow.normalizationChoices),
    diffSection('cme_paq_split', fromRow.cmePaqSplit, toRow.cmePaqSplit),
    diffSection('calibrated_params', fromRow.calibratedParams, toRow.calibratedParams),
  ];

  return (
    <main className="px-8 py-8">
      <div className="max-w-5xl">
        <p className="eyebrow mb-3">
          <Link href="/admin/methodology" className="text-ink-3 hover:text-ink">
            ← Methodology versions
          </Link>
        </p>
        <h1 className="serif text-ink" style={{ fontSize: 28, fontWeight: 500, marginBottom: 6 }}>
          {fromRow.versionTag} → {toRow.versionTag}
        </h1>
        <p className="text-ink-3 mb-6" style={{ fontSize: 13 }}>
          {sections.reduce((sum, s) => sum + s.changedCount, 0)} fields changed across{' '}
          {sections.length} sections.
        </p>

        <div className="grid gap-8" data-testid="methodology-compare-sections">
          {sections.map((sec) => (
            <DiffTable key={sec.label} section={sec} />
          ))}
        </div>
      </div>
    </main>
  );
}

function DiffTable({ section }: { section: DiffSection }) {
  return (
    <section
      data-testid="methodology-compare-section"
      data-section-label={section.label}
      data-section-changed={section.changedCount}
    >
      <h2
        className="serif text-ink mb-2 flex items-baseline gap-3"
        style={{ fontSize: 16, fontWeight: 500 }}
      >
        <code className="num">{section.label}</code>
        <span className="num text-ink-4" style={{ fontSize: 11 }}>
          {section.changedCount} changed
        </span>
      </h2>
      {section.rows.length === 0 ? (
        <p className="italic text-ink-4" style={{ fontSize: 12 }}>
          Empty in both versions.
        </p>
      ) : (
        <table className="gtmi tabular w-full">
          <thead>
            <tr>
              <th>Path</th>
              <th style={{ textAlign: 'right' }}>From</th>
              <th style={{ textAlign: 'right' }}>To</th>
              <th style={{ textAlign: 'right', width: 90 }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((r) => (
              <tr
                key={r.key}
                data-testid="diff-row"
                data-changed={r.changed ? 'true' : 'false'}
                style={r.changed ? { background: 'rgba(184,65,42,0.04)' } : undefined}
              >
                <td>
                  <code className="num text-ink-3" style={{ fontSize: 11 }}>
                    {r.key}
                  </code>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <ScalarCell value={r.from} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <ScalarCell value={r.to} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  {r.delta === null ? (
                    <span className="num text-ink-5" style={{ fontSize: 11 }}>
                      —
                    </span>
                  ) : (
                    <span
                      className="num"
                      style={{
                        fontSize: 11,
                        color: r.delta === 0 ? 'var(--ink-4)' : 'var(--ink)',
                      }}
                    >
                      {r.delta > 0 ? '+' : ''}
                      {Number.isInteger(r.delta) ? r.delta : r.delta.toFixed(4)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ScalarCell({ value }: { value: string | number | boolean | null | undefined }) {
  if (value === undefined) {
    return (
      <span className="num text-ink-5" style={{ fontSize: 11, fontStyle: 'italic' }}>
        absent
      </span>
    );
  }
  if (value === null) {
    return (
      <span className="num text-ink-5" style={{ fontSize: 11 }}>
        null
      </span>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <span className="num text-ink" style={{ fontSize: 11 }}>
        {String(value)}
      </span>
    );
  }
  return (
    <span className="num text-ink" style={{ fontSize: 11 }}>
      {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(4) : String(value)}
    </span>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { id: string; versionTag: string }[];
}) {
  return (
    <label className="grid gap-1">
      <span className="text-ink-3" style={{ fontSize: 11 }}>
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        required
        className="border bg-paper px-2 py-1"
        style={{ borderColor: 'var(--rule)', fontSize: 12 }}
      >
        <option value="">— pick —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.versionTag}
          </option>
        ))}
      </select>
    </label>
  );
}
