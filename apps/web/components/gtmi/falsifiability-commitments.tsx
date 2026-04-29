import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FalsifiabilityCommitment {
  /** Two-digit numeral, rendered in oxblood serif. */
  numeral: string;
  /** Headline (Fraunces). */
  title: string;
  /** Body copy (sans, ink-3). */
  body: React.ReactNode;
}

export interface FalsifiabilityCommitmentsProps {
  /** Override the canonical six commitments. Default rendering matches design. */
  items?: FalsifiabilityCommitment[];
  className?: string;
}

const DEFAULT_COMMITMENTS: FalsifiabilityCommitment[] = [
  {
    numeral: '01',
    title: 'Every score is traceable to a primary source.',
    body: 'No indicator is computed from secondary or aggregated data without an upstream chain. If a source disappears, the score is flagged within 24 hours.',
  },
  {
    numeral: '02',
    title: 'The scoring spec is the live document.',
    body: 'methodology_versions drives both this page and the production scoring engine. There is no separate "executive summary" version.',
  },
  {
    numeral: '03',
    title: 'Every change is recorded with diff and impact.',
    body: 'Methodology, data, and provenance changes are logged with their composite-score impact. Nothing is silently revised.',
  },
  {
    numeral: '04',
    title: 'Pre-calibration is disclosed at every score.',
    body: 'Programmes scored against engineer-chosen normalization ranges carry a Pre-cal chip until the 5-country pilot calibration ships in Phase 5.',
  },
  {
    numeral: '05',
    title: 'Sources are archived, not just linked.',
    body: 'Every primary source is captured, hashed (sha256), and stored. We score against the snapshot, not the live URL.',
  },
  {
    numeral: '06',
    title: 'Disagreements are part of the record.',
    body: 'When we revise a score after a credible challenge, the prior value, the challenge, and the resolution are kept on the change log indefinitely.',
  },
];

/**
 * The six "promises that hold the index together". Two-column layout: a
 * sticky standfirst on the left, a numbered list with oxblood numerals on
 * the right. Translates docs/design/screen-methodology.jsx:
 * FalsifiabilityCommitments.
 */
export function FalsifiabilityCommitments({
  items = DEFAULT_COMMITMENTS,
  className,
}: FalsifiabilityCommitmentsProps) {
  return (
    <section
      className={cn('px-12 py-16', className)}
      style={{ background: 'var(--paper-2)' }}
      data-testid="falsifiability-commitments"
    >
      <div className="mx-auto grid max-w-page items-start gap-16 md:grid-cols-[1fr_1.4fr]">
        <div className="md:sticky md:top-8">
          <p className="eyebrow mb-4">Falsifiability commitments</p>
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
            The promises that hold the index together.
          </h2>
          <p className="mt-4 text-ink-3" style={{ fontSize: 15, lineHeight: 1.6 }}>
            Composite indices live or die by what they refuse to do. These are ours.
          </p>
        </div>
        <ol className="flex flex-col">
          {items.map((it, i) => (
            <li
              key={it.numeral}
              className={cn('grid gap-6 py-6', i === 0 ? 'border-t-2' : 'border-t')}
              style={{
                gridTemplateColumns: '60px 1fr',
                borderColor: i === 0 ? 'var(--ink)' : 'var(--rule)',
              }}
            >
              <div
                className="num-l"
                style={{ fontSize: 28, color: 'var(--accent)', lineHeight: 1 }}
              >
                {it.numeral}
              </div>
              <div>
                <h3
                  className="serif"
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {it.title}
                </h3>
                <p
                  className="mt-2 text-ink-3"
                  style={{ fontSize: 14, lineHeight: 1.6, margin: '8px 0 0' }}
                >
                  {it.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
