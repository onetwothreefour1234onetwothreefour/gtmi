// Phase 3.9 / W8 — discovery telemetry writer.
//
// Stage 0 (discover.ts) calls writeDiscoveryTelemetry after each
// successful Perplexity invocation. The helper computes:
//   - urls_already_in_registry: how many of the fresh results are
//     already in the program's sources rows (dedup signal)
//   - urls_already_in_archive_for_country: how many fresh URLs have
//     ever been successfully scraped for ANY program in the same
//     country (cohort coverage signal — the rest of the country has
//     already paid the scrape cost on these URLs)
//   - urls_new_to_archive: the gap closure — URLs Perplexity found
//     that the cohort has never seen
//   - marginal_yield_pct: urls_new_to_archive / urls_discovered
//
// Best-effort: every failure path returns silently. The discover
// stage continues even if telemetry write fails.

import { db, discoveryTelemetry, scrapeHistory, sources, programs } from '@gtmi/db';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { normaliseUrl } from './url-merge';

export interface WriteDiscoveryTelemetryArgs {
  programId: string;
  countryIso: string;
  /** Fresh-from-Perplexity URL list. Cache hits MAY also write telemetry with cacheHit=true. */
  discoveredUrls: ReadonlyArray<{ url: string }>;
  /** True when this invocation served from discovery_cache. Defaults to false. */
  cacheHit?: boolean;
}

export async function writeDiscoveryTelemetry(args: WriteDiscoveryTelemetryArgs): Promise<void> {
  const total = args.discoveredUrls.length;
  if (total === 0) return;

  const normalisedUrls = args.discoveredUrls.map((u) => normaliseUrl(u.url));

  let alreadyInRegistry = 0;
  let alreadyInArchiveForCountry = 0;

  // Count fresh URLs already in this program's sources rows.
  try {
    const registry = await db
      .select({ url: sources.url })
      .from(sources)
      .where(and(eq(sources.programId, args.programId), inArray(sources.url, normalisedUrls)));
    const set = new Set(registry.map((r) => normaliseUrl(r.url)));
    alreadyInRegistry = normalisedUrls.filter((u) => set.has(u)).length;
  } catch {
    // Lookup failure → leave as 0; telemetry stays best-effort.
  }

  // Count fresh URLs whose archive coverage exists anywhere in the same country.
  // sources.programId → programs.country_iso join scoped to the input urls.
  try {
    const rows = await db
      .select({ url: sources.url })
      .from(scrapeHistory)
      .innerJoin(sources, eq(sources.id, scrapeHistory.sourceId))
      .innerJoin(programs, eq(programs.id, sources.programId))
      .where(
        and(
          eq(programs.countryIso, args.countryIso),
          inArray(sources.url, normalisedUrls),
          isNotNull(scrapeHistory.storagePath)
        )
      );
    const set = new Set(rows.map((r) => normaliseUrl(r.url)));
    alreadyInArchiveForCountry = normalisedUrls.filter((u) => set.has(u)).length;
  } catch {
    // ignore
  }

  const newToArchive = total - alreadyInArchiveForCountry;
  const marginalYieldPct = total > 0 ? (newToArchive / total) * 100 : 0;

  try {
    await db.insert(discoveryTelemetry).values({
      programId: args.programId,
      countryIso: args.countryIso,
      urlsDiscovered: total,
      urlsAlreadyInRegistry: alreadyInRegistry,
      urlsAlreadyInArchiveForCountry: alreadyInArchiveForCountry,
      urlsNewToArchive: newToArchive,
      marginalYieldPct: marginalYieldPct.toFixed(2),
      cacheHit: args.cacheHit ?? false,
    });
    console.log(
      `[Discovery telemetry] ${args.countryIso}/${args.programId}: ` +
        `discovered=${total} | newToArchive=${newToArchive} | yield=${marginalYieldPct.toFixed(0)}%` +
        (args.cacheHit ? ' (cache hit)' : '')
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Discovery telemetry] write failed: ${msg}`);
  }
}
