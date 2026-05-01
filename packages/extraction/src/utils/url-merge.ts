// Phase 3.6 / ADR-015 — URL merge utility for the self-improving
// sources table. Combines fresh Stage 0 (Perplexity) discoveries with
// the cumulative registry of previously-discovered URLs persisted to
// `sources`. Caller passes both sets; this utility produces the
// deduplicated, tier-ordered, capped list that goes into Stage 1
// (scrape).
//
// Pure logic for the merge; the loadProgramSourcesAsDiscovered helper
// at the bottom of this file does the live DB read.

import { db, sources, programs } from '@gtmi/db';
import { and, eq, gt, sql } from 'drizzle-orm';

export type DbClient = typeof db;
import type { DiscoveredUrl, GeographicLevel, SourceTier } from '../types/extraction';

export const DEFAULT_URL_CAP = 15;
export const TIER_QUOTAS = { 1: 9, 2: 5, 3: 1 } as const;

/**
 * Phase 3.6.2 / ITEM 4 — dynamic URL cap based on current field coverage.
 *
 * Rationale: a program already at high coverage doesn't benefit from a
 * wide URL set; the marginal field is more efficiently targeted by
 * precision discovery. A program at low coverage benefits from breadth.
 *
 * Bands:
 *   populated < 30 → cap = 20 (broad discovery to bootstrap coverage)
 *   30 ≤ populated < 42 → cap = 15 (default; balanced)
 *   populated ≥ 42 → cap = 12 (precision; rely on registry + targeted)
 */
export function dynamicUrlCap(populatedFieldCount: number): number {
  if (populatedFieldCount < 30) return 20;
  if (populatedFieldCount < 42) return 15;
  return 12;
}

/**
 * Per-cap tier quotas. Scaled proportionally so quotas always sum to the
 * cap (preserves the 60/30/10 Tier 1 / Tier 2 / Tier 3 ratio used since
 * Phase 3.6.1 with quotas 9/5/1 = 60%/33%/7%).
 */
export function dynamicTierQuotas(cap: number): { 1: number; 2: number; 3: number } {
  if (cap <= 12) return { 1: 7, 2: 4, 3: 1 };
  if (cap <= 15) return { 1: 9, 2: 5, 3: 1 };
  return { 1: 12, 2: 7, 3: 1 };
}

/**
 * Normalise a URL for cross-source deduplication.
 * - lowercases scheme and host
 * - strips trailing slash from the path (preserves "/" alone)
 * - strips tracking params (utm_*, gclid, fbclid, mc_cid)
 * - preserves query order otherwise
 *
 * Falls back to the raw input if URL parsing throws.
 */
export function normaliseUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw.trim();
  }
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  // Strip default ports (URL.toString already drops them, but be explicit).
  if (
    (u.protocol === 'https:' && u.port === '443') ||
    (u.protocol === 'http:' && u.port === '80')
  ) {
    u.port = '';
  }
  // Drop tracking params.
  const TRACKING = /^(utm_|gclid$|fbclid$|mc_cid$|mc_eid$)/;
  const toDelete: string[] = [];
  u.searchParams.forEach((_v, k) => {
    if (TRACKING.test(k)) toDelete.push(k);
  });
  for (const k of toDelete) u.searchParams.delete(k);
  // Strip trailing slash from non-root paths.
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

interface MergeArgs {
  freshFromStage0: DiscoveredUrl[];
  fromSourcesTable: DiscoveredUrl[];
  /** Phase 3.6.2 / ITEM 5 — URLs that produced approved values for the
   * currently-missing fields in OTHER programs in the same country. */
  fromProvenance?: DiscoveredUrl[];
  /**
   * Phase 3.7 / ADR-018 — URLs that produced approved or pending values
   * for the currently-missing fields in THIS program on a prior run.
   * Highest-priority origin in the merge (above `fresh`) so re-runs
   * preferentially retry the URL that last produced a value rather than
   * rediscovering from scratch.
   */
  fromFieldProven?: DiscoveredUrl[];
  cap?: number;
  /** Phase 3.6.2 / ITEM 4 — explicit per-tier quota override. When unset,
   * dynamicTierQuotas(cap) is used. */
  quotas?: { 1: number; 2: number; 3: number };
  /**
   * Phase 3.9 / W10 — per-URL yield score derived from the
   * field_url_yield materialized view. Higher = this URL has produced
   * more populated values for the currently-missing fields in past runs.
   * Within each tier and origin band, URLs with higher yield are
   * promoted to the front. Empty/absent map = no yield bias (current
   * Phase 3.7 ranking unchanged).
   */
  yieldByUrl?: ReadonlyMap<string, number>;
  /**
   * Phase 3.9 / W22 — set of hostnames flagged in blocker_domains
   * (lowercased). URLs matching one of these are dropped from the
   * merged set so prior-run registry entries on a now-known blocker
   * stop displacing fresh non-blocked URLs. Country-agnostic; the
   * hostname is the only input. Optional for backwards compatibility.
   */
  blockerDomains?: ReadonlySet<string>;
}

function urlHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Merge fresh Stage 0 results with the sources-table registry.
 *
 * Dedup: by normalised URL. Within a duplicate pair, the FRESH entry
 * wins (newer reason text, fresher classification); the registry entry
 * is dropped. Order preserved: tier 1 first (up to TIER_QUOTAS[1] slots),
 * tier 2 next (up to TIER_QUOTAS[2]), tier 3 last (up to TIER_QUOTAS[3]).
 * Within a tier, registry entries appear before fresh entries.
 */
export function mergeDiscoveredUrls(args: MergeArgs): DiscoveredUrl[] {
  const cap = args.cap ?? DEFAULT_URL_CAP;
  const quotas = args.quotas ?? dynamicTierQuotas(cap);

  // Tag each entry with its origin so we can implement "registry first within tier".
  type Tagged = {
    url: DiscoveredUrl;
    origin: 'registry' | 'fresh' | 'proven' | 'fieldProven';
    normalised: string;
  };
  const seen = new Map<string, Tagged>();

  // Seed with registry first; proven overlays on conflict; fresh overrides
  // everything. Phase 3.7 / ADR-018: fieldProven (same-program prior URL)
  // wins outright — it's the highest-confidence signal we have.
  for (const u of args.fromSourcesTable) {
    const n = normaliseUrl(u.url);
    seen.set(n, { url: u, origin: 'registry', normalised: n });
  }
  for (const u of args.fromProvenance ?? []) {
    const n = normaliseUrl(u.url);
    if (!seen.has(n)) seen.set(n, { url: u, origin: 'proven', normalised: n });
  }
  for (const u of args.freshFromStage0) {
    const n = normaliseUrl(u.url);
    seen.set(n, { url: u, origin: 'fresh', normalised: n });
  }
  for (const u of args.fromFieldProven ?? []) {
    const n = normaliseUrl(u.url);
    seen.set(n, { url: u, origin: 'fieldProven', normalised: n });
  }

  // Phase 3.9 / W22 — drop entries whose hostname is in the blocker
  // registry. Skip the filter when the set is empty/absent.
  const blockers = args.blockerDomains ?? new Set<string>();
  if (blockers.size > 0) {
    for (const [n, tagged] of seen) {
      const host = urlHostname(tagged.url.url);
      if (host !== '' && blockers.has(host)) {
        seen.delete(n);
      }
    }
  }

  // Bucket by tier.
  const byTier: Record<1 | 2 | 3, Tagged[]> = { 1: [], 2: [], 3: [] };
  for (const tagged of seen.values()) {
    const t = tagged.url.tier;
    if (t === 1 || t === 2 || t === 3) byTier[t].push(tagged);
  }

  // Within each tier, order: fieldProven → registry → proven → fresh
  // (stable within each origin). fieldProven wins because the URL has
  // already produced a value for THIS programme on this exact field.
  // Phase 3.9 / W10 — secondary sort by per-URL yield score (descending)
  // so within an origin band, URLs that have historically produced more
  // values for the currently-missing fields are promoted. yieldByUrl is
  // keyed on normalised URL.
  const ORIGIN_RANK: Record<Tagged['origin'], number> = {
    fieldProven: 0,
    registry: 1,
    proven: 2,
    fresh: 3,
  };
  const yieldByUrl = args.yieldByUrl ?? new Map<string, number>();
  const yieldFor = (t: Tagged): number => yieldByUrl.get(t.normalised) ?? 0;
  for (const t of [1, 2, 3] as const) {
    byTier[t].sort((a, b) => {
      const originDelta = ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin];
      if (originDelta !== 0) return originDelta;
      return yieldFor(b) - yieldFor(a);
    });
  }

  // Apply per-tier quotas, then fall through if a tier is short.
  const out: DiscoveredUrl[] = [];
  const remainingByTier = { 1: quotas[1], 2: quotas[2], 3: quotas[3] };
  for (const t of [1, 2, 3] as const) {
    const take = Math.min(remainingByTier[t], byTier[t].length, cap - out.length);
    for (let i = 0; i < take; i++) {
      out.push(byTier[t][i]!.url);
    }
  }
  // Fall-through: if total still under cap, fill with leftover Tier 2 then Tier 1 then Tier 3.
  if (out.length < cap) {
    for (const t of [2, 1, 3] as const) {
      const taken = out.filter((u) => u.tier === t).length;
      const leftover = byTier[t].slice(taken);
      for (const tagged of leftover) {
        if (out.length >= cap) break;
        out.push(tagged.url);
      }
    }
  }
  return out.slice(0, cap);
}

