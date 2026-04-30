import { TopNav, GtmiFooter } from '@/components/gtmi';
import { getCohortStats } from '@/lib/queries/cohort-stats';

// Runtime render. The layout itself queries the DB (cohort stats for the
// footer's last-refresh line); without this directive Next.js attempts a
// build-time prerender of every leaf page that consumes this layout, which
// fails on Cloud Build because DATABASE_URL is a Cloud Run runtime secret.
// Cross-request caching is preserved by the `unstable_cache` wrapper inside
// `getCohortStats`.
export const dynamic = 'force-dynamic';

/**
 * Public route shell — Phase 4-B redesign. Replaces the Phase 4.1 sticky
 * 60px header + 3-column footer with the editorial `<TopNav>` (rankings
 * underline) and full-bleed `<GtmiFooter>` (4 nav columns + primary
 * source strip + legal row).
 *
 * The `lastVerifiedAt` propagated to the footer is the same value rendered
 * in the landing-page stats strip — single round-trip via `unstable_cache`,
 * so the layout doesn't hit the DB twice on first paint.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const stats = await getCohortStats();
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <GtmiFooter lastVerifiedAt={stats.lastVerifiedAt} />
    </div>
  );
}
