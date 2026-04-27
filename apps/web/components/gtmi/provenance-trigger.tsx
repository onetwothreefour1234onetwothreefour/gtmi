'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { readProvenance, type FieldValueStatus, type Provenance } from '@/lib/provenance';
import { ProvenanceHighlight } from './provenance-highlight';

export interface ProvenanceTriggerProps {
  /** Raw provenance JSONB from `field_values.provenance`. */
  provenance: unknown;
  /** Row status drives whether reviewer/reviewedAt/reviewerNotes are required. */
  status: FieldValueStatus;
  /** Raw extracted value, displayed as a header alongside the optional currency. */
  valueRaw?: string | null;
  /** Optional override for the trigger label (used in dense table rows). */
  triggerLabel?: string;
  className?: string;
}

const TIER_LABEL: Record<number, string> = {
  1: 'Tier 1 — government source',
  2: 'Tier 2 — law firm / advisory',
  3: 'Tier 3 — news / monitoring',
};

const GEO_LABEL = {
  global: 'Global',
  continental: 'Continental',
  national: 'National',
  regional: 'Regional',
} as const;

const CROSS_CHECK_LABEL = {
  agrees: 'Agrees',
  disagrees: 'Disagrees',
  not_checked: 'Not checked',
} as const;

function relative(scrapedAt: string): string {
  const then = new Date(scrapedAt).getTime();
  if (Number.isNaN(then)) return scrapedAt;
  const diff = Date.now() - then;
  const days = Math.round(diff / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

/**
 * Subtle info icon. On hover (200ms) opens a popover rendering the ADR-007
 * provenance schema. Renders an explicit "Provenance incomplete" error chip
 * when required keys are missing — fail-loud per dispatch §5.
 *
 * Phase 5 will flip a feature flag to enable the Wayback link; Phase 4 shows
 * it disabled with the documented tooltip per ADR-008.
 */
export function ProvenanceTrigger({
  provenance,
  status,
  valueRaw,
  triggerLabel,
  className,
}: ProvenanceTriggerProps) {
  const result = readProvenance(provenance, status);

  if (!result.ok) {
    return (
      <span
        title={`Missing required keys: ${result.missing.join(', ')}`}
        className={cn(
          'inline-flex h-5 items-center rounded-button border border-destructive/40 bg-destructive/10 px-1.5 font-sans text-[10px] font-medium text-destructive',
          className
        )}
        data-testid="provenance-incomplete"
        role="alert"
      >
        Provenance incomplete
      </span>
    );
  }

  const p = result.provenance as Provenance;
  const confExtraction = Math.round(p.extractionConfidence * 100);
  const confValidation = Math.round(p.validationConfidence * 100);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Show provenance for this value"
          data-testid="provenance-trigger"
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            className
          )}
        >
          {triggerLabel ?? <InfoGlyph />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-md rounded-card border border-border bg-popover p-4 text-data-sm leading-relaxed text-popover-foreground shadow-lg"
        >
          {valueRaw && (
            <div className="mb-3 flex items-baseline gap-2 border-b border-border pb-2">
              <span className="font-mono text-data-md text-foreground">{valueRaw}</span>
              {p.valueCurrency && (
                <span className="font-mono text-data-sm text-muted-foreground">
                  {p.valueCurrency}
                </span>
              )}
            </div>
          )}

          <ProvenanceHighlight sentence={p.sourceSentence} charOffsets={p.charOffsets} />

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-data-sm">
            <dt className="text-muted-foreground">Source</dt>
            <dd className="truncate">
              <a
                href={p.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline-offset-4 hover:underline"
              >
                View at source
              </a>{' '}
              <span className="text-muted-foreground">
                · {GEO_LABEL[p.geographicLevel]} · {TIER_LABEL[p.sourceTier]}
              </span>
            </dd>

            <dt className="text-muted-foreground">Scraped</dt>
            <dd>
              <time dateTime={p.scrapedAt} title={p.scrapedAt}>
                {relative(p.scrapedAt)}
              </time>
            </dd>

            <dt className="text-muted-foreground">Content hash</dt>
            <dd>
              <span title={p.contentHash} className="font-mono text-[11px]">
                {p.contentHash.slice(0, 8)}…
              </span>
            </dd>

            <dt className="text-muted-foreground">Extraction</dt>
            <dd>
              <span className="font-mono text-[11px]">{p.extractionModel}</span>
              <ConfidenceBar value={confExtraction} />
            </dd>

            <dt className="text-muted-foreground">Validation</dt>
            <dd>
              <span className="font-mono text-[11px]">{p.validationModel}</span>
              <ConfidenceBar value={confValidation} />
            </dd>

            <dt className="text-muted-foreground">Cross-check</dt>
            <dd>{CROSS_CHECK_LABEL[p.crossCheckResult]}</dd>

            <dt className="text-muted-foreground">Methodology</dt>
            <dd className="font-mono text-[11px]">{p.methodologyVersion}</dd>

            {status === 'approved' && p.reviewer && (
              <>
                <dt className="text-muted-foreground">Reviewed</dt>
                <dd>
                  <span title={p.reviewedAt}>{p.reviewer}</span>
                  {p.reviewerNotes && (
                    <p className="mt-0.5 text-muted-foreground">{p.reviewerNotes}</p>
                  )}
                </dd>
              </>
            )}

            {p.stabilityEdgeCase && (
              <>
                <dt className="text-muted-foreground">Note</dt>
                <dd className="text-precalib-fg">
                  E.1.1 mean-substitution applied (program younger than 3 years).
                </dd>
              </>
            )}
          </dl>

          <div className="mt-3 border-t border-border pt-2">
            <span
              title="Historical archival ships in Phase 5"
              aria-disabled="true"
              className="cursor-not-allowed text-data-sm text-muted-foreground line-through"
            >
              View archived version
            </span>
          </div>

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <span className="inline-block h-1 w-12 rounded-table bg-muted" aria-hidden>
        <span
          className="block h-full rounded-table bg-accent"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
      <span className="font-mono text-[10px] tnum text-muted-foreground">{value}%</span>
    </span>
  );
}

function InfoGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
