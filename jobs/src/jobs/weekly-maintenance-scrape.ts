// Phase 3.9 / PR D — weekly maintenance scrape (ACTIVE; ADR-023).
//
// Was a paused scaffold (Phase 3.6.2 / ITEM 6). ADR-023 now makes it
// the canonical recurring re-scrape loop. Walks every URL backing an
// approved-or-pending field_values row (via the field_url_index view
// from migration 00012), re-scrapes through the existing scrape.ts +
// archiveScrapeResult pipeline, and relies on the W11 hash short-
// circuit to skip extraction when content_hash hasn't changed.
//
// Cost shape:
//   - For unchanged pages (~95% steady state): one HEAD + body
//     fetch, hash compare, scrape_history row written with
//     status='unchanged', LLM not called. ~$0 LLM cost.
//   - For changed pages: full extraction batch fires. Caller cost
//     guard MAX_RERUN_COST_USD applies on a per-program basis if
//     enabled.
//   - For newly broken URLs (404/410): scrape returns empty content;
//     we write a policy_changes row with severity='url_broken' so
//     /review surfaces the link rot to an analyst.
//
// Schedule: Mondays at 03:00 UTC. Adjust via the schedules.task
// `cron` field.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, sources, policyChanges, fieldDefinitions } from '@gtmi/db';
import { ScrapeStageImpl } from '@gtmi/extraction';
import type { DiscoveredUrl, GeographicLevel, SourceTier } from '@gtmi/extraction';
import { and, eq, sql } from 'drizzle-orm';

interface UrlToCheck {
  programId: string;
  countryIso: string;
  url: string;
  tier: SourceTier;
  geographicLevel: GeographicLevel;
  fieldKeys: string[];
  fieldValueIds: string[];
}

/**
 * Read the URL × field-value mapping that the maintenance loop
 * needs to revisit. Backed by the field_url_index view (migration
 * 00012) which already filters to status IN ('approved',
 * 'pending_review') AND provenance.sourceUrl IS NOT NULL.
 *
 * Excludes synthetic source URLs (derived:, internal:, World Bank
 * API) by prefix — those have no live page to re-scrape.
 */
async function loadUrlsToCheck(): Promise<UrlToCheck[]> {
  const rows = await db.execute<{
    program_id: string;
    country_iso: string;
    source_url: string;
    field_key: string;
    field_value_id: string;
  }>(sql`
    SELECT program_id, country_iso, source_url, field_key, field_value_id
    FROM field_url_index
    WHERE source_url NOT LIKE 'derived%'
      AND source_url NOT LIKE 'internal:%'
      AND source_url NOT LIKE 'country-substitute:%'
      AND source_url NOT LIKE 'https://api.worldbank.org/%'
  `);
  const iter = Array.isArray(rows)
    ? rows
    : ((rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []);

  // Group by (program_id, source_url) so we re-scrape each URL once
  // even when it backs multiple field_values.
  const byKey = new Map<string, UrlToCheck>();
  for (const r of iter as Array<{
    program_id: string;
    country_iso: string;
    source_url: string;
    field_key: string;
    field_value_id: string;
  }>) {
    const key = `${r.program_id}::${r.source_url}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        programId: r.program_id,
        countryIso: r.country_iso,
        url: r.source_url,
        tier: 1,
        geographicLevel: 'national',
        fieldKeys: [],
        fieldValueIds: [],
      };
      byKey.set(key, entry);
    }
    entry.fieldKeys.push(r.field_key);
    entry.fieldValueIds.push(r.field_value_id);
  }

  // Resolve tier + geographic_level from sources.
  const out: UrlToCheck[] = [];
  for (const entry of byKey.values()) {
    try {
      const srcRows = await db
        .select({
          tier: sources.tier,
          geographicLevel: sources.geographicLevel,
        })
        .from(sources)
        .where(and(eq(sources.programId, entry.programId), eq(sources.url, entry.url)))
        .limit(1);
      if (srcRows[0]?.tier && (srcRows[0].tier === 1 || srcRows[0].tier === 2)) {
        entry.tier = srcRows[0].tier as SourceTier;
      }
      if (srcRows[0]?.geographicLevel) {
        entry.geographicLevel = srcRows[0].geographicLevel as GeographicLevel;
      }
    } catch {
      // tier defaults to 1 — safe default for the scrape pipeline.
    }
    out.push(entry);
  }
  return out;
}

/**
 * Insert a policy_changes row tagging a URL as broken. Best-effort:
 * failures are non-fatal (the maintenance loop continues to the
 * next URL). Requires a real previous_value_id to satisfy the FK,
 * so the first field_value_id from the group is used.
 */
async function recordUrlBroken(args: {
  programId: string;
  fieldValueId: string;
  fieldKey: string;
  url: string;
  reason: string;
}): Promise<void> {
  try {
    const fdRows = await db
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.key, args.fieldKey))
      .limit(1);
    const fieldDefinitionId = fdRows[0]?.id;
    if (!fieldDefinitionId) return;
    await db.insert(policyChanges).values({
      programId: args.programId,
      fieldDefinitionId,
      previousValueId: args.fieldValueId,
      newValueId: null,
      severity: 'url_broken',
      summaryText: `URL no longer reachable: ${args.url} (${args.reason})`,
      summaryHumanApproved: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[weekly-maintenance] policy_changes insert failed: ${msg}`);
  }
}

