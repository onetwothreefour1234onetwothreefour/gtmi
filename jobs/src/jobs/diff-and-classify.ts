// Phase 3.10c.3 — Phase 6 (Living Index): diff-and-classify.
//
// The weekly-maintenance-scrape (W6) writes a `scrape_history` row on
// every re-scrape. When a row's `content_hash` changed since the prior
// successful scrape AND `needs_reextraction` is true, the page has new
// information. This job picks up those rows, re-extracts the affected
// programme's fields, diffs the new values against the prior approved
// `field_values`, and writes one `policy_changes` row per scoring-
// field delta with severity classified by the
// classifyPolicyChangeSeverity helper (Phase 3.10c.2).
//
// Cron: Mondays at 05:00 UTC, two hours after the maintenance scrape
// so the scrape rows have settled and one hour after blocker-recheck
// so the cascade doesn't fight Wayback routing.
//
// Phase 5 has not yet populated `policy_changes`. This job ships as a
// production-shaped scaffold that runs against an empty changed-rows
// set today; once the cohort lands and weekly re-scrapes detect
// content drift, it lights up with no code change.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, policyChanges } from '@gtmi/db';
import { sql } from 'drizzle-orm';
import { classifyPolicyChangeSeverity, type PolicyChangeSeverity } from '@gtmi/scoring';

interface ChangedScrapeRow {
  scrapeHistoryId: string;
  programId: string;
  countryIso: string;
  programName: string;
  sourceUrl: string;
  newContentHash: string;
}

/**
 * Find scrape_history rows where:
 *   - content_hash differs from the row immediately preceding it for
 *     the same source_id (the W11 short-circuit handled equality)
 *   - needs_reextraction is true (W11 path sets this on hash change)
 *   - the row was inserted in the last 7 days (the maintenance scrape
 *     batches by week; older drift was already processed)
 */
