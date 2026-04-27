/**
 * ISO-3 → ISO-2 mapping for the 30 IMD Top 30 economies in the GTMI cohort.
 * Used by <CountryFlag> to look up the SVG file under /public/flags/{iso2}.svg
 * and by other UI surfaces that need an ISO-2 representation (e.g. emoji
 * regional-indicator code points).
 *
 * Kept in apps/web/lib rather than packages/db/seed because:
 *  - It only matters in the UI; no scoring or extraction code reads it.
 *  - Adding the dep on @gtmi/db's seed module from a (public) page would
 *    drag the seed-script tooling into the Next bundle.
 *
 * The countries.ts seed in packages/db is the source of truth for which
 * countries are in the cohort; this map is its UI shadow.
 */

export const ISO3_TO_ISO2: Record<string, string> = {
  CHE: 'ch',
  NLD: 'nl',
  IRL: 'ie',
  LUX: 'lu',
  ISL: 'is',
  DEU: 'de',
  CAN: 'ca',
  SWE: 'se',
  SGP: 'sg',
  BEL: 'be',
  AUT: 'at',
  ARE: 'ae',
  AUS: 'au',
  JPN: 'jp',
  NOR: 'no',
  TWN: 'tw',
  LTU: 'lt',
  USA: 'us',
  FIN: 'fi',
  HKG: 'hk',
  MYS: 'my',
  CHL: 'cl',
  SAU: 'sa',
  NAM: 'na',
  FRA: 'fr',
  GBR: 'gb',
  EST: 'ee',
  NZL: 'nz',
  BHR: 'bh',
  OMN: 'om',
};

/**
 * Resolve an arbitrary ISO code (2- or 3-letter, any case) to the
 * lowercase 2-letter form used for the SVG filename. Returns null when
 * the input doesn't match a known cohort country — callers render the
 * generic-globe fallback in that case.
 */
export function resolveIso2(iso: string): string | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const upper = iso.toUpperCase();
  if (upper.length === 3) {
    return ISO3_TO_ISO2[upper] ?? null;
  }
  if (upper.length === 2) {
    // Confirm it matches one of our cohort entries.
    const lower = upper.toLowerCase();
    return Object.values(ISO3_TO_ISO2).includes(lower) ? lower : null;
  }
  return null;
}
