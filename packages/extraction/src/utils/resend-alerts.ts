// Phase 3.10c.6 — Resend alert plumbing.
//
// Phase 6 spec: email digests on Material/Breaking severity. The
// diff-and-classify job (Phase 3.10c.3) writes policy_changes rows;
// this helper reads the day's events and ships a digest per recipient.
//
// Three knobs:
//   RESEND_API_KEY    — when unset, sendDigest returns mode='stub'
//                       and never makes outbound calls.
//   RESEND_FROM       — verified sender, e.g. "alerts@gtmi.example".
//   RESEND_RECIPIENTS — comma-separated list of recipient emails;
//                       when unset, no digest fires.
//
// The recipient list lands per-tenant later (Phase 7); for now a
// single env var lets the team test the pipeline end-to-end.

import { db, policyChanges, programs, fieldDefinitions } from '@gtmi/db';
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

function parseRecipients(): string[] {
  const raw = process.env['RESEND_RECIPIENTS'] ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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
  const recipients = parseRecipients();

  if (!apiKey || !from) {
    return {
      mode: 'unconfigured',
      recipients,
      eventCount: 0,
      messageIds: [],
      unconfiguredReason: !apiKey ? 'RESEND_API_KEY missing' : 'RESEND_FROM missing',
    };
  }
  if (recipients.length === 0) {
    return {
      mode: 'unconfigured',
      recipients: [],
      eventCount: 0,
      messageIds: [],
      unconfiguredReason: 'RESEND_RECIPIENTS empty',
    };
  }

  const events = await loadDigestEvents(24);
  if (events.length === 0) {
    // No events — quiet day. Don't send mail; surface in the result.
    return { mode: 'live', recipients, eventCount: 0, messageIds: [] };
  }

  const body = renderDigestBody(events);
  const subject = `GTMI policy digest — ${events.length} event${events.length === 1 ? '' : 's'}`;
  const messageIds: string[] = [];

  // Resend HTTP API: POST https://api.resend.com/emails
  for (const to of recipients) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, text: body }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[resend] ${to} failed status=${res.status} body=${errText.slice(0, 200)}`);
        continue;
      }
      const data = (await res.json()) as { id?: string };
      if (data.id) messageIds.push(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[resend] ${to} threw: ${msg}`);
    }
  }

  return { mode: 'live', recipients, eventCount: events.length, messageIds };
}

export { renderDigestBody };
