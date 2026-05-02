import { db, blockerDomains, programs } from '@gtmi/db';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { addManualBlocker, clearBlocker } from './actions';

export const dynamic = 'force-dynamic';

interface BlockerRow {
  domain: string;
  firstDetectedAt: Date;
  lastSeenAt: Date;
  detectionSignal: string;
  detectedForProgramId: string | null;
  notes: Record<string, unknown> | null;
  programName: string | null;
  programCountryIso: string | null;
}

async function loadBlockerRows(): Promise<BlockerRow[]> {
  const rows = await db
    .select({
      domain: blockerDomains.domain,
      firstDetectedAt: blockerDomains.firstDetectedAt,
      lastSeenAt: blockerDomains.lastSeenAt,
      detectionSignal: blockerDomains.detectionSignal,
      detectedForProgramId: blockerDomains.detectedForProgramId,
      notes: blockerDomains.notes,
      programName: programs.name,
      programCountryIso: programs.countryIso,
    })
    .from(blockerDomains)
    .leftJoin(programs, eq(blockerDomains.detectedForProgramId, programs.id))
    .orderBy(desc(blockerDomains.lastSeenAt));
  return rows.map((r) => ({
    domain: r.domain,
    firstDetectedAt: r.firstDetectedAt,
    lastSeenAt: r.lastSeenAt,
    detectionSignal: r.detectionSignal,
    detectedForProgramId: r.detectedForProgramId,
    notes: (r.notes as Record<string, unknown> | null) ?? null,
    programName: r.programName,
    programCountryIso: r.programCountryIso,
  }));
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function describeSignal(signal: string): string {
  switch (signal) {
    case 'hash_equality':
      return 'Hash-equality (≥2 paths returned identical content_hash)';
    case 'thin_fanout':
      return 'Thin-fanout (≥2 paths returned thin content with HTTP 200)';
    case 'challenge_fanout':
      return 'Challenge-fanout (≥2 paths hit the challenge marker)';
    case 'manual_override':
      return 'Manual override (analyst-flagged)';
    default:
      return signal;
  }
}

export default async function AdminBlockersPage() {
  const rows = await loadBlockerRows();

  return (
    <main className="px-8 py-8">
      <div className="max-w-5xl">
        <h1 className="serif text-ink" style={{ fontSize: 28, fontWeight: 500, marginBottom: 6 }}>
          Anti-bot blocker registry.
        </h1>
        <p className="text-ink-3" style={{ fontSize: 13, marginBottom: 24 }}>
          {rows.length} domain{rows.length === 1 ? '' : 's'} flagged. Auto-populated by W15
          detection (hash-equality / thin-fanout / challenge-fanout signals across ≥2 paths from one
          domain in a single canary run). Subsequent canary runs route matching domains through
          Wayback first; a Trigger.dev cron rechecks weekly and clears rows whose sites have fixed
          their walls.
        </p>

        {rows.length === 0 ? (
          <p className="italic text-ink-4" style={{ fontSize: 13 }}>
            Registry is empty. Either the cohort is healthy, or W15 hasn&apos;t had a chance to run
            yet.
          </p>
        ) : (
          <div className="w-full overflow-x-auto" data-testid="admin-blockers-table">
            <table className="gtmi tabular w-full">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th style={{ width: 160 }}>Signal</th>
                  <th style={{ width: 120 }}>First detected</th>
                  <th style={{ width: 120 }}>Last seen</th>
                  <th>Triggering programme</th>
                  <th style={{ width: 100, textAlign: 'right' }} aria-hidden></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.domain}
                    data-testid="admin-blocker-row"
                    data-signal={r.detectionSignal}
                  >
                    <td>
                      <span className="num text-ink" style={{ fontSize: 12 }}>
                        {r.domain}
                      </span>
                    </td>
                    <td>
                      <span
                        className="num text-ink-3"
                        style={{ fontSize: 11 }}
                        title={describeSignal(r.detectionSignal)}
                      >
                        {r.detectionSignal}
                      </span>
                    </td>
                    <td>
                      <span className="num text-ink-3" style={{ fontSize: 11 }}>
                        {formatDate(r.firstDetectedAt)}
                      </span>
                    </td>
                    <td>
                      <span className="num text-ink-3" style={{ fontSize: 11 }}>
                        {formatDate(r.lastSeenAt)}
                      </span>
                    </td>
                    <td>
                      {r.detectedForProgramId && r.programName ? (
                        <Link
                          href={`/programs/${r.detectedForProgramId}`}
                          className="serif hover:text-accent"
                          style={{ fontSize: 13 }}
                        >
                          {r.programCountryIso} · {r.programName}
                        </Link>
                      ) : (
                        <span className="italic text-ink-5" style={{ fontSize: 11 }}>
                          {r.detectionSignal === 'manual_override' ? '(manual)' : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <form action={clearBlocker}>
                        <input type="hidden" name="domain" value={r.domain} />
                        <button
                          type="submit"
                          className="btn-link num"
                          style={{ fontSize: 11 }}
                          aria-label={`Clear ${r.domain}`}
                          data-testid="admin-blocker-clear"
                        >
                          Clear ›
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-12 max-w-xl">
          <h2 className="serif text-ink" style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>
            Add a manual override.
          </h2>
          <p className="text-ink-3" style={{ fontSize: 13, marginBottom: 12 }}>
            Use this when an analyst has verified a domain is hostile to scraping but W15
            hasn&apos;t observed enough paths to fire automatically. Stays flagged until cleared
            (manually or by the weekly recheck).
          </p>
          <form
            action={addManualBlocker}
            className="grid gap-3"
            data-testid="admin-blocker-add-form"
          >
            <label className="grid gap-1 text-data-sm">
              <span className="text-ink-3" style={{ fontSize: 11 }}>
                Domain
              </span>
              <input
                type="text"
                name="domain"
                placeholder="www.example.gov"
                required
                pattern="[A-Za-z0-9.\-]+"
                className="border bg-paper px-2 py-1 num"
                style={{ borderColor: 'var(--rule)', fontSize: 12 }}
              />
            </label>
            <label className="grid gap-1 text-data-sm">
              <span className="text-ink-3" style={{ fontSize: 11 }}>
                Note (optional)
              </span>
              <input
                type="text"
                name="note"
                placeholder="e.g. Cloudflare wall observed across all /en/ paths"
                className="border bg-paper px-2 py-1"
                style={{ borderColor: 'var(--rule)', fontSize: 12 }}
              />
            </label>
            <button
              type="submit"
              className="border px-3 py-1 self-start text-ink"
              style={{ borderColor: 'var(--ink)', fontSize: 12 }}
            >
              Add blocker
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
