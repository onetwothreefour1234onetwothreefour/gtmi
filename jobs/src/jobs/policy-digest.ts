// Phase 3.10c.6 — Phase 6 (Living Index): policy-change digest cron.
//
// Daily digest of Material + Breaking policy_changes events to the
// recipient list (RESEND_RECIPIENTS env var). Uses sendDailyDigest
// from @gtmi/extraction which gates outbound calls on RESEND_API_KEY.
//
// Cron: daily at 09:00 UTC.

import { schedules } from '@trigger.dev/sdk/v3';
import { sendDailyDigest } from '@gtmi/extraction';

export const policyDigest = schedules.task({
  id: 'policy-digest',
  // Daily at 09:00 UTC.
  cron: '0 9 * * *',
  maxDuration: 300,
  run: async () => {
    console.log('[policy-digest] starting');
    const result = await sendDailyDigest();
    console.log(
      `[policy-digest] mode=${result.mode} recipients=${result.recipients.length} events=${result.eventCount} sent=${result.messageIds.length}` +
        (result.unconfiguredReason ? ` reason="${result.unconfiguredReason}"` : '')
    );
    return result;
  },
});
