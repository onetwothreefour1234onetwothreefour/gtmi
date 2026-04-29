import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TopNavProps {
  /** Active route id — drives the underline marker. */
  active?: 'rankings' | 'programs' | 'countries' | 'methodology' | 'about' | 'changes';
  className?: string;
}

const ITEMS: { id: NonNullable<TopNavProps['active']>; label: string; href: string }[] = [
  { id: 'rankings', label: 'Rankings', href: '/' },
  { id: 'programs', label: 'Programmes', href: '/programs' },
  { id: 'countries', label: 'Countries', href: '/programs' },
  { id: 'methodology', label: 'Methodology', href: '/methodology' },
  { id: 'changes', label: 'Changes', href: '/changes' },
  { id: 'about', label: 'About', href: '/about' },
];

/**
 * Editorial top nav. Replaces the Phase 4.1 header in `(public)/layout.tsx`.
 * Translates docs/design/primitives.jsx:TopNav with the methodology
 * vocabulary (Q1 — pillar labels in copy, but the route names stay).
 */
export function TopNav({ active = 'rankings', className }: TopNavProps) {
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
