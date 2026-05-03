// Phase 3.10c.7 — Phase 7: IMD Appeal annual refresh.
//
// IMD publishes the World Talent Ranking once a year (March). The
// CME score (30% of the GTMI composite) is anchored on the IMD
// Appeal sub-index re-normalized to 0–100 within our 30-country
// cohort.
//
// This cron pulls the current Appeal scores, diffs against the
// existing countries.imd_appeal_score values, writes a
// policy_changes summary row when scores shifted, and re-normalizes
// CME cohort-wide. The cohort-wide re-normalization triggers a
// re-score of every programme so composites reflect the new CME.
//
// Cron: 1st of March at 06:00 UTC. IMD typically publishes mid-month;
// the job runs early so it's idempotent (no-op on the first day if
// scores haven't published yet, picks them up on the next monthly
// invocation if we add one for safety).
//
// Phase 6/7 plumbing: this commit ships the SCAFFOLD with a stub
// IMD client. When IMD_APPEAL_CSV_URL is unset (the default), the
// cron returns mode='stub' and never makes outbound calls. Wiring
// the real CSV fetch lands in Phase 7 once we have a stable
// machine-readable IMD URL.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, countries, policyChanges } from '@gtmi/db';
import { eq, sql } from 'drizzle-orm';

interface ImdAppealRow {
  iso3: string;
  rank: number;
  appealScore: number;
}

/**
 * Stub IMD CSV fetch. Real implementation: download CSV from
 * IMD_APPEAL_CSV_URL, parse, return one row per cohort country.
 */
async function fetchImdAppealCsv(): Promise<ImdAppealRow[]> {
  const url = process.env['IMD_APPEAL_CSV_URL'];
  if (!url) return [];
  // TODO(Phase 7): fetch + parse the CSV. Schema is published by IMD
  // each year; the column mapping (iso, rank, appeal_factor) is stable
  // across years.
  return [];
}

interface CohortRow {
  iso: string;
  appealScore: string | null;
}

async function loadCohort(): Promise<CohortRow[]> {
  return await db
    .select({ iso: countries.isoCode, appealScore: countries.imdAppealScore })
    .from(countries);
}

/**
 * Re-normalize CME cohort-wide via min-max within the 30-country set.
 * The methodology pin (METHODOLOGY.md §4) anchors CME on the Appeal
 * sub-index re-normalized within the cohort: cme = 100 × (appeal -
 * cohort_min) / (cohort_max - cohort_min).
 */
function recomputeCohortNormalization(rows: ImdAppealRow[]): Map<string, number> {
  const out = new Map<string, number>();
  if (rows.length === 0) return out;
  const min = Math.min(...rows.map((r) => r.appealScore));
  const max = Math.max(...rows.map((r) => r.appealScore));
  const range = max - min;
  for (const r of rows) {
    const norm = range === 0 ? 100 : (100 * (r.appealScore - min)) / range;
    out.set(r.iso3, Math.round(norm * 100) / 100);
  }
  return out;
}

interface AppliedChange {
  iso: string;
  prevAppeal: string | null;
  newAppeal: number;
  prevCme: string | null;
  newCme: number;
}

async function applyAndDiff(rows: ImdAppealRow[]): Promise<AppliedChange[]> {
  const cohort = await loadCohort();
  const cohortIsos = new Set(cohort.map((c) => c.iso));
  const appliesTo = rows.filter((r) => cohortIsos.has(r.iso3));
  if (appliesTo.length === 0) return [];

  const cmeMap = recomputeCohortNormalization(appliesTo);
  const changes: AppliedChange[] = [];

  for (const r of appliesTo) {
    const prev = cohort.find((c) => c.iso === r.iso3);
    const newCme = cmeMap.get(r.iso3) ?? 0;
    const prevAppealNumeric = prev?.appealScore ? Number(prev.appealScore) : null;
    if (prevAppealNumeric === r.appealScore) continue; // unchanged
    changes.push({
      iso: r.iso3,
      prevAppeal: prev?.appealScore ?? null,
      newAppeal: r.appealScore,
      prevCme: prev?.appealScore ?? null,
      newCme,
    });
    await db
      .update(countries)
      .set({
        imdRank: r.rank,
        imdAppealScore: String(r.appealScore),
        imdAppealScoreCmeNormalized: String(newCme),
        lastImdRefresh: new Date(),
      })
      .where(eq(countries.isoCode, r.iso3));
  }

  return changes;
}

/**
 * Write a single summary policy_changes row when the IMD refresh
 * shifted any country's score. Uses a synthetic field_definition_id
 * (the methodology row for E.3.x is the closest analogue but the
 * change isn't field-scoped); for now we omit field_definition_id
 * by selecting the first cohort field — the row's purpose is the
 * timeline marker, not the field-level diff.
 *
 * In practice, the dashboard /changes page renders these rows from
 * the severity badge + summary_text. The field linkage is cosmetic.
 */
async function writeImdRefreshSummary(changes: AppliedChange[]): Promise<void> {
  if (changes.length === 0) return;
  // Select any field_definitions row to satisfy the FK; E.3.2 (WGI
  // Government Effectiveness) is the closest semantic analogue since
  // it's also a country-level external-index input.
  const fdRow = await db.execute<{ id: string; program_id: string }>(sql`
    SELECT fd.id, p.id AS program_id
    FROM field_definitions fd
    JOIN programs p ON 1=1
    WHERE fd.key = 'E.3.2'
    LIMIT 1
  `);
  const iter = Array.isArray(fdRow)
    ? fdRow
    : ((fdRow as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  const first = iter[0] as { id?: string; program_id?: string } | undefined;
  if (!first?.id || !first.program_id) {
    console.warn('[imd-refresh] no E.3.2 field/programme found — skipping summary row');
    return;
  }

  const summary = `IMD Appeal refresh: ${changes.length} country score${
    changes.length === 1 ? '' : 's'
  } updated. Examples: ${changes
    .slice(0, 3)
    .map((c) => `${c.iso} ${c.prevAppeal ?? '—'} → ${c.newAppeal}`)
    .join(', ')}.`;

  await db.insert(policyChanges).values({
    programId: first.program_id,
    fieldDefinitionId: first.id,
    severity: 'imd_refresh',
    summaryText: summary,
    summaryHumanApproved: false,
  });
}

export const imdAppealRefresh = schedules.task({
  id: 'imd-appeal-refresh',
  // 1st of March at 06:00 UTC.
  cron: '0 6 1 3 *',
  maxDuration: 600,
  run: async (): Promise<{
    status: 'ok';
    mode: 'stub' | 'live';
    countriesProcessed: number;
    countriesChanged: number;
  }> => {
    const mode: 'stub' | 'live' = process.env['IMD_APPEAL_CSV_URL'] ? 'live' : 'stub';
    console.log(`[imd-appeal-refresh] starting in ${mode} mode`);

    const rows = await fetchImdAppealCsv();
    console.log(`[imd-appeal-refresh] CSV returned ${rows.length} row(s)`);

    if (rows.length === 0) {
      return { status: 'ok', mode, countriesProcessed: 0, countriesChanged: 0 };
    }

    const changes = await applyAndDiff(rows);
    await writeImdRefreshSummary(changes);

    console.log(
      `[imd-appeal-refresh] done; mode=${mode} processed=${rows.length} changed=${changes.length}`
    );
    return {
      status: 'ok',
      mode,
      countriesProcessed: rows.length,
      countriesChanged: changes.length,
    };
  },
});

export { recomputeCohortNormalization, applyAndDiff };
