import { db, programs, countries } from '@gtmi/db';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { createProgram } from './actions';

export const dynamic = 'force-dynamic';

interface ProgramRow {
  id: string;
  name: string;
  countryIso: string;
  countryName: string;
  category: string;
  status: string;
  launchYear: number | null;
  closureYear: number | null;
  updatedAt: Date;
}

interface CountryOption {
  isoCode: string;
  name: string;
}

async function loadProgramRows(): Promise<ProgramRow[]> {
  const rows = await db
    .select({
      id: programs.id,
      name: programs.name,
      countryIso: programs.countryIso,
      countryName: countries.name,
      category: programs.category,
      status: programs.status,
      launchYear: programs.launchYear,
      closureYear: programs.closureYear,
      updatedAt: programs.updatedAt,
    })
    .from(programs)
    .innerJoin(countries, eq(countries.isoCode, programs.countryIso))
    .orderBy(asc(programs.countryIso), asc(programs.name));
  return rows;
}

async function loadCountryOptions(): Promise<CountryOption[]> {
  return db
    .select({ isoCode: countries.isoCode, name: countries.name })
    .from(countries)
    .orderBy(asc(countries.name));
}

export default async function AdminProgramsPage() {
  const [rows, countryOptions] = await Promise.all([loadProgramRows(), loadCountryOptions()]);

  return (
    <main className="px-8 py-8">
      <div className="max-w-5xl">
        <p className="eyebrow mb-3">Admin · Programmes</p>
        <h1 className="serif text-ink" style={{ fontSize: 36, fontWeight: 400, marginBottom: 8 }}>
          Programme registry.
        </h1>
        <p className="text-ink-3" style={{ fontSize: 13, marginBottom: 24, maxWidth: 640 }}>
          {rows.length} programme{rows.length === 1 ? '' : 's'} across {countryOptions.length}{' '}
          countries. Hand-edit name / category / status / launch & closure years here; field-values
          and sources are populated by the extraction pipeline.{' '}
          <code className="num">country_iso</code> is pinned after creation — to move a programme to
          another country, delete and recreate.
        </p>

        <section className="mb-10 border p-4" style={{ borderColor: 'var(--rule)' }}>
          <h2 className="serif text-ink" style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
            Create programme.
          </h2>
          <form
            action={createProgram}
            className="grid gap-3 md:grid-cols-2"
            data-testid="admin-program-create-form"
          >
            <Field label="Name" name="name" required />
            <SelectField label="Country" name="countryIso" required>
              <option value="">— select —</option>
              {countryOptions.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name} ({c.isoCode})
                </option>
              ))}
            </SelectField>
            <Field label="Category" name="category" required />
            <SelectField label="Status" name="status" required defaultValue="active">
              <option value="active">active</option>
              <option value="closed">closed</option>
              <option value="proposed">proposed</option>
              <option value="paused">paused</option>
            </SelectField>
            <Field label="Launch year" name="launchYear" type="number" min={1900} max={2100} />
            <Field label="Closure year" name="closureYear" type="number" min={1900} max={2100} />
            <button
              type="submit"
              className="border px-3 py-1 self-start text-ink md:col-span-2"
              style={{ borderColor: 'var(--ink)', fontSize: 12 }}
              data-testid="admin-program-create-submit"
            >
              Create
            </button>
          </form>
        </section>

        {rows.length === 0 ? (
          <p className="italic text-ink-4" style={{ fontSize: 13 }}>
            Registry is empty. Use the form above to add the first programme.
          </p>
        ) : (
          <div className="w-full overflow-x-auto" data-testid="admin-programs-table">
            <table className="gtmi tabular w-full">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Programme</th>
                  <th style={{ width: 140 }}>Category</th>
                  <th style={{ width: 90 }}>Status</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Launch</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Closure</th>
                  <th style={{ width: 60 }} aria-hidden></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-testid="admin-program-row" data-program-id={r.id}>
                    <td>
                      <span className="num text-ink-3" style={{ fontSize: 11 }}>
                        {r.countryIso} · {r.countryName}
                      </span>
                    </td>
                    <td>
                      <span className="serif text-ink" style={{ fontSize: 14, fontWeight: 500 }}>
                        {r.name}
                      </span>
                    </td>
                    <td>
                      <span className="num text-ink-3" style={{ fontSize: 11 }}>
                        {r.category}
                      </span>
                    </td>
                    <td>
                      <StatusChip status={r.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="num text-ink-3" style={{ fontSize: 11 }}>
                        {r.launchYear ?? '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="num text-ink-3" style={{ fontSize: 11 }}>
                        {r.closureYear ?? '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/admin/programs/${r.id}`}
                        className="btn-link num"
                        style={{ fontSize: 11 }}
                      >
                        Edit ›
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { className: string; label: string }> = {
    active: { className: 'chip chip-mute', label: 'active' },
    closed: { className: 'chip chip-accent', label: 'closed' },
    paused: { className: 'chip chip-accent', label: 'paused' },
    proposed: { className: 'chip chip-mute', label: 'proposed' },
  };
  const entry = map[status] ?? { className: 'chip chip-mute', label: status };
  return <span className={entry.className}>{entry.label}</span>;
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  min,
  max,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  defaultValue?: string | number;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-ink-3" style={{ fontSize: 11 }}>
        {label}
        {required && ' *'}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="border bg-paper px-2 py-1"
        style={{ borderColor: 'var(--rule)', fontSize: 12 }}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  required = false,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-ink-3" style={{ fontSize: 11 }}>
        {label}
        {required && ' *'}
      </span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="border bg-paper px-2 py-1"
        style={{ borderColor: 'var(--rule)', fontSize: 12 }}
      >
        {children}
      </select>
    </label>
  );
}
