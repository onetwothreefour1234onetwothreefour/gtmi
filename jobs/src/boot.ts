// Phase 3.10d / F.2 — shared boot for every Trigger.dev job.
//
// Importing this module (with no side-effects beyond the import) is
// enough to wire up the Sentry-ready error reporter. initErrorReporter
// is idempotent so importing from N job files only does the work once;
// because Node module evaluation is cached, the init promise is shared
// across every job that runs in the same task worker.

import { initErrorReporter } from '@gtmi/extraction';

// Fire-and-forget. captureException calls before init resolves still
// emit on stderr (the default transport); after init they reach Sentry
// when SENTRY_DSN + @sentry/node are configured.
void initErrorReporter();
