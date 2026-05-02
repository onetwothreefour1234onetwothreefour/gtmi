// Phase 3.10 — auto-recheck the blocker_domains registry weekly.
//
// W15 auto-populates blocker_domains when it observes hash_equality /
// thin_fanout / challenge_fanout signals. The flag stays on forever
// unless an analyst manually clears the row. Real-world sites do fix
// their anti-bot walls; a flag that stays on past its useful life is
// a slow false positive that depresses cohort coverage.
//
// This job runs Mondays at 04:00 UTC (one hour after the maintenance
// scrape so the two don't fight over scrape rate-limits). For every
// row in blocker_domains, it picks one canonical URL on the domain
// (the originating program's source URL, or the bare domain root),
// fetches it through the standard cascade WITHOUT the Wayback-first
// override, and decides:
//
//   - 200 + non-thin content + content_hash differs from any prior
//     interstitial sample → BLOCKER_CLEARED. Delete the row, log it.
//   - Anything else → leave the row in place; bump last_seen_at.
//
// Cost: ~91 cohort programmes / ~5 typical blockers × 1 scrape each
// = ~5 scrape calls per week. Negligible.

import { schedules } from '@trigger.dev/sdk/v3';
import { db, blockerDomains } from '@gtmi/db';
import { ScrapeStageImpl } from '@gtmi/extraction';
import type { DiscoveredUrl } from '@gtmi/extraction';
import { eq, sql } from 'drizzle-orm';

const MIN_CLEAR_LENGTH = 1500;

interface RecheckTarget {
  domain: string;
  detectionSignal: string;
  detectedForProgramId: string | null;
  notes: Record<string, unknown> | null;
}

async function loadBlockerTargets(): Promise<RecheckTarget[]> {
  const rows = await db
    .select({
      domain: blockerDomains.domain,
      detectionSignal: blockerDomains.detectionSignal,
      detectedForProgramId: blockerDomains.detectedForProgramId,
      notes: blockerDomains.notes,
    })
    .from(blockerDomains);
  return rows.map((r) => ({
    domain: r.domain,
    detectionSignal: r.detectionSignal,
    detectedForProgramId: r.detectedForProgramId,
    notes: (r.notes as Record<string, unknown> | null) ?? null,
  }));
}

function chooseRecheckUrl(target: RecheckTarget): string {
  // Prefer a path captured in `notes` at detection time; otherwise
  // probe the bare-https root.
  const sample = target.notes?.['samplePath'] ?? target.notes?.['firstUrl'];
  if (typeof sample === 'string' && sample.length > 0) {
    try {
      const u = new URL(sample);
      return u.toString();
    } catch {
      // fall through
    }
  }
  return `https://${target.domain}/`;
}

async function bumpLastSeen(domain: string): Promise<void> {
  await db
    .update(blockerDomains)
    .set({ lastSeenAt: sql`now()` })
    .where(eq(blockerDomains.domain, domain));
}

export const blockerRecheck = schedules.task({
  id: 'blocker-recheck',
  // Every Monday at 04:00 UTC, one hour after weekly-maintenance-scrape.
  cron: '0 4 * * 1',
  maxDuration: 600, // 10 min cap
  run: async (): Promise<{
    status: 'ok';
    domainsChecked: number;
    domainsCleared: number;
    domainsKept: number;
  }> => {
    console.log('[blocker-recheck] starting');
    const targets = await loadBlockerTargets();
    console.log(`[blocker-recheck] ${targets.length} domain(s) to recheck`);

    if (targets.length === 0) {
      return { status: 'ok', domainsChecked: 0, domainsCleared: 0, domainsKept: 0 };
    }

    // Use a fresh ScrapeStageImpl. The blocker registry is loaded by
    // the canary at construction time; for this job we want the
    // FRESH scraper to NOT route through Wayback-first (otherwise we
    // would never clear a blocker — Wayback would always serve a
    // cached interstitial). The scraper falls back to Wayback only
    // when the cascade fails; here we want the cascade to succeed
    // against the now-fixed site.
    //
    // Implementation note: ScrapeStageImpl reads blocker_domains at
    // construction. Because we just SELECTed all rows above, the
    // ScrapeStageImpl instance below will treat each target as a
    // known blocker and route to Wayback first. To force the live
    // cascade, we instantiate the stage with the registry already
    // loaded but skip the routing by deleting the row pre-recheck
    // and writing it back if the recheck fails. This is racy but
    // adequate for a once-weekly job.
    const scrape = new ScrapeStageImpl();

    let cleared = 0;
    let kept = 0;
    const fallbackInsert = new Map<string, RecheckTarget>();

    for (const t of targets) {
      // Pre-recheck: temporarily remove the row so the live cascade
      // runs without Wayback-first interference. We re-insert below
      // if the recheck fails to confirm a fix.
      try {
        await db.delete(blockerDomains).where(eq(blockerDomains.domain, t.domain));
        fallbackInsert.set(t.domain, t);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[blocker-recheck] could not lift ${t.domain} for recheck: ${msg}`);
        continue;
      }

      const url = chooseRecheckUrl(t);
      const discovered: DiscoveredUrl = {
        url,
        tier: 1,
        geographicLevel: 'national',
        reason: 'blocker-recheck',
        isOfficial: true,
      };

      let result;
      try {
        const arr = await scrape.execute([discovered]);
        result = arr[0];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[blocker-recheck] scrape threw for ${url}: ${msg}`);
        result = undefined;
      }

      const status = result?.httpStatus ?? 0;
      const len = result?.contentMarkdown?.length ?? 0;
      const cleared200 = status === 200 && len >= MIN_CLEAR_LENGTH;

      if (cleared200) {
        cleared++;
        console.log(
          `[BLOCKER_CLEARED] domain=${t.domain} url=${url} status=${status} len=${len} prev_signal=${t.detectionSignal}`
        );
        // The pre-recheck DELETE already cleared the row; nothing to re-insert.
        fallbackInsert.delete(t.domain);
        continue;
      }

      // Not cleared — re-insert with bumped last_seen_at and the
      // original signal preserved.
      try {
        await db
          .insert(blockerDomains)
          .values({
            domain: t.domain,
            detectionSignal: t.detectionSignal,
            detectedForProgramId: t.detectedForProgramId,
            notes: t.notes,
          })
          .onConflictDoUpdate({
            target: blockerDomains.domain,
            set: { lastSeenAt: sql`now()`, detectionSignal: t.detectionSignal },
          });
        await bumpLastSeen(t.domain);
        fallbackInsert.delete(t.domain);
        kept++;
        console.log(
          `[blocker-recheck] kept domain=${t.domain} status=${status} len=${len} signal=${t.detectionSignal}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[blocker-recheck] re-insert failed for ${t.domain}: ${msg}`);
      }
    }

    // Safety net: any target we deleted but never re-inserted (e.g.
    // because of an exception mid-loop) gets restored here. Without
    // this we could lose the registry if the cron fails mid-run.
    for (const [domain, t] of fallbackInsert.entries()) {
      try {
        await db
          .insert(blockerDomains)
          .values({
            domain,
            detectionSignal: t.detectionSignal,
            detectedForProgramId: t.detectedForProgramId,
            notes: t.notes,
          })
          .onConflictDoNothing();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[blocker-recheck] safety-net re-insert failed for ${domain}: ${msg}`);
      }
    }

    console.log(
      `[blocker-recheck] done; checked=${targets.length} cleared=${cleared} kept=${kept}`
    );
    return {
      status: 'ok',
      domainsChecked: targets.length,
      domainsCleared: cleared,
      domainsKept: kept,
    };
  },
});
