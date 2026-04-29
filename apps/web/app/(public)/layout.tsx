import { TopNav, GtmiFooter } from '@/components/gtmi';
import { getCohortStats } from '@/lib/queries/cohort-stats';

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
      <TopNav active="rankings" />
      <main id="main" className="flex-1">
        {children}
      </main>
      <GtmiFooter lastVerifiedAt={stats.lastVerifiedAt} />
    </div>
  );
}
