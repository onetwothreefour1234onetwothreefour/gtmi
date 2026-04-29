import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface EditorsQuoteProps {
  /** Quote body. Default is the Edition 1 standfirst from
   *  docs/design/screen-rankings-v2.jsx:EditorsQuote. */
  children?: React.ReactNode;
  /** Optional CTA link beneath the byline. */
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}

const DEFAULT_QUOTE = `A talent visa programme is a contract between a sovereign and a stranger. GTMI exists because most of those contracts have never been read end-to-end, and almost none have been compared on the same terms.`;

/**
 * Full-bleed dark quote section. Editorial team standfirst rendered in
 * Fraunces with a drop-cap. Translates docs/design/screen-rankings-v2.jsx:
 * EditorsQuote.
 */
export function EditorsQuote({
  children,
  ctaHref = '/about',
  ctaLabel = 'Read the full note →',
  className,
}: EditorsQuoteProps) {
  return (
    <section
      className={cn('px-12 py-24', className)}
      style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      data-testid="editors-quote"
    >
      <div className="mx-auto max-w-[980px]">
        <div className="mb-8 flex items-center gap-4">
          <span className="block h-px w-12" style={{ background: 'var(--accent)' }} aria-hidden />
          <p className="eyebrow" style={{ color: 'var(--accent-soft)' }}>
            From the editors · No. 01
          </p>
        </div>
        <blockquote
          className="serif dropcap"
          style={{
            fontSize: 42,
            fontWeight: 300,
            lineHeight: 1.22,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--paper)',
          }}
        >
          {children ?? DEFAULT_QUOTE}
        </blockquote>
        <div
          className="mt-12 flex items-center gap-6 border-t pt-8"
          style={{ borderColor: 'rgba(247,244,237,0.15)' }}
        >
          <span className="block h-12 w-1" style={{ background: 'var(--accent)' }} aria-hidden />
          <div>
            <p className="serif italic" style={{ fontSize: 17, fontWeight: 500 }}>
              The GTMI Editorial Team
            </p>
            <p
              className="mt-1"
              style={{
                fontSize: 12,
                color: 'rgba(247,244,237,0.6)',
                fontFamily: 'var(--font-mono), ui-monospace, monospace',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              TTR Group · Editor&rsquo;s note
            </p>
          </div>
          <span className="flex-1" />
          <Link
            href={ctaHref}
            className="text-data-sm"
            style={{
              color: 'var(--paper)',
              borderBottom: '1px solid rgba(247,244,237,0.4)',
              paddingBottom: 1,
            }}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
