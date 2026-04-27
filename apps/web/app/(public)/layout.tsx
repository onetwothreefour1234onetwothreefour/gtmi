import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-button focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/85 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[60px] max-w-page items-center justify-between gap-6 px-6"
      >
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight text-ink">
          GTMI
        </Link>
        <ul className="hidden items-center gap-6 text-data-md text-muted-foreground md:flex">
          <li>
            <Link href="/methodology" className="hover:text-ink">
              Methodology
            </Link>
          </li>
          <li>
            <Link href="/programs" className="hover:text-ink">
              Programs
            </Link>
          </li>
          <li>
            <Link href="/changes" className="hover:text-ink">
              Changes
            </Link>
          </li>
          <li>
            <Link href="/about" className="hover:text-ink">
              About
            </Link>
          </li>
        </ul>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface text-data-sm text-muted-foreground">
      <div className="mx-auto grid max-w-page grid-cols-1 gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-data-md text-ink">Global Talent Mobility Index</p>
          <p className="mt-2 max-w-prose">
            85 talent-based mobility programs across the 30 most appealing economies. Every weight
            published, every data point traced to a government source.
          </p>
        </div>
        <div>
          <p className="text-ink">Sections</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/methodology" className="hover:text-ink">
                Methodology
              </Link>
            </li>
            <li>
              <Link href="/programs" className="hover:text-ink">
                Programs
              </Link>
            </li>
            <li>
              <Link href="/changes" className="hover:text-ink">
                Policy changes
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-ink">
                About
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-ink">Project</p>
          <ul className="mt-2 space-y-1">
            <li>TTR Group</li>
            <li>
              Citation guidance: see{' '}
              <Link href="/about" className="hover:text-ink">
                About
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