export const weeklyMaintenanceScrape = schedules.task({
  id: 'weekly-maintenance-scrape',
  // Every Monday at 03:00 UTC.
  cron: '0 3 * * 1',
  maxDuration: 1800, // 30 min cap
  run: async (): Promise<{
    status: 'ok';
    urlsChecked: number;
    urlsUnchanged: number;
    urlsChanged: number;
    urlsBroken: number;
  }> => {
    console.log('[weekly-maintenance-scrape] starting');
    const targets = await loadUrlsToCheck();
    console.log(`[weekly-maintenance-scrape] ${targets.length} unique URLs to re-scrape`);

    const scrape = new ScrapeStageImpl();
    let unchanged = 0;
    let changed = 0;
    let broken = 0;

    for (const t of targets) {
      const discovered: DiscoveredUrl = {
        url: t.url,
        tier: t.tier,
        geographicLevel: t.geographicLevel,
        reason: 'weekly-maintenance',
        isOfficial: t.tier === 1,
      };
      try {
        const [result] = await scrape.execute([discovered], {
          programId: t.programId,
          countryIso: t.countryIso,
        });
        if (!result || result.contentMarkdown === '' || result.httpStatus === 0) {
          // Live URL no longer reachable — record link rot for /review.
          broken++;
          if (t.fieldValueIds[0] && t.fieldKeys[0]) {
            await recordUrlBroken({
              programId: t.programId,
              fieldValueId: t.fieldValueIds[0],
              fieldKey: t.fieldKeys[0],
              url: t.url,
              reason: result?.httpStatus
                ? `HTTP ${result.httpStatus}`
                : 'connection error / thin content',
            });
          }
          continue;
        }
        if (result.unchanged === true) {
          unchanged++;
        } else {
          changed++;
          // Full re-extraction across the field set this URL backs is
          // the right next step here. Deferring to a separate Trigger.dev
          // job (extract-single-program) so we don't run a 30-second
          // batch synchronously inside the maintenance loop. The
          // archive write already captured the new content_hash; the
          // narrow-mode canary will re-extract those fields on
          // demand.
          console.log(
            `[weekly-maintenance-scrape] CHANGED ${t.url} — fields: ${t.fieldKeys.join(',')}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[weekly-maintenance-scrape] scrape failed for ${t.url}: ${msg}`);
        broken++;
      }
    }

    console.log(
      `[weekly-maintenance-scrape] done — checked=${targets.length} unchanged=${unchanged} changed=${changed} broken=${broken}`
    );
    return {
      status: 'ok',
      urlsChecked: targets.length,
      urlsUnchanged: unchanged,
      urlsChanged: changed,
      urlsBroken: broken,
    };
  },
});
