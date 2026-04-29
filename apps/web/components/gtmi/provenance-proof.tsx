import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface ProvenanceProofProps {
  className?: string;
}

/**
 * Editorial provenance exhibit — translates
 * docs/design/screen-rankings-v2.jsx:ProvenanceProof.
 *
 * Two-column section: left explains the differentiator + CTA; right shows
 * one indicator's primary-source extract verbatim, with character offsets,
 * page number, sha256, and scrape timestamp. The exhibit is static here —
 * the live equivalent ships on `/programs/[id]` (Phase C).
 */
export function ProvenanceProof({ className }: ProvenanceProofProps) {
  return (
    <section
      className={cn('border-b px-12 py-20', className)}
      style={{ background: 'var(--paper-2)', borderColor: 'var(--rule)' }}
      data-testid="provenance-proof"
    >
      <div className="mx-auto grid max-w-page items-start gap-16 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow mb-4">Provenance · the differentiator</p>
          <h2
            className="serif"
            style={{
              fontSize: 36,
              fontWeight: 400,
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Every score on this page traces to a sentence in a primary document.
          </h2>
          <p className="mt-4 text-ink-3" style={{ fontSize: 15, lineHeight: 1.6 }}>
            No aggregator data, no &ldquo;industry consensus&rdquo;, no marketing copy. If we
            can&rsquo;t point to the words, we don&rsquo;t score the indicator. Here&rsquo;s one,
            fully exposed.
          </p>
          <Link href="/methodology" className="btn mt-8">
            How provenance works →
          </Link>
        </div>

        <div className="border border-rule bg-paper p-7">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="num text-data-sm text-ink-4">A.03</p>
              <p className="serif mt-1" style={{ fontSize: 18, fontWeight: 500 }}>
                Labour-market test required
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow" style={{ fontSize: 9 }}>
                Score
              </p>
              <p className="num-l" style={{ fontSize: 22 }}>
                62
              </p>
            </div>
          </div>
          <div className="border-t border-rule pt-4">
            <p className="num mb-2 text-ink-4" style={{ fontSize: 11 }}>
              SEM · Bundesgesetz über die Ausländerinnen und Ausländer · §21
            </p>
            <p
              className="serif"
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--ink-2)',
                borderLeft: '3px solid var(--accent)',
                paddingLeft: 16,
              }}
            >
              […] Eine Bewilligung kann nur erteilt werden, wenn nachgewiesen ist, dass{' '}
              <mark style={{ background: '#FBE5DC', padding: '1px 0' }}>
                für die anzustellende Person in der Schweiz und in den EU/EFTA-Staaten keine
                geeignete Person gefunden werden konnte
              </mark>
              . Der Vorrang ist während mindestens vier Wochen […]
            </p>
            <dl
              className="num mt-4 grid grid-cols-4 gap-3 border-t border-rule-soft pt-3 text-ink-4"
              style={{ fontSize: 11 }}
            >
              <div>
                <dt style={{ color: 'var(--ink-5)' }}>chars</dt>
                <dd>14,231 → 14,498</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-5)' }}>page</dt>
                <dd>12 / 87</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-5)' }}>sha256</dt>
                <dd>8f3a…b21c</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-5)' }}>scraped</dt>
                <dd>2026-03-28</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
