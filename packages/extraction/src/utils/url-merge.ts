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
  cap?: number;
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

  // Tag each entry with its origin so we can implement "registry first within tier".
  type Tagged = { url: DiscoveredUrl; origin: 'registry' | 'fresh'; normalised: string };
  const seen = new Map<string, Tagged>();

  // Seed with registry first; fresh overrides on conflict.
  for (const u of args.fromSourcesTable) {
    const n = normaliseUrl(u.url);
    seen.set(n, { url: u, origin: 'registry', normalised: n });
  }
  for (const u of args.freshFromStage0) {
    const n = normaliseUrl(u.url);
    seen.set(n, { url: u, origin: 'fresh', normalised: n });
  }

  // Bucket by tier.
  const byTier: Record<1 | 2 | 3, Tagged[]> = { 1: [], 2: [], 3: [] };
  for (const tagged of seen.values()) {
    const t = tagged.url.tier;
    if (t === 1 || t === 2 || t === 3) byTier[t].push(tagged);
  }

  // Within each tier, registry first then fresh (stable within each origin).
  for (const t of [1, 2, 3] as const) {
    byTier[t].sort((a, b) => {
      if (a.origin === b.origin) return 0;
      return a.origin === 'registry' ? -1 : 1;
    });
  }

  // Apply per-tier quotas, then fall through if a tier is short.
  const out: DiscoveredUrl[] = [];
  const remainingByTier = { 1: TIER_QUOTAS[1], 2: TIER_QUOTAS[2], 3: TIER_QUOTAS[3] };
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
