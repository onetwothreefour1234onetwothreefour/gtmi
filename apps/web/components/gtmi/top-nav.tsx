'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type TopNavRoute =
  | 'rankings'
  | 'programs'
  | 'countries'
  | 'methodology'
  | 'about'
  | 'changes';

export interface TopNavProps {
  /**
   * Optional override for the active-route underline. When omitted (the
   * default) the component derives the active route from the current
   * pathname via `usePathname()` so every public page lights up the
   * correct tab without the layout having to thread a prop down.
   *
   * Passing `active` explicitly is still supported for tests and any
   * page that wants to force a specific tab (e.g. a 404 page that
   * should keep "Rankings" highlighted).
   */
  active?: TopNavRoute;
  className?: string;
}

const ITEMS: { id: TopNavRoute; label: string; href: string }[] = [
  { id: 'rankings', label: 'Rankings', href: '/' },
  { id: 'programs', label: 'Programmes', href: '/programs' },
  { id: 'countries', label: 'Countries', href: '/countries' },
  { id: 'methodology', label: 'Methodology', href: '/methodology' },
  { id: 'changes', label: 'Changes', href: '/changes' },
  { id: 'about', label: 'About', href: '/about' },
];

/**
 * Phase 3.8 / nav-highlight bug fix — derive the active route from
 * the URL so every page underlines the correct tab without the
 * layout having to pass an `active` prop. Returns null when the
 * pathname is unknown / the user is on `/login`-style routes that
 * shouldn't claim any nav tab.
 */
export function routeFromPathname(pathname: string | null): TopNavRoute | null {
  if (!pathname) return null;
  if (pathname === '/' || pathname === '') return 'rankings';
  if (pathname === '/programs' || pathname.startsWith('/programs/')) return 'programs';
  if (pathname === '/countries' || pathname.startsWith('/countries/')) return 'countries';
  if (pathname === '/methodology' || pathname.startsWith('/methodology/')) return 'methodology';
  if (pathname === '/changes' || pathname.startsWith('/changes/')) return 'changes';
  if (pathname === '/about' || pathname.startsWith('/about/')) return 'about';
  return null;
}

/**
 * Editorial top nav. Replaces the Phase 4.1 header in `(public)/layout.tsx`.
 * Translates docs/design/primitives.jsx:TopNav with the methodology
 * vocabulary (Q1 — pillar labels in copy, but the route names stay).
 *
 * Phase 3.8 / nav-highlight bug fix — `active` now defaults to
 * deriving from `usePathname()` instead of always falling back to
 * 'rankings'. Fixes the bug where every page under (public)/ kept
 * Rankings underlined regardless of which tab the user was on.
 *
 * Also corrects the Countries link `href` from `/programs` (a
 * pre-existing copy-paste typo) to `/countries`.
 */
export function TopNav({ active: activeOverride, className }: TopNavProps = {}) {
  const pathname = usePathname();
  const active = activeOverride ?? routeFromPathname(pathname);
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-16 items-center justify-between border-b border-rule bg-paper px-8',
        className
      )}
      data-testid="top-nav"
    >
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="flex items-baseline gap-2"
          aria-label="GTMI — Global Talent Mobility Index"
        >
          <span
            className="serif text-ink"
            style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            GTMI
          </span>
          <span
            className="hidden md:inline"
            style={{ fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.02em' }}
          >
            Global Talent Mobility Index
          </span>
        </Link>
      </div>
      <ul className="flex items-center gap-7">
        {ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative pb-1 text-data-sm transition-colors',
                  isActive
                    ? 'border-b-2 border-ink font-semibold text-ink'
                    : 'border-b-2 border-transparent text-ink-4 hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
