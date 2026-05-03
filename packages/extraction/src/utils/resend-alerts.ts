// Phase 3.10c.6 / 3.10d.G.4 — Resend alert plumbing.
//
// Phase 6 spec: email digests on Material/Breaking severity. The
// diff-and-classify job (Phase 3.10c.3) writes policy_changes rows;
// this helper reads the day's events and ships a digest per recipient.
//
// Recipient resolution (Phase 3.10d / G.4):
//   1. `digest_recipients` table — one row per recipient, optional
//      severity + country filters. Active rows take precedence.
//   2. `RESEND_RECIPIENTS` env var — comma-separated fallback for
//      pre-G.4 deployments. Used only when the table is empty so a
//      partial migration doesn't accidentally double-send.
//
// API knobs:
//   RESEND_API_KEY    — when unset, sendDigest returns mode='stub'
//                       and never makes outbound calls.
//   RESEND_FROM       — verified sender, e.g. "alerts@gtmi.example".
//   RESEND_RECIPIENTS — fallback recipient list (see above).

import { db, digestRecipients, policyChanges, programs, fieldDefinitions } from '@gtmi/db';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';

export type DigestMode = 'stub' | 'live' | 'unconfigured';

export interface DigestResult {
  mode: DigestMode;
  recipients: string[];
  eventCount: number;
  /** Resend message ids when mode='live', empty otherwise. */
  messageIds: string[];
  /** Reason 'unconfigured' fired, when applicable. */
  unconfiguredReason?: string;
}

export interface DigestEvent {
  programName: string;
  countryIso: string;
  fieldKey: string;
  severity: string;
  paqDelta: string | null;
  summaryText: string | null;
}

interface DigestEventRow {
  programName: string;
  countryIso: string;
  fieldKey: string;
  severity: string;
  paqDelta: string | null;
  summaryText: string | null;
}

/**
 * Read all Material + Breaking policy_changes rows from the past
 * `windowHours` (default 24).
 */
export async function loadDigestEvents(windowHours = 24): Promise<DigestEvent[]> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const rows = (await db
    .select({
      programName: programs.name,
      countryIso: programs.countryIso,
      fieldKey: fieldDefinitions.key,
      severity: policyChanges.severity,
      paqDelta: policyChanges.paqDelta,
      summaryText: policyChanges.summaryText,
    })
    .from(policyChanges)
    .innerJoin(programs, eq(programs.id, policyChanges.programId))
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, policyChanges.fieldDefinitionId))
    .where(
      and(
        gte(policyChanges.detectedAt, cutoff),
        inArray(policyChanges.severity, ['breaking', 'material'])
      )
    )
    .orderBy(
      sql`${policyChanges.severity} ASC, ${policyChanges.detectedAt} DESC`
    )) as DigestEventRow[];
  return rows;
}

function renderDigestBody(events: DigestEvent[]): string {
  if (events.length === 0) {
    return 'No Material or Breaking policy changes detected in the past 24 hours.';
  }
  const breaking = events.filter((e) => e.severity === 'breaking');
  const material = events.filter((e) => e.severity === 'material');

  const lines: string[] = ['GTMI policy-change digest', ''];
  if (breaking.length > 0) {
    lines.push(`BREAKING (${breaking.length})`);
    for (const e of breaking) {
      const delta = e.paqDelta ? ` (ΔPAQ ${e.paqDelta})` : '';
      lines.push(`  - ${e.countryIso} · ${e.programName} · ${e.fieldKey}${delta}`);
      if (e.summaryText) lines.push(`      ${e.summaryText}`);
    }
    lines.push('');
  }
  if (material.length > 0) {
    lines.push(`MATERIAL (${material.length})`);
    for (const e of material) {
      const delta = e.paqDelta ? ` (ΔPAQ ${e.paqDelta})` : '';
      lines.push(`  - ${e.countryIso} · ${e.programName} · ${e.fieldKey}${delta}`);
      if (e.summaryText) lines.push(`      ${e.summaryText}`);
    }
    lines.push('');
  }
  lines.push('Open /changes to triage.');
  return lines.join('\n');
}

