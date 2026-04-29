import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface GtmiFooterProps {
  /** ISO date string of the most recent extraction. Drives the "Last refresh" line. */
  lastVerifiedAt?: string | null;
  className?: string;
}

const COLS: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: 'The Index',
    items: [
      { label: 'Rankings', href: '/' },
      { label: 'Programmes', href: '/programs' },
      { label: 'Compare', href: '/programs' },
    ],
  },
  {
    title: 'Methodology',
    items: [
      { label: 'Weight tree', href: '/methodology' },
      { label: '30 / 70 split', href: '/methodology' },
      { label: 'Falsifiability', href: '/methodology' },
      { label: 'Provenance', href: '/methodology' },
      { label: 'Pre-calibration', href: '/methodology' },
    ],
  },
  {
    title: 'Transparency',
    items: [
      { label: 'Changes log', href: '/changes' },
      { label: 'About the index', href: '/about' },
      { label: 'Cite this index', href: '/about' },
    ],
  },
  {
    title: 'TTR Group',
    items: [
      { label: 'About', href: '/about' },
      { label: 'Editorial team', href: '/about' },
      { label: 'careers@ttrgroup.ae', href: 'mailto:careers@ttrgroup.ae' },
    ],
  },
];

const PRIMARY_SOURCES = [
  'SEM',
  'Home Office',
  'IND NL',
  'BAMF',
  'IRCC',
  'USCIS',
  'MOM SG',
  'IMM HK',
  'DHA AU',
  'INZ NZ',
  'MOFA JP',
  'IND FR',
  'OECD MIG',
  'Eurostat',
  'World Bank',
  'IMF',
  'ICAEW',
  'ILO',
];

function formatRefreshDate(iso: string | null | undefined): string {
  if (!iso) return 'Continuously updated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Continuously updated';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

/**
 * Editorial footer. Replaces the 3-column footer in the Phase 4.1 layout.
 * Dark ink surface, four sections + "Primary data sources" strip. Translates
 * docs/design/screen-rankings-v2.jsx:GtmiFooter.
 */
export function GtmiFooter({ lastVerifiedAt, className }: GtmiFooterProps) {
  const refresh = formatRefreshDate(lastVerifiedAt);
  return (
    <footer
      className={cn('px-8 pb-8 pt-16', className)}
      style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      data-testid="gtmi-footer"
    >
      <div className="mx-auto max-w-page">
        <div
          className="grid gap-12 border-b pb-12"
          style={{
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr',
            borderColor: 'rgba(247,244,237,0.15)',
          }}
        >
          <div>
            <p
              className="serif"
              style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}
            >
              GTMI
            </p>
            <p
              className="mt-1 leading-snug"
              style={{ fontSize: 11, color: 'rgba(247,244,237,0.55)' }}
            >
              Global Talent Mobility Index
              <br />A research instrument by TTR Group
            </p>
            <p
              className="mt-6 leading-relaxed"
              style={{
                fontSize: 11,
                color: 'rgba(247,244,237,0.5)',
                fontFamily: 'var(--font-mono), ui-monospace, monospace',
              }}
            >
              Continuously updated
              <br />
              Last refresh: <time dateTime={lastVerifiedAt ?? undefined}>{refresh}</time>
              <br />
              Built by TTR Group
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-4" style={{ color: 'rgba(247,244,237,0.5)', fontSize: 10 }}>
                {col.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-data-sm hover:underline"
                      style={{ color: 'var(--paper)' }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-b py-8" style={{ borderColor: 'rgba(247,244,237,0.15)' }}>
          <p className="eyebrow mb-3" style={{ color: 'rgba(247,244,237,0.5)', fontSize: 10 }}>
            Primary data sources
          </p>
          <ul className="flex flex-wrap gap-2">
            {PRIMARY_SOURCES.map((src) => (
              <li
                key={src}
                className="border px-2 py-1"
                style={{
                  borderColor: 'rgba(247,244,237,0.2)',
                  color: 'rgba(247,244,237,0.7)',
                  fontFamily: 'var(--font-mono), ui-monospace, monospace',
                  fontSize: 10,
                }}
              >
                {src}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="flex items-center justify-between pt-6"
          style={{
            fontSize: 11,
            color: 'rgba(247,244,237,0.5)',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
          }}
        >
          <span>© TTR Group. All rights reserved.</span>
          <span className="flex gap-6">
            <Link href="/about" style={{ color: 'rgba(247,244,237,0.7)' }}>
              Terms
            </Link>
            <Link href="/about" style={{ color: 'rgba(247,244,237,0.7)' }}>
              Privacy
            </Link>
            <Link href="/about" style={{ color: 'rgba(247,244,237,0.7)' }}>
              Contact
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
