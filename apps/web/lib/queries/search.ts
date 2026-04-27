import { sql, type SQL } from 'drizzle-orm';

/**
 * Build a Postgres `tsquery` from free-text input.
 *
 * Uses `plainto_tsquery` to keep the parser strict — punctuation, operators,
 * and stop-words are dropped. The caller passes the raw user input verbatim
 * (sanitisation lives here, not in the page).
 *
 * Returns null when the input has no usable lexemes (empty, whitespace-only,
 * or all punctuation). Callers must skip the FTS branch in that case rather
 * than emit `to_tsquery('')` which fails at runtime.
 *
 * @example
 *   const q = buildTsQuery('australia 482');
 *   // q is an SQL fragment that renders to:
 *   //   plainto_tsquery('english', 'australia 482')
 */
export function buildTsQuery(input: string): SQL | null {
  const trimmed = sanitiseSearchInput(input);
  if (!trimmed) return null;
  return sql`plainto_tsquery('english', ${trimmed})`;
}

/**
 * Strip control characters and outer whitespace; cap at 200 chars so a
 * pathological input doesn't blow up the query plan.
 */
export function sanitiseSearchInput(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove ASCII control chars + collapse internal whitespace.

  const cleaned = input
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Reject if no alphanumeric characters survive (avoids tsquery on pure punctuation).
  if (!/[a-z0-9]/i.test(cleaned)) return '';
  return cleaned.slice(0, 200);
}

/**
 * Build the FTS WHERE-clause fragment: `programs.search_tsv @@ plainto_tsquery(...)`.
 * Returns null when the input is empty so the caller can skip the predicate.
 */
export function buildSearchPredicate(input: string): SQL | null {
  const tsq = buildTsQuery(input);
  if (!tsq) return null;
  return sql`programs.search_tsv @@ ${tsq}`;
}

/**
 * Build the relevance-rank expression: `ts_rank(programs.search_tsv, ...)`.
 * Returns SQL fragment that may be used as an ORDER BY key. Returns null
 * for empty input.
 */
export function buildSearchRank(input: string): SQL | null {
  const tsq = buildTsQuery(input);
  if (!tsq) return null;
  return sql`ts_rank(programs.search_tsv, ${tsq})`;
}
