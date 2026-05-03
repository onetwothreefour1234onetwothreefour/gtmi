import { db, digestRecipients } from '@gtmi/db';
import { asc } from 'drizzle-orm';
import { createDigestRecipient, deleteDigestRecipient, toggleDigestRecipient } from './actions';

export const dynamic = 'force-dynamic';

interface RecipientRow {
  id: string;
  tenantId: string | null;
  email: string;
  active: boolean;
  severityFilter: unknown;
  countryIsoFilter: unknown;
  createdAt: Date;
  updatedAt: Date;
}

async function loadRows(): Promise<RecipientRow[]> {
  return db
    .select({
      id: digestRecipients.id,
      tenantId: digestRecipients.tenantId,
      email: digestRecipients.email,
      active: digestRecipients.active,
      severityFilter: digestRecipients.severityFilter,
      countryIsoFilter: digestRecipients.countryIsoFilter,
      createdAt: digestRecipients.createdAt,
      updatedAt: digestRecipients.updatedAt,
    })
    .from(digestRecipients)
    .orderBy(asc(digestRecipients.email));
}

function readStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? out : null;
}

export default async function AdminDigestRecipientsPage() {
  const rows = await loadRows();
  const envFallback = process.env['RESEND_RECIPIENTS'] ?? '';
  const usingFallback = rows.filter((r) => r.active).length === 0 && envFallback.trim().length > 0;

  return (
    <main className="px-8 py-8">
      <div className="max-w-5xl">
        <p className="eyebrow mb-3">Admin · Digest recipients</p>
        <h1 className="serif text-ink" style={{ fontSize: 36, fontWeight: 400, marginBottom: 8 }}>
          Resend digest recipients.
        </h1>
        <p className="text-ink-3" style={{ fontSize: 13, marginBottom: 24, maxWidth: 640 }}>
          {rows.length} recipient{rows.length === 1 ? '' : 's'} on file ·{' '}
          {rows.filter((r) => r.active).length} active. The daily{' '}
          <code className="num">policy-digest</code> Trigger.dev cron sends per-recipient mail with
          optional severity + country filters. Empty filters = receive everything.{' '}
          <code className="num">tenant_id</code> stays NULL until ADR-027 step 2 lights up Firebase
          Auth + tenant claims.
        </p>

        {usingFallback && (
          <div
            className="mb-6 border p-3"
            style={{ borderColor: '#E0C896', background: '#FBF3DC', color: 'var(--ink-2)' }}
            role="note"
            data-testid="env-fallback-banner"
          >
            <p className="text-data-sm">
              <strong>No active rows.</strong> The cron is currently using{' '}
              <code className="num">RESEND_RECIPIENTS</code> as a fallback (
              {envFallback.split(',').filter((s) => s.trim().length > 0).length} recipient
              {envFallback.split(',').filter((s) => s.trim().length > 0).length === 1 ? '' : 's'}).
              Add a row below to take over from the env var.
            </p>
          </div>
        )}

        <section className="mb-10 border p-4" style={{ borderColor: 'var(--rule)' }}>
          <h2 className="serif text-ink" style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
            Add recipient.
          </h2>
          <p className="text-ink-4 mb-3" style={{ fontSize: 11 }}>
            Severity values: breaking · material · minor · url_broken · imd_refresh
            {' · '}country values: 3-letter ISO codes. Comma-separated, leave empty for "all".
          </p>
          <form
            action={createDigestRecipient}
            className="grid gap-3 md:grid-cols-2"
            data-testid="admin-digest-create-form"
          >
            <Field label="Email" name="email" required type="email" />
            <Field
              label="Severity filter"
              name="severityFilter"
              placeholder="e.g. breaking,material"
            />
            <Field label="Country filter" name="countryIsoFilter" placeholder="e.g. AUS,GBR,USA" />
            <button
              type="submit"
              className="border px-3 py-1 self-start text-ink md:col-span-2"
              style={{ borderColor: 'var(--ink)', fontSize: 12 }}
              data-testid="admin-digest-create-submit"
            >
              Add recipient
            </button>
          </form>
        </section>

        {rows.length === 0 ? (
          <p className="italic text-ink-4" style={{ fontSize: 13 }}>
            No recipients on file. Use the form above to add the first one.
          </p>
        ) : (
          <div className="w-full overflow-x-auto" data-testid="admin-digest-table">
            <table className="gtmi tabular w-full">
              <thead>
                <tr>
                  <th>Email</th>
                  <th style={{ width: 180 }}>Severity</th>
                  <th style={{ width: 180 }}>Countries</th>
                  <th style={{ width: 90 }}>Status</th>
                  <th style={{ width: 100 }}>Updated</th>
                  <th style={{ width: 90 }} aria-hidden></th>
                  <th style={{ width: 70 }} aria-hidden></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sev = readStringArray(r.severityFilter);
                  const country = readStringArray(r.countryIsoFilter);
                  return (
                    <tr
                      key={r.id}
                      data-testid="admin-digest-row"
                      data-recipient-id={r.id}
                      data-active={r.active ? 'true' : 'false'}
                      style={r.active ? undefined : { opacity: 0.5 }}
                    >
                      <td>
                        <span className="num text-ink" style={{ fontSize: 12 }}>
                          {r.email}
                        </span>
                        {r.tenantId && (
                          <p className="num text-ink-4" style={{ fontSize: 10 }}>
                            tenant: {r.tenantId}
                          </p>
                        )}
                      </td>
                      <td>
                        <FilterChips values={sev} />
                      </td>
                      <td>
                        <FilterChips values={country} />
                      </td>
                      <td>
                        <span className={`chip ${r.active ? 'chip-mute' : 'chip-accent'}`}>
                          {r.active ? 'active' : 'paused'}
                        </span>
                      </td>
                      <td>
                        <span className="num text-ink-3" style={{ fontSize: 11 }}>
                          {r.updatedAt.toISOString().slice(0, 10)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <form action={toggleDigestRecipient}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="active" value={r.active ? 'false' : 'true'} />
                          <button
                            type="submit"
                            className="btn-link num"
                            style={{ fontSize: 11 }}
                            data-testid="admin-digest-toggle"
                          >
                            {r.active ? 'Pause ›' : 'Activate ›'}
                          </button>
                        </form>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <form action={deleteDigestRecipient}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="btn-link num"
                            style={{ fontSize: 11, color: 'var(--accent)' }}
                            data-testid="admin-digest-delete"
                            aria-label={`Delete ${r.email}`}
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterChips({ values }: { values: string[] | null }) {
  if (!values || values.length === 0) {
    return (
      <span className="num text-ink-5" style={{ fontSize: 11, fontStyle: 'italic' }}>
        all
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {values.map((v) => (
        <span
          key={v}
          className="num text-ink-3"
          style={{
            fontSize: 10,
            background: 'var(--rule-soft)',
            padding: '1px 6px',
          }}
        >
          {v}
        </span>
      ))}
    </span>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
        className="border bg-paper px-2 py-1"
        style={{ borderColor: 'var(--rule)', fontSize: 12 }}
      />
    </label>
  );
}
