import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CountryFlag } from './country-flag';
import {
  isBulkApproveCandidate,
  readProvenanceConfidence,
  relativeAge,
  reviewIdTag,
  sourceDomain,
} from '@/lib/review-queue-helpers';
import type { ReviewListRow } from '@/lib/review-queries';

export interface ReviewQueueTableProps {
  rows: ReviewListRow[];
  /** Pass `now` from the server render so SSR + hydration agree on relative-age. */
  now?: Date;
  className?: string;
}

/**
 * I-01 review queue table. Editorial table.gtmi atom from globals.css.
 * Columns: ID · Programme · Indicator · Source · Impact · Conf · Age ·
 * Reviewer · Status · Open. The Impact column renders `—` per analyst Q9
 * (composite-delta computation deferred).
 */
export function ReviewQueueTable({ rows, now, className }: ReviewQueueTableProps) {
  if (rows.length === 0) {
    return (
      <p className={cn('italic text-ink-4', className)} data-testid="review-queue-empty">
        Nothing matches this filter.
      </p>
    );
  }
  return (
    <div className={cn('w-full overflow-x-auto', className)} data-testid="review-queue-table">
      <table className="gtmi tabular w-full">
        <thead>
          <tr>
            <th style={{ width: 110 }}>ID</th>
            <th>Programme</th>
            <th style={{ width: 140 }}>Indicator</th>
            <th style={{ width: 180 }}>Source</th>
            <th style={{ width: 90, textAlign: 'right' }}>Impact</th>
            <th style={{ width: 130, textAlign: 'right' }}>Conf.</th>
            <th style={{ width: 60 }}>Age</th>
            <th style={{ width: 110 }}>Reviewer</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 60 }} aria-hidden></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const prov = readProvenanceConfidence(row.provenance);
            const tag = reviewIdTag(row.id);
            const candidate = isBulkApproveCandidate(prov);
            const lowConfidence =
              prov.extractionConfidence !== null && prov.extractionConfidence < 0.7;
            const statusKind = candidate
              ? 'high-confidence'
              : lowConfidence
                ? 'flagged'
                : row.status === 'pending_review'
                  ? 'pending'
                  : row.status;
            return (
              <tr
                key={row.id}
                data-testid="review-queue-row"
                data-row-status={statusKind}
                data-bulk-approve-candidate={candidate ? 'true' : 'false'}
              >
                <td>
                  <span className="num text-ink-4" style={{ fontSize: 11 }}>
                    {tag}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/programs/${row.programId}`}
                    className="serif inline-flex items-center gap-2 hover:text-accent"
                    style={{ fontSize: 14, fontWeight: 500 }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CountryFlag iso={row.countryIso} countryName={row.countryName} size="sm" />
                    {row.programName}
                  </Link>
                </td>
                <td>
                  <span className="num text-ink" style={{ fontSize: 12 }}>
                    {row.fieldKey}
                  </span>
                  <p className="text-data-sm text-ink-4" style={{ fontSize: 11 }}>
                    {row.fieldLabel}
                  </p>
                </td>
                <td>
                  <span className="num text-ink-4" style={{ fontSize: 11 }}>
                    {sourceDomain(row.sourceUrl)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span
                    className="num text-ink-4"
                    style={{ fontSize: 12 }}
                    title="Composite delta computation lands in a future phase (Q9)"
                    data-testid="impact-cell"
                  >
                    —
                  </span>
                </td>
                <td>
                  <ConfidenceCell prov={prov} />
                </td>
                <td>
                  <span className="num text-ink-3" style={{ fontSize: 12 }}>
                    {relativeAge(row.extractedAt, now)}
                  </span>
                </td>
                <td>
                  <span
                    className="num text-ink-5"
                    style={{ fontSize: 11, fontStyle: 'italic' }}
                    data-testid="reviewer-cell"
                  >
                    Unassigned
                  </span>
                </td>
                <td>
                  <StatusChip kind={statusKind} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link
                    href={`/review/${row.id}`}
                    className="btn-link num"
                    style={{ fontSize: 11 }}
                  >
                    Open ›
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceCell({ prov }: { prov: ReturnType<typeof readProvenanceConfidence> }) {
  const value = prov.extractionConfidence;
  if (value === null) {
    return (
      <span className="num text-ink-4" style={{ fontSize: 12 }}>
        —
      </span>
    );
  }
  const pct = Math.max(0, Math.min(100, value * 100));
  const accent =
    value >= 0.85 ? 'var(--positive)' : value >= 0.7 ? 'var(--warning)' : 'var(--accent)';
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="num" style={{ fontSize: 12 }}>
        {value.toFixed(2)}
      </span>
      <span aria-hidden className="block w-9" style={{ height: 4, background: 'var(--rule-soft)' }}>
        <span className="block h-full" style={{ width: `${pct}%`, background: accent }} />
      </span>
    </span>
  );
}

function StatusChip({ kind }: { kind: string }) {
  const map: Record<string, { className: string; label: string }> = {
    pending: { className: 'chip chip-mute', label: 'Pending' },
    'high-confidence': { className: 'chip chip-mute', label: 'In review' },
    flagged: { className: 'chip chip-accent', label: 'Flagged' },
    approved: { className: 'chip chip-mute', label: 'Approved' },
    rejected: { className: 'chip chip-accent', label: 'Rejected' },
  };
  const entry = map[kind] ?? { className: 'chip chip-mute', label: kind };
  return <span className={entry.className}>{entry.label}</span>;
}
