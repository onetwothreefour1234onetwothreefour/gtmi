import { db, programs, countries } from '@gtmi/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateProgram } from '../actions';

export const dynamic = 'force-dynamic';

interface ProgramDetail {
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

async function loadProgramDetail(id: string): Promise<ProgramDetail | null> {
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
    .where(eq(programs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export default async function AdminProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadProgramDetail(id);
  if (!detail) notFound();

  return (
    <main className="px-8 py-8">
      <div className="max-w-3xl">
        <p className="eyebrow mb-3">
          <Link href="/admin/programs" className="text-ink-3 hover:text-ink">
            ← All programmes
          </Link>
        </p>
        <h1 className="serif text-ink" style={{ fontSize: 28, fontWeight: 500, marginBottom: 4 }}>
          {detail.name}
        </h1>
        <p className="num text-ink-4 mb-6" style={{ fontSize: 11 }}>
          {detail.countryIso} · {detail.countryName} · {detail.id.slice(0, 8)}…
        </p>

        <form
          action={updateProgram}
          className="grid gap-4"
          data-testid="admin-program-edit-form"
          data-program-id={detail.id}
        >
          <input type="hidden" name="id" value={detail.id} />

          <Field label="Name" name="name" required defaultValue={detail.name} />
          <Field label="Category" name="category" required defaultValue={detail.category} />
          <SelectField label="Status" name="status" required defaultValue={detail.status}>
            <option value="active">active</option>
            <option value="closed">closed</option>
            <option value="proposed">proposed</option>
            <option value="paused">paused</option>
          </SelectField>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Launch year"
              name="launchYear"
              type="number"
              min={1900}
              max={2100}
              defaultValue={detail.launchYear ?? undefined}
            />
            <Field
              label="Closure year"
              name="closureYear"
              type="number"
              min={1900}
              max={2100}
              defaultValue={detail.closureYear ?? undefined}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="border px-3 py-1 text-ink"
              style={{ borderColor: 'var(--ink)', fontSize: 12 }}
              data-testid="admin-program-edit-submit"
            >
              Save changes
            </button>
            <Link
              href={`/programs/${detail.id}`}
              className="btn-link num"
              style={{ fontSize: 11 }}
              target="_blank"
              rel="noreferrer"
            >
              Open public page ↗
            </Link>
          </div>
        </form>

        <p className="num text-ink-4 mt-8" style={{ fontSize: 10 }}>
          Last updated {detail.updatedAt.toISOString()}
        </p>
      </div>
    </main>
  );
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
