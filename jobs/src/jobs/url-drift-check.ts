// Phase 3.10c.4 — URL drift monthly HEAD-check cron.
//
// Surfaces Tier-1 URL soft-404s before they cost a canary run.
// Walks field_url_index (migration 00012) — every URL backing an
// approved or pending field_values row — and HEADs each URL through a
// concurrency-capped worker pool (mirrors the Phase 3.10 verifyUrls
// improvements in discover.ts).
//
// HTTP 4xx/5xx, connection error, or timeout → write a policy_changes
// row with severity='url_broken' so /review surfaces the link rot to
// an analyst.
//
// Cron: 1st of every month at 02:00 UTC.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, policyChanges } from '@gtmi/db';
import { sql } from 'drizzle-orm';

const HEAD_CONCURRENCY = 8;
const HEAD_TIMEOUT_MS = 5_000;

interface UrlIndexRow {
  fieldValueId: string;
  programId: string;
  fieldDefinitionId: string;
  sourceUrl: string;
}

interface DriftResult {
  fieldValueId: string;
  programId: string;
  fieldDefinitionId: string;
  sourceUrl: string;
  reason: string;
}

async function loadIndexRows(): Promise<UrlIndexRow[]> {
  const rows = await db.execute<{
    field_value_id: string;
    program_id: string;
    field_definition_id: string;
    source_url: string;
  }>(sql`
    SELECT field_value_id, program_id, field_definition_id, source_url
    FROM field_url_index
    WHERE source_url NOT LIKE 'derived%'
      AND source_url NOT LIKE 'internal:%'
      AND source_url NOT LIKE 'country-substitute:%'
      AND source_url NOT LIKE 'urn:%'
      AND source_url NOT LIKE 'https://api.worldbank.org/%'
  `);
  const iter = Array.isArray(rows)
    ? rows
    : ((rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  return (iter as Array<Record<string, string>>).map((r) => ({
    fieldValueId: r['field_value_id']!,
    programId: r['program_id']!,
    fieldDefinitionId: r['field_definition_id']!,
    sourceUrl: r['source_url']!,
  }));
}

async function checkUrl(row: UrlIndexRow): Promise<DriftResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(row.sourceUrl, { method: 'HEAD', signal: controller.signal });
    if (res.status === 404 || res.status === 410) {
      return { ...row, reason: `http_${res.status}` };
    }
    if (res.status >= 400) {
      return { ...row, reason: `http_${res.status}` };
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...row, reason: `connection_error: ${msg.slice(0, 80)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Concurrency-capped HEAD batch. Mirrors verifyUrls's worker-pool
 * pattern from discover.ts (Phase 3.10 commit 142ad9f).
 */
async function checkAll(rows: UrlIndexRow[]): Promise<DriftResult[]> {
  const results: (DriftResult | null)[] = new Array(rows.length).fill(null);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= rows.length) return;
      results[i] = await checkUrl(rows[i]!);
    }
  }
  const workers = Array.from({ length: Math.min(HEAD_CONCURRENCY, rows.length) }, () => worker());
  await Promise.all(workers);
  return results.filter((r): r is DriftResult => r !== null);
}

async function writeUrlBroken(d: DriftResult): Promise<void> {
  // Defensive: if a policy_changes row already exists for this
  // (program, field, severity='url_broken') in the past 30 days,
  // skip — we don't want monthly duplicates piling up.
  const existing = await db.execute<{ id: string }>(sql`
    SELECT id FROM policy_changes
    WHERE program_id = ${d.programId}
      AND field_definition_id = ${d.fieldDefinitionId}
      AND severity = 'url_broken'
      AND detected_at > NOW() - INTERVAL '30 days'
    LIMIT 1
  `);
  const iter = Array.isArray(existing)
    ? existing
    : ((existing as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  if (iter.length > 0) return;

  await db.insert(policyChanges).values({
    programId: d.programId,
    fieldDefinitionId: d.fieldDefinitionId,
    previousValueId: d.fieldValueId,
    newValueId: null,
    severity: 'url_broken',
    paqDelta: null,
    summaryText: `URL drift detected on ${d.sourceUrl}: ${d.reason}`,
    summaryHumanApproved: false,
  });
}

export const urlDriftCheck = schedules.task({
  id: 'url-drift-check',
  // 1st of every month at 02:00 UTC.
  cron: '0 2 1 * *',
  maxDuration: 1800,
  run: async (): Promise<{
    status: 'ok';
    urlsChecked: number;
    urlsBroken: number;
    rowsWritten: number;
  }> => {
    console.log('[url-drift-check] starting');
    const rows = await loadIndexRows();
    console.log(`[url-drift-check] ${rows.length} URLs to HEAD`);

    if (rows.length === 0) {
      return { status: 'ok', urlsChecked: 0, urlsBroken: 0, rowsWritten: 0 };
    }

    const broken = await checkAll(rows);
    let written = 0;
    for (const d of broken) {
      try {
        await writeUrlBroken(d);
        written++;
        console.log(
          `[url-drift-check] BROKEN program=${d.programId} field=${d.fieldDefinitionId} url=${d.sourceUrl} reason=${d.reason}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[url-drift-check] policy_changes write failed for ${d.sourceUrl}: ${msg}`);
      }
    }

    console.log(
      `[url-drift-check] done; checked=${rows.length} broken=${broken.length} written=${written}`
    );
    return {
      status: 'ok',
      urlsChecked: rows.length,
      urlsBroken: broken.length,
      rowsWritten: written,
    };
  },
});

export { checkUrl, checkAll };
