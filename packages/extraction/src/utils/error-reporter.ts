/**
 * Phase 3.10d / F.2 — Sentry-ready error reporter.
 *
 * Two-mode wrapper:
 *
 *   1. When SENTRY_DSN is set AND @sentry/node is installed, errors
 *      are forwarded to Sentry with optional extra context. Init is
 *      lazy and idempotent so callers can call initErrorReporter() at
 *      every entry point (cron task, CLI script, route handler) and
 *      pay the init cost exactly once.
 *
 *   2. Otherwise, errors are emitted as structured JSON on stderr so
 *      Cloud Run → Cloud Logging picks them up under jsonPayload.
 *      This keeps the error-reporting surface uniform across dev /
 *      staging / production without forcing a hard @sentry/node dep
 *      on workspaces that don't want it.
 *
 * To go fully Sentry: `pnpm add @sentry/node -F @gtmi/extraction` and
 * set SENTRY_DSN. No other code change required.
 */

interface SentryClient {
  init: (options: Record<string, unknown>) => void;
  captureException: (err: unknown) => string | undefined;
  captureMessage: (msg: string, level?: string) => string | undefined;
  withScope: (cb: (scope: SentryScope) => void) => void;
  flush?: (timeoutMs?: number) => Promise<boolean>;
}

interface SentryScope {
  setExtra: (key: string, value: unknown) => void;
  setTag: (key: string, value: string) => void;
  setUser: (user: { id?: string; email?: string }) => void;
}

let sentryClient: SentryClient | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Try to dynamic-import @sentry/node without TypeScript analysing the
 * specifier (which would force the dep into the typecheck graph).
 * The Function constructor is the standard escape hatch for "optional
 * runtime dep with type-safe fallback".
 */
async function tryLoadSentry(): Promise<SentryClient | null> {
  try {
    const importer = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const mod = (await importer('@sentry/node')) as Record<string, unknown>;
    if (typeof mod['init'] !== 'function' || typeof mod['captureException'] !== 'function') {
      return null;
    }
    return mod as unknown as SentryClient;
  } catch {
    return null;
  }
}

/**
 * Initialise the error reporter. Idempotent. Returns immediately on
 * subsequent calls. Resolves after Sentry's init completes (so the
 * caller can rely on the next captureException reaching Sentry).
 */
export function initErrorReporter(): Promise<void> {
  if (initialized) return initPromise ?? Promise.resolve();
  initialized = true;
  initPromise = (async () => {
    if (!process.env['SENTRY_DSN']) return;
    const client = await tryLoadSentry();
    if (!client) {
      console.warn(
        '[errorReporter] SENTRY_DSN is set but @sentry/node is not installed — errors will land on stderr only'
      );
      return;
    }
    client.init({
      dsn: process.env['SENTRY_DSN'],
      environment: process.env['SENTRY_ENV'] ?? process.env['NODE_ENV'] ?? 'production',
      release: process.env['SENTRY_RELEASE'],
      tracesSampleRate: Number.parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0'),
    });
    sentryClient = client;
  })();
  return initPromise;
}

export interface ErrorContext {
  /** Free-form tags for indexing in Sentry. */
  tags?: Record<string, string>;
  /** Arbitrary structured context attached to the event. */
  extra?: Record<string, unknown>;
  /** Optional user attribution. */
  user?: { id?: string; email?: string };
}

/**
 * Report an exception. Does not throw. If Sentry is loaded the event
 * is sent there with `ctx` mapped onto a Sentry scope; otherwise the
 * error is emitted as a structured JSON line on stderr.
 */
export function captureException(err: unknown, ctx?: ErrorContext): void {
  if (sentryClient) {
    try {
      sentryClient.withScope((scope) => {
        applyContextToScope(scope, ctx);
        sentryClient!.captureException(err);
      });
      return;
    } catch (sentryErr) {
      const msg = sentryErr instanceof Error ? sentryErr.message : String(sentryErr);
      console.warn(`[errorReporter] Sentry capture failed: ${msg} — falling back to stderr`);
    }
  }
  emitStructuredError('error', err, ctx);
}

/**
 * Report a non-exception event (e.g. "expected the X count to be N
 * but was M"). Defaults to 'warning' level.
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' = 'warning',
  ctx?: ErrorContext
): void {
  if (sentryClient) {
    try {
      sentryClient.withScope((scope) => {
        applyContextToScope(scope, ctx);
        sentryClient!.captureMessage(message, level);
      });
      return;
    } catch (sentryErr) {
      const msg = sentryErr instanceof Error ? sentryErr.message : String(sentryErr);
      console.warn(`[errorReporter] Sentry capture failed: ${msg} — falling back to stderr`);
    }
  }
  emitStructuredError(level, new Error(message), ctx);
}

/**
 * Best-effort flush. Returns true when Sentry is configured AND
 * flush succeeded; returns false otherwise (including "Sentry not
 * loaded" — there's nothing to flush). Useful at end of a Cloud Run
 * job or CLI script before process.exit so events aren't dropped.
 */
export async function flushErrorReporter(timeoutMs = 5000): Promise<boolean> {
  if (!sentryClient || typeof sentryClient.flush !== 'function') return false;
  try {
    return await sentryClient.flush(timeoutMs);
  } catch {
    return false;
  }
}

function applyContextToScope(scope: SentryScope, ctx: ErrorContext | undefined): void {
  if (!ctx) return;
  if (ctx.tags) for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
  if (ctx.extra) for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
  if (ctx.user) scope.setUser(ctx.user);
}

function emitStructuredError(
  level: 'fatal' | 'error' | 'warning' | 'info',
  err: unknown,
  ctx: ErrorContext | undefined
): void {
  const isError = err instanceof Error;
  const payload = {
    msg: 'error.captured',
    level,
    name: isError ? err.name : 'Error',
    message: isError ? err.message : String(err),
    stack: isError ? err.stack : undefined,
    tags: ctx?.tags ?? null,
    extra: ctx?.extra ?? null,
    user: ctx?.user ?? null,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}
