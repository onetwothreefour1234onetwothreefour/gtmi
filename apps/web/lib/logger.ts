import 'server-only';
import pino, { type Logger } from 'pino';

/**
 * Server-side structured logger.
 *
 * Cloud Run pipes stdout to Cloud Logging; pino's default JSON output is
 * picked up natively, with `level` mapped to Cloud Logging severity:
 *   pino numeric → cloud logging
 *   10 trace      → DEBUG
 *   20 debug      → DEBUG
 *   30 info       → INFO
 *   40 warn       → WARNING
 *   50 error      → ERROR
 *   60 fatal      → CRITICAL
 *
 * We tell pino to emit `severity` as a top-level field (Cloud Logging
 * looks for that name first) so the mapping is unambiguous in the
 * Cloud Logging UI.
 *
 * Configure via LOG_LEVEL env var (default 'info'). pino-pretty is
 * deliberately not added — production logs are JSON, dev logs are JSON
 * too so the team's eyes calibrate to the same shape across environments.
 */

const PINO_TO_GCP_SEVERITY: Record<number, string> = {
  10: 'DEBUG',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARNING',
  50: 'ERROR',
  60: 'CRITICAL',
};

export const logger: Logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: { service: 'gtmi-web' },
  formatters: {
    level(label, number) {
      return {
        level: number,
        severity: PINO_TO_GCP_SEVERITY[number] ?? 'DEFAULT',
        levelName: label,
      };
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

/**
 * Attach a request scope. Returns a child logger pre-tagged with
 * route + method so log lines emitted from request-handler code can be
 * filtered together in Cloud Logging.
 */
export function requestLogger(meta: { route: string; method?: string }): Logger {
  return logger.child({
    route: meta.route,
    method: meta.method ?? 'GET',
  });
}