/**
 * Phase 3.9 / W10 — load yield scores per URL for the currently-missing
 * fields. Reads field_url_yield (the materialized view created in
 * migration 00014 + populated by extraction_attempts writes).
 *
 * Returns a Map<normalisedUrl, score> where score = sum of
 * attempts_yielded across the missing field set, weighted by
 * mean_confidence. Empty map when missingFieldKeys is empty (no signal
 * available) or when the view is empty (pre-backfill / fresh DB).
 *
 * The score is informational — used by mergeDiscoveredUrls as a
 * secondary sort key within each origin band. Higher score = URL has
 * historically produced more populated values for the gap fields.
 */
export async function loadFieldUrlYield(
  missingFieldKeys: string[],
  database: DbClient = db
): Promise<Map<string, number>> {
  if (missingFieldKeys.length === 0) return new Map();
  const keysList = sql.join(
    missingFieldKeys.map((k) => sql`${k}`),
    sql`, `
  );
  try {
    const rows = await database.execute<{ source_url: string; score: number }>(sql`
      SELECT
        y.source_url AS source_url,
        SUM(GREATEST(y.attempts_yielded, 0) * COALESCE(y.mean_confidence, 0.5))::float AS score
      FROM field_url_yield y
      WHERE y.field_key IN (${keysList})
        AND y.attempts_yielded > 0
      GROUP BY y.source_url
    `);
    const iter = Array.isArray(rows)
      ? rows
      : ((rows as unknown as { rows?: { source_url: string; score: number }[] }).rows ?? []);
    const map = new Map<string, number>();
    for (const r of iter) {
      map.set(normaliseUrl(r.source_url), Number(r.score));
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Live-DB companion: read the sources registry for a program and
 * project to DiscoveredUrl shape. Filters:
 * - tier IN (1, 2) — Tier 3 (news) excluded from re-discovery merge
 * - last_seen_at > NOW() - INTERVAL '90 days' — stale entries skipped
 * - programs.status = 'active' — closed/suspended programs excluded
 */
export async function loadProgramSourcesAsDiscovered(
  programId: string,
  database: DbClient = db
): Promise<DiscoveredUrl[]> {
  const rows = await database
    .select({
      url: sources.url,
      tier: sources.tier,
      geographicLevel: sources.geographicLevel,
      sourceCategory: sources.sourceCategory,
    })
    .from(sources)
    .innerJoin(programs, eq(sources.programId, programs.id))
    .where(
      and(
        eq(sources.programId, programId),
        eq(programs.status, 'active'),
        sql`${sources.tier} IN (1, 2)`,
        gt(sources.lastSeenAt, sql`now() - interval '90 days'`)
      )
    );

  return rows.map((r) => ({
    url: r.url,
    tier: (r.tier === 1 || r.tier === 2 ? r.tier : 2) as SourceTier,
    geographicLevel: (r.geographicLevel ?? 'national') as GeographicLevel,
    reason: `From sources registry (${r.sourceCategory ?? 'unknown'})`,
    isOfficial: r.tier === 1,
  }));
}

/**
 * Phase 3.6.2 / ITEM 5 — provenance-based URL pre-loading.
 *
 * For each missing field key in the current program, find URLs that
 * produced an APPROVED value for the SAME field key in OTHER programs
 * in the SAME country. Cross-country contamination is prevented by the
 * `programs.country_iso = $countryIso` filter (URLs from other countries
 * cannot leak — by construction).
 *
 * Excludes:
 *   - the current program (proven URLs from the same program are already
 *     in the sources registry)
 *   - synthetic provenance markers (derived-*, country-substitute,
 *     internal:*, World Bank API endpoints)
 *
 * Cap: returns at most `cap` distinct URLs (default 10). The merge layer
 * will further trim against the per-tier quotas.
 */
export interface LoadProvenUrlsOptions {
  database?: DbClient;
  cap?: number;
  /**
   * Phase 3.7 / ADR-018 — when true, return URLs that produced approved
   * OR pending values for the SAME programme on a prior run. When false
   * (default), return URLs from OTHER programmes in the same country
   * (the legacy Phase 3.6.2 ITEM 5 behaviour). Same-programme URLs are
   * the highest-priority signal: the LLM was already on the right page
   * for this exact field × programme combination.
   */
  sameProgram?: boolean;
}

export async function loadProvenUrlsForMissingFields(
  programId: string,
  countryIso: string,
  missingFieldKeys: string[],
  options: LoadProvenUrlsOptions = {}
): Promise<DiscoveredUrl[]> {
  const database = options.database ?? db;
  const cap = options.cap ?? 10;
  const sameProgram = options.sameProgram ?? false;
  if (missingFieldKeys.length === 0) return [];
  // drizzle's tagged-template `${array}` expands as a record tuple
  // `($1,$2,$3)`, not a Postgres `text[]`. Use sql.join to inline each
  // element as a separate bound parameter inside an IN clause.
  const keysList = sql.join(
    missingFieldKeys.map((k) => sql`${k}`),
    sql`, `
  );
  // Phase 3.7 / ADR-018 — same-program mode flips two filters:
  //   1) program_id = ${programId}  (no cross-programme exclusion)
  //   2) status IN ('approved','pending_review') — pending rows count
  //      because the LLM was on the right page, just not confident
  //      enough; retrying the URL is the cheapest way to upgrade.
  const programFilter = sameProgram
    ? sql`fv.program_id = ${programId}`
    : sql`fv.program_id <> ${programId}`;
  const statusFilter = sameProgram
    ? sql`fv.status IN ('approved', 'pending_review')`
    : sql`fv.status = 'approved'`;
  const rows = await database.execute<{
    url: string;
    field_key: string;
    program_name: string;
    fv_status: string;
  }>(
    sql`
      SELECT DISTINCT ON (provenance->>'sourceUrl')
        (provenance->>'sourceUrl') AS url,
        fd.key AS field_key,
        p.name AS program_name,
        fv.status AS fv_status
      FROM field_values fv
      JOIN field_definitions fd ON fd.id = fv.field_definition_id
      JOIN programs p ON p.id = fv.program_id
      WHERE ${statusFilter}
        AND ${programFilter}
        AND p.country_iso = ${countryIso}
        AND fd.key IN (${keysList})
        AND fv.provenance->>'sourceUrl' IS NOT NULL
        AND fv.provenance->>'sourceUrl' NOT LIKE 'derived-%'
        AND fv.provenance->>'sourceUrl' NOT LIKE 'derived:%'
        AND fv.provenance->>'sourceUrl' NOT LIKE 'internal:%'
        AND fv.provenance->>'sourceUrl' NOT LIKE 'https://api.worldbank.org/%'
      LIMIT ${cap}
    `
  );

  // postgres-driven Drizzle: rows is iterable.
  const list: DiscoveredUrl[] = [];
  const iter = Array.isArray(rows) ? rows : ((rows as unknown as { rows?: unknown[] }).rows ?? []);
  for (const r of iter as Array<{
    url: string;
    field_key: string;
    program_name: string;
    fv_status: string;
  }>) {
    list.push({
      url: r.url,
      tier: 1,
      geographicLevel: 'national',
      reason: sameProgram
        ? `Field-proven — produced ${r.fv_status} value for ${r.field_key} in this programme`
        : `Proven — produced approved value for ${r.field_key} in "${r.program_name}"`,
      isOfficial: true,
    });
  }
  return list;
}
