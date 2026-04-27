import 'server-only';
import type { MetadataRoute } from 'next';
import { db } from '@gtmi/db';
import { sql } from 'drizzle-orm';
import { SITE_URL } from '@/lib/site-url';
import { logger } from '@/lib/logger';

// Render at request time — DATABASE_URL is a runtime-only secret in
// Cloud Run; the build container does not have it. The function below
// short-circuits to static entries when env is missing, so even at
// build time it returns a valid sitemap shape.
export const dynamic = 'force-dynamic';

interface ProgramRow {
  id: string;
  updatedAt: Date | null;
}
interface CountryRow {
  isoCode: string;
}

/**
 * sitemap.xml generated dynamically from the live database.
 *
 * Static routes get fixed lastModified at build time. Dynamic routes
 * (programs, countries) read their identifiers + updatedAt from the
 * tables RLS allows public read on. Phase 5 will add weekly-rescrape
 * lastModified updates so search engines see fresh dates when policy
 * changes detect new edits.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/programs`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${SITE_URL}/methodology`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    { url: `${SITE_URL}/changes`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];

  let dynamicEntries: MetadataRoute.Sitemap = [];

  // Skip the DB-driven branch entirely when DATABASE_URL is absent —
  // typically at `next build` inside Cloud Build, where DATABASE_URL is a
  // runtime --set-secrets only and not a build-arg. The static entries
  // above are still emitted; per-program / per-country sitemap rows will
  // populate on the next ISR window after the deploy is live.
  if (!process.env['DATABASE_URL']) {
    return staticEntries;
  }

  try {
    const [programsRaw, countriesRaw] = await Promise.all([
      db.execute(sql`
        SELECT id, updated_at AS "updatedAt"
        FROM programs
        ORDER BY country_iso, name
      `),
      db.execute(sql`
        SELECT iso_code AS "isoCode" FROM countries ORDER BY iso_code
      `),
    ]);
    const programs = programsRaw as unknown as ProgramRow[];
    const countries = countriesRaw as unknown as CountryRow[];
    dynamicEntries = [
      ...programs.map<MetadataRoute.Sitemap[number]>((p) => ({
        url: `${SITE_URL}/programs/${p.id}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
      ...countries.map<MetadataRoute.Sitemap[number]>((c) => ({
        url: `${SITE_URL}/countries/${c.isoCode}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
    ];
  } catch (err) {
    // If the DB is unreachable at build/sitemap-render time we still want
    // the static routes to ship. Logged structured to Cloud Logging.
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'sitemap_dynamic_fetch_failed'
    );
  }

  return [...staticEntries, ...dynamicEntries];
}