function parseRecipientsEnv(): string[] {
  const raw = process.env['RESEND_RECIPIENTS'] ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface DigestRecipientResolved {
  email: string;
  tenantId: string | null;
  severityFilter: string[] | null;
  countryIsoFilter: string[] | null;
  source: 'table' | 'env';
}

/**
 * Phase 3.10d / G.4 — resolve the active recipient set. Reads
 * digest_recipients first; if empty, falls back to the env var.
 */
async function resolveRecipients(): Promise<DigestRecipientResolved[]> {
  let tableRows: {
    email: string;
    tenantId: string | null;
    severityFilter: unknown;
    countryIsoFilter: unknown;
  }[] = [];
  try {
    tableRows = await db
      .select({
        email: digestRecipients.email,
        tenantId: digestRecipients.tenantId,
        severityFilter: digestRecipients.severityFilter,
        countryIsoFilter: digestRecipients.countryIsoFilter,
      })
      .from(digestRecipients)
      .where(eq(digestRecipients.active, true));
  } catch (err) {
    // Table doesn't exist yet (pre-migration-00025) — fall through to env.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[resend] digest_recipients read failed (${msg}); falling back to env var`);
  }

  if (tableRows.length > 0) {
    return tableRows.map((r) => ({
      email: r.email,
      tenantId: r.tenantId,
      severityFilter: toStringArray(r.severityFilter),
      countryIsoFilter: toStringArray(r.countryIsoFilter),
      source: 'table' as const,
    }));
  }

  return parseRecipientsEnv().map((email) => ({
    email,
    tenantId: null,
    severityFilter: null,
    countryIsoFilter: null,
    source: 'env' as const,
  }));
}

function toStringArray(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? out : null;
}

/**
 * Phase 3.10d / G.4 — apply per-recipient filters to the day's
 * events. severityFilter null = all severities; countryIsoFilter
 * null = all countries; both null reduces to the recipient receiving
 * the unfiltered digest (the pre-G.4 behaviour).
 */
function filterEventsForRecipient(
  events: DigestEvent[],
  recipient: DigestRecipientResolved
): DigestEvent[] {
  return events.filter((e) => {
    if (recipient.severityFilter && !recipient.severityFilter.includes(e.severity)) return false;
    if (recipient.countryIsoFilter && !recipient.countryIsoFilter.includes(e.countryIso)) {
      return false;
    }
    return true;
  });
}

/**
 * Send the digest. The Resend HTTP API call is gated on a non-empty
 * RESEND_API_KEY; when absent the function returns mode='stub' and
 * does not attempt the network call. Tests + development inherit
 * stub behaviour by default.
 */
export async function sendDailyDigest(): Promise<DigestResult> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['RESEND_FROM'];
  const resolved = await resolveRecipients();
  const recipientEmails = resolved.map((r) => r.email);

  if (!apiKey || !from) {
    return {
      mode: 'unconfigured',
      recipients: recipientEmails,
      eventCount: 0,
      messageIds: [],
      unconfiguredReason: !apiKey ? 'RESEND_API_KEY missing' : 'RESEND_FROM missing',
    };
  }
  if (resolved.length === 0) {
    return {
      mode: 'unconfigured',
      recipients: [],
      eventCount: 0,
      messageIds: [],
      unconfiguredReason: 'no active digest_recipients rows and RESEND_RECIPIENTS empty',
    };
  }

  const events = await loadDigestEvents(24);
  if (events.length === 0) {
    // No events — quiet day. Don't send mail; surface in the result.
    return { mode: 'live', recipients: recipientEmails, eventCount: 0, messageIds: [] };
  }

  const messageIds: string[] = [];

  // Phase 3.10d / G.4 — per-recipient filtering: each recipient's
  // severityFilter + countryIsoFilter trim the event set to their slice
  // before rendering. A recipient who'd see zero events after filtering
  // gets no email this cycle.
  for (const recipient of resolved) {
    const filtered = filterEventsForRecipient(events, recipient);
    if (filtered.length === 0) continue;
    const body = renderDigestBody(filtered);
    const subject = `GTMI policy digest — ${filtered.length} event${filtered.length === 1 ? '' : 's'}`;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: recipient.email, subject, text: body }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(
          `[resend] ${recipient.email} failed status=${res.status} body=${errText.slice(0, 200)}`
        );
        continue;
      }
      const data = (await res.json()) as { id?: string };
      if (data.id) messageIds.push(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[resend] ${recipient.email} threw: ${msg}`);
    }
  }

  return { mode: 'live', recipients: recipientEmails, eventCount: events.length, messageIds };
}

export { filterEventsForRecipient, renderDigestBody };