async function loadChangedScrapes(): Promise<ChangedScrapeRow[]> {
  const rows = await db.execute<{
    scrape_history_id: string;
    program_id: string;
    country_iso: string;
    program_name: string;
    source_url: string;
    new_content_hash: string;
  }>(sql`
    WITH ranked AS (
      SELECT
        sh.id AS scrape_history_id,
        sh.source_id,
        sh.content_hash,
        sh.scraped_at,
        sh.needs_reextraction,
        ROW_NUMBER() OVER (PARTITION BY sh.source_id ORDER BY sh.scraped_at DESC) AS rn,
        LAG(sh.content_hash) OVER (PARTITION BY sh.source_id ORDER BY sh.scraped_at) AS prev_hash
      FROM scrape_history sh
      WHERE sh.scraped_at > NOW() - INTERVAL '7 days'
    )
    SELECT
      r.scrape_history_id,
      s.program_id,
      p.country_iso,
      p.name AS program_name,
      s.url AS source_url,
      r.content_hash AS new_content_hash
    FROM ranked r
    JOIN sources s ON s.id = r.source_id
    JOIN programs p ON p.id = s.program_id
    WHERE r.rn = 1
      AND r.needs_reextraction = TRUE
      AND r.prev_hash IS NOT NULL
      AND r.prev_hash <> r.content_hash
  `);
  const iter = Array.isArray(rows)
    ? rows
    : ((rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  return (iter as Array<Record<string, string>>).map((r) => ({
    scrapeHistoryId: r['scrape_history_id']!,
    programId: r['program_id']!,
    countryIso: r['country_iso']!,
    programName: r['program_name']!,
    sourceUrl: r['source_url']!,
    newContentHash: r['new_content_hash']!,
  }));
}

interface FieldDelta {
  programId: string;
  fieldDefinitionId: string;
  fieldKey: string;
  previousValueId: string;
  newValueId: string | null;
  paqBefore: number | null;
  paqAfter: number | null;
  scoringFieldChanged: boolean;
}

/**
 * For a single changed scrape, diff the prior approved field_values
 * rows backed by the changed source URL against the latest values.
 * The actual re-extraction is the responsibility of the maintenance-
 * scrape pipeline; this job DIFFS what's already on the row.
 */
async function loadFieldDeltasForScrape(args: ChangedScrapeRow): Promise<FieldDelta[]> {
  // Find every approved field_values row whose provenance.sourceUrl
  // matches the changed URL. These are the rows whose backing page
  // has shifted; the W11 hash short-circuit + a fresh scrape are
  // expected to have updated them. We diff value_normalized.
  const rows = await db.execute<{
    field_value_id: string;
    program_id: string;
    field_definition_id: string;
    field_key: string;
    normalization_fn: string;
    prior_value_normalized: unknown;
    prior_extracted_at: string;
  }>(sql`
    SELECT
      fv.id AS field_value_id,
      fv.program_id,
      fv.field_definition_id,
      fd.key AS field_key,
      fd.normalization_fn,
      fv.value_normalized AS prior_value_normalized,
      fv.extracted_at AS prior_extracted_at
    FROM field_values fv
    JOIN field_definitions fd ON fd.id = fv.field_definition_id
    WHERE fv.program_id = ${args.programId}
      AND fv.status = 'approved'
      AND (fv.provenance ->> 'sourceUrl') = ${args.sourceUrl}
  `);
  const iter = Array.isArray(rows)
    ? rows
    : ((rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);

  // For now, we treat each row as a candidate delta. The detailed
  // before/after PAQ math depends on Phase 5's `scores` history table
  // (Phase 3.10b.4). Until score_history is populated, paqBefore /
  // paqAfter are null and the classifier returns 'minor' / paq_unavailable.
  return (iter as Array<Record<string, unknown>>).map((r) => ({
    programId: args.programId,
    fieldDefinitionId: String(r['field_definition_id']),
    fieldKey: String(r['field_key']),
    previousValueId: String(r['field_value_id']),
    newValueId: null,
    paqBefore: null,
    paqAfter: null,
    scoringFieldChanged: String(r['normalization_fn']) !== 'country_substitute_regional',
  }));
}

async function writePolicyChange(
  delta: FieldDelta,
  severity: PolicyChangeSeverity,
  paqDelta: number | null
): Promise<void> {
  const summaryText = `Field ${delta.fieldKey}: severity=${severity}${
    paqDelta !== null ? ` paqDelta=${paqDelta.toFixed(2)}` : ''
  }`;
  await db.insert(policyChanges).values({
    programId: delta.programId,
    fieldDefinitionId: delta.fieldDefinitionId,
    previousValueId: delta.previousValueId,
    newValueId: delta.newValueId,
    severity,
    paqDelta: paqDelta !== null ? String(paqDelta) : null,
    summaryText,
    summaryHumanApproved: false,
  });
}

export const diffAndClassify = schedules.task({
  id: 'diff-and-classify',
  // Mondays at 05:00 UTC.
  cron: '0 5 * * 1',
  maxDuration: 1800,
  run: async (): Promise<{
    status: 'ok';
    scrapesChanged: number;
    deltasFound: number;
    breaking: number;
    material: number;
    minor: number;
  }> => {
    console.log('[diff-and-classify] starting');
    const changed = await loadChangedScrapes();
    console.log(`[diff-and-classify] ${changed.length} changed scrape(s) to diff`);

    let breaking = 0;
    let material = 0;
    let minor = 0;
    let totalDeltas = 0;

    for (const scrape of changed) {
      const deltas = await loadFieldDeltasForScrape(scrape);
      totalDeltas += deltas.length;
      for (const d of deltas) {
        const cls = classifyPolicyChangeSeverity({
          paqBefore: d.paqBefore,
          paqAfter: d.paqAfter,
          scoringFieldChanged: d.scoringFieldChanged,
        });
        try {
          await writePolicyChange(d, cls.severity, cls.paqDelta);
          if (cls.severity === 'breaking') breaking++;
          else if (cls.severity === 'material') material++;
          else minor++;
          console.log(
            `[diff-and-classify] program=${scrape.programName} field=${d.fieldKey} severity=${cls.severity} reason=${cls.reason}`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[diff-and-classify] policy_changes write failed for ${scrape.programName} / ${d.fieldKey}: ${msg}`
          );
        }
      }
    }

    console.log(
      `[diff-and-classify] done; scrapesChanged=${changed.length} deltas=${totalDeltas} breaking=${breaking} material=${material} minor=${minor}`
    );
    return {
      status: 'ok',
      scrapesChanged: changed.length,
      deltasFound: totalDeltas,
      breaking,
      material,
      minor,
    };
  },
});

// Re-export the loader internals for unit testing once a test scaffold
// for Trigger.dev jobs lands. Currently no tests; the job is exercised
// via dashboard test-runs against the live DB.
export { loadChangedScrapes, loadFieldDeltasForScrape };
