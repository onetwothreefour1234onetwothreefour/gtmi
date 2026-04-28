// Phase 3.6.2 / ITEM 6 — weekly maintenance scrape (SCAFFOLD, paused).
//
// PURPOSE
// -------
// Once per week, walk every URL backing an approved or pending_review
// `field_values` row (via the `field_url_index` view) and re-scrape it
// to detect:
//
//   1. URLs that have started returning 404/410/connection errors
//      ("link rot") — surface to /review with a `policy_changes`
//      severity = 'url_broken' marker so an analyst can re-discover
//      the canonical replacement.
//   2. URLs whose content_hash differs materially from the last
//      successful scrape — trigger a re-extraction of the indicators
//      backed by that URL (the upstream page may have changed
//      eligibility criteria, fees, or thresholds).
//
// STATUS — PAUSED until Phase 5
// -----------------------------
// This scaffold is intentionally NOT registered as a `schedules.task`
// or `cronTask` and exports an inert `run` function. Phase 5 will:
//   - flip this to `schedules.task` with cron `'0 3 * * 1'` (Mon 03:00 UTC)
//   - implement the body (currently a no-op log line)
//   - wire the `'url_broken'` severity through to the dashboard's
//     "policy changes" panel
//
// Until then, importing this file is a no-op. Trigger.dev v3 picks up
// `./src/jobs/*` automatically; an unregistered (plain) task is harmless.
//
// REFERENCES
// ----------
//   - ADR-018 (forthcoming) — weekly maintenance loop design
//   - `field_url_index` view (migration 00012) — input source
//   - `policy_changes.severity` — 'url_broken' marker (Phase 3.6.2 type widening)

import { task } from '@trigger.dev/sdk/v3';

export const weeklyMaintenanceScrape = task({
  id: 'weekly-maintenance-scrape',
  // No `schedules` block — task is registered but never auto-triggers.
  // Phase 5 will replace `task` with `schedules.task({ cron: '0 3 * * 1' })`.
  run: async (): Promise<{ status: 'paused'; phase: '3.6.2-scaffold' }> => {
    console.log('[weekly-maintenance-scrape] Phase 3.6.2 scaffold — paused. Phase 5 activates.');
    return { status: 'paused', phase: '3.6.2-scaffold' };
  },
});
