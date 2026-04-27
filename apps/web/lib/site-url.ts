/**
 * Canonical site origin used for absolute URLs in metadata, sitemap entries,
 * and JSON-LD identifiers. Driven by `NEXT_PUBLIC_APP_URL` (set per-deploy
 * via Secret Manager and baked into the Cloud Run image at build time).
 *
 * Falls back to the public preview URL placeholder so the build does not
 * crash when env is missing — the SEO surfaces will still render but
 * with a less-than-ideal canonical.
 */
export const SITE_URL = (process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://gtmi.example').replace(
  /\/+$/,
  ''
);

export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) return `${SITE_URL}/${path}`;
  return `${SITE_URL}${path}`;
}
