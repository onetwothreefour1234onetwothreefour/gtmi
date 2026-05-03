import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CountryFlag } from './country-flag';
import {
  isBulkApproveCandidate,
  readProvenanceConfidence,
  readQualitySignals,
  relativeAge,
  reviewIdTag,
  slaTier,
  sourceDomain,
  type QualitySignals,
  type SlaTier,
} from '@/lib/review-queue-helpers';
import type { ReviewListRow } from '@/lib/review-queries';

export interface ReviewQueueTableProps {
  rows: ReviewListRow[];
  /** Pass `now` from the server render so SSR + hydration agree on relative-age. */
  now?: Date;
  /**
   * Phase 3.10d / D.3 — current reviewer UUID (?reviewer=…), pre-auth stub.
   * When set, unassigned rows render an inline "Assign me" form action.
   */
  reviewerId?: string | null;
  /**
   * Phase 3.10d / D.3 — server action invoked by the inline form. The
   * action reads `rowId` and `reviewer` from FormData and updates
   * review_queue.assigned_to. Decoupled from the table so this file
   * stays free of `'use server'` and can be unit-tested.
   */
  onAssign?: (formData: FormData) => Promise<void>;
  className?: string;
}

/**
 * I-01 review queue table. Editorial table.gtmi atom from globals.css.
 * Columns: ID · Programme · Indicator · Source · Impact · Conf · Age ·
 * Reviewer · Status · Open. The Impact column renders `—` per analyst Q9
 * (composite-delta computation deferred).
 */
export function ReviewQueueTable({
  rows,
  now,
  reviewerId,
  onAssign,
  className,
}: ReviewQueueTableProps) {
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
          {rows.map((row, idx) => {
            const prov = readProvenanceConfidence(row.provenance);
            const qs = readQualitySignals(row.provenance);
            const tag = reviewIdTag(row.id);
            const candidate = isBulkApproveCandidate(prov);
            const lowConfidence =
              prov.extractionConfidence !== null && prov.extractionConfidence < 0.7;
            const sla = slaTier(row.extractedAt, now);
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
                data-row-index={idx}
                data-row-id={row.id}
                data-sla-tier={sla}
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
                  <QualitySignalChips qs={qs} />
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
                  <span
                    className="num text-ink-3 inline-flex items-center gap-1.5"
                    style={{ fontSize: 12 }}
                  >
                    <SlaDot tier={sla} />
                    {relativeAge(row.extractedAt, now)}
                  </span>
                </td>
                <td>
                  <ReviewerCell
                    rowId={row.id}
                    assignedTo={row.assignedTo}
                    assignedAt={row.assignedAt}
                    now={now}
                    reviewerId={reviewerId ?? null}
                    onAssign={onAssign}
                  />
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

function QualitySignalChips({ qs }: { qs: QualitySignals }) {
  if (!qs.crossCheckDisagrees && !qs.deriveLlmMismatch) return null;
  return (
    <span className="mt-1 inline-flex flex-wrap gap-1" data-testid="quality-signal-chips">
      {qs.crossCheckDisagrees && (
        <span
          className="chip chip-accent"
          style={{ fontSize: 10 }}
          title={
            qs.crossCheckUrl
              ? `Tier-2 source disagrees: ${qs.crossCheckUrl}`
              : 'Tier-2 source disagrees with the extracted value'
          }
          data-testid="chip-crosscheck-disagree"
        >
          ✗ Cross-check
        </span>
      )}
      {qs.deriveLlmMismatch && (
        <span
          className="chip chip-accent"
          style={{ fontSize: 10 }}
          title={qs.mismatchNote ?? 'Derived value differs from prior LLM extraction'}
          data-testid="chip-derive-mismatch"
        >
          ⚠ Derive ↔ LLM
        </span>
      )}
    </span>
  );
}

function ReviewerCell({
  rowId,
  assignedTo,
  assignedAt,
  now,
  reviewerId,
  onAssign,
}: {
  rowId: string;
  assignedTo: string | null;
  assignedAt: Date | null;
  now?: Date;
  reviewerId: string | null;
  onAssign?: (formData: FormData) => Promise<void>;
}) {
  if (assignedTo === null) {
    // Phase 3.10d / D.3 — when ?reviewer=<uuid> is present, render an
    // inline form action so the analyst can claim the row without
    // pasting their UUID into a prompt.
    if (reviewerId && onAssign) {
      return (
        <form action={onAssign} data-testid="assign-me-form" data-row-id={rowId}>
          <input type="hidden" name="rowId" value={rowId} />
          <input type="hidden" name="reviewer" value={reviewerId} />
          <button
            type="submit"
            className="btn-link num"
            style={{ fontSize: 11 }}
            data-testid="assign-me-button"
          >
            Assign me ›
          </button>
        </form>
      );
    }
    return (
      <span
        className="num text-ink-5"
        style={{ fontSize: 11, fontStyle: 'italic' }}
        data-testid="reviewer-cell"
        data-row-id={rowId}
      >
        Unassigned
      </span>
    );
  }
  // Render the first 8 chars of the UUID as a compact handle.
  const short = assignedTo.slice(0, 8);
  const ageStr = assignedAt ? relativeAge(assignedAt, now) : null;
  const isMine = reviewerId !== null && assignedTo === reviewerId;
  return (
    <span
      className={cn('num inline-flex items-center gap-1', isMine ? 'text-ink' : 'text-ink-3')}
      style={{ fontSize: 11 }}
      data-testid="reviewer-cell"
      data-row-id={rowId}
      data-assigned-to={assignedTo}
      data-mine={isMine ? 'true' : 'false'}
      title={`Assigned ${ageStr ?? ''} (${assignedTo})`}
    >
      {isMine ? 'Me' : `${short}…`}
    </span>
  );
}

function SlaDot({ tier }: { tier: SlaTier }) {
  if (tier === 'green') return null;
  const color = tier === 'red' ? 'var(--accent)' : 'var(--warning)';
  const label = tier === 'red' ? 'SLA breach: 14+ days old' : 'SLA warning: 7+ days old';
  return (
    <span
      aria-label={label}
      title={label}
      role="img"
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: 3,
        background: color,
      }}
      data-testid={`sla-dot-${tier}`}
    />
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
