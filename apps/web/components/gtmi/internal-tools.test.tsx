import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InternalBadge } from './internal-badge';
import { ReviewQueueStats } from './review-queue-stats';
import { ReviewQueueTable } from './review-queue-table';
import { BulkApproveDialog } from './bulk-approve-dialog';
import { BulkApproveAllDialog } from './bulk-approve-all-dialog';
import { RescoreCohortDialog } from './rescore-cohort-dialog';
import { ChangesAudit } from './changes-audit';
import type { ReviewListRow } from '@/lib/review-queries';
import type { PolicyChangeRow } from '@/lib/queries/policy-changes';

const COMPLETE_PROVENANCE = {
  sourceUrl: 'https://immi.homeaffairs.gov.au/visas/skills-in-demand-482',
  geographicLevel: 'national',
  sourceTier: 1,
  scrapedAt: '2026-04-21T10:00:00.000Z',
  contentHash: 'abc12345',
  sourceSentence: 'The minimum salary is AUD 73,150 per year.',
  charOffsets: [21, 32],
  extractionModel: 'claude-sonnet-4-6',
  extractionConfidence: 0.92,
  validationModel: 'claude-sonnet-4-6',
  validationConfidence: 0.88,
  crossCheckResult: 'agrees',
  methodologyVersion: '1.0.0',
  isValid: true,
};

function mkReviewRow(overrides: Partial<ReviewListRow> = {}): ReviewListRow {
  return {
    id: 'fv-' + Math.random().toString(36).slice(2),
    programId: 'prog-1',
    programName: 'Tech.Pass',
    countryIso: 'SGP',
    countryName: 'Singapore',
    fieldKey: 'A.1.1',
    fieldLabel: 'Minimum salary',
    pillar: 'A',
    status: 'pending_review',
    valueRaw: 'SGD 5,000 / mo',
    extractedAt: new Date('2026-04-29T08:00:00Z'),
    provenance: COMPLETE_PROVENANCE,
    sourceUrl: 'https://www.mom.gov.sg/passes-and-permits/tech-pass',
    assignedTo: null,
    assignedAt: null,
    ...overrides,
  };
}

describe('InternalBadge', () => {
  it('renders the editorial banner with role=note', () => {
    render(<InternalBadge />);
    const badge = screen.getByTestId('internal-badge');
    expect(badge).toHaveAttribute('role', 'note');
    expect(badge).toHaveTextContent('Internal · TTR Group only · not public');
  });
});

describe('ReviewQueueStats', () => {
  it('renders all four cells with mono-styled values', () => {
    render(
      <ReviewQueueStats
        stats={{ inQueue: 47, slaRisk: 3, avgAgeHours: 14.4, highConfidence: 29 }}
      />
    );
    expect(screen.getByTestId('stat-in-queue')).toHaveTextContent('47');
    expect(screen.getByTestId('stat-sla-risk')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-avg-age')).toHaveTextContent('14h');
    expect(screen.getByTestId('stat-high-confidence')).toHaveTextContent('29');
  });

  it('renders dashes for empty queue', () => {
    render(
      <ReviewQueueStats stats={{ inQueue: 0, slaRisk: 0, avgAgeHours: null, highConfidence: 0 }} />
    );
    expect(screen.getByTestId('stat-avg-age')).toHaveTextContent('—');
  });

  it('formats avg age in days when > 48h', () => {
    render(
      <ReviewQueueStats stats={{ inQueue: 5, slaRisk: 5, avgAgeHours: 96, highConfidence: 0 }} />
    );
    expect(screen.getByTestId('stat-avg-age')).toHaveTextContent('4d');
  });
});

describe('ReviewQueueTable', () => {
  it('renders one row per pending item with all design columns', () => {
    const rows: ReviewListRow[] = [
      mkReviewRow({ id: 'fv-1', fieldKey: 'A.1.1' }),
      mkReviewRow({
        id: 'fv-2',
        fieldKey: 'B.4.1',
        provenance: { ...COMPLETE_PROVENANCE, extractionConfidence: 0.65 },
      }),
    ];
    render(<ReviewQueueTable rows={rows} now={new Date('2026-04-29T12:00:00Z')} />);
    const trs = screen.getAllByTestId('review-queue-row');
    expect(trs).toHaveLength(2);

    // Impact column renders dash per Q9 (no composite-delta computation yet).
    const impacts = screen.getAllByTestId('impact-cell');
    for (const cell of impacts) expect(cell).toHaveTextContent('—');

    // Reviewer cell renders 'Unassigned' on every row (no reviewer assignment in schema today).
    const reviewers = screen.getAllByTestId('reviewer-cell');
    for (const cell of reviewers) expect(cell).toHaveTextContent('Unassigned');

    // Source domain shown — first row uses immi.homeaffairs.gov.au stub.
    expect(trs[0]).toHaveTextContent('mom.gov.sg');
  });

  it('marks bulk-approve candidates via data-bulk-approve-candidate', () => {
    const rows: ReviewListRow[] = [
      mkReviewRow({
        id: 'high',
        provenance: {
          ...COMPLETE_PROVENANCE,
          extractionConfidence: 0.92,
          validationConfidence: 0.91,
          isValid: true,
        },
      }),
      mkReviewRow({
        id: 'low',
        provenance: {
          ...COMPLETE_PROVENANCE,
          extractionConfidence: 0.6,
          validationConfidence: 0.6,
          isValid: null,
        },
      }),
    ];
    render(<ReviewQueueTable rows={rows} now={new Date('2026-04-29T12:00:00Z')} />);
    const trs = screen.getAllByTestId('review-queue-row');
    const candidates = trs.filter(
      (tr) => tr.getAttribute('data-bulk-approve-candidate') === 'true'
    );
    expect(candidates).toHaveLength(1);
  });

  it('renders the empty placeholder when rows is empty', () => {
    render(<ReviewQueueTable rows={[]} />);
    expect(screen.queryByTestId('review-queue-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-queue-empty')).toHaveTextContent(/Nothing matches/);
  });
});

describe('BulkApproveDialog', () => {
  it('renders the trigger with the candidate count', () => {
    const onConfirm = vi.fn();
    render(<BulkApproveDialog candidateCount={29} onConfirm={onConfirm} />);
    const trigger = screen.getByTestId('bulk-approve-trigger');
    expect(trigger).toHaveTextContent('Bulk approve high-confidence');
    expect(trigger).toHaveTextContent('29');
    expect(trigger).not.toBeDisabled();
  });

  it('disables the trigger when zero candidates exist', () => {
    const onConfirm = vi.fn();
    render(<BulkApproveDialog candidateCount={0} onConfirm={onConfirm} />);
    const trigger = screen.getByTestId('bulk-approve-trigger');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens a confirmation dialog on click and exposes Cancel + Approve', async () => {
    const onConfirm = vi.fn();
    render(<BulkApproveDialog candidateCount={5} onConfirm={onConfirm} />);
    expect(screen.queryByTestId('bulk-approve-dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('bulk-approve-trigger'));
    const dialog = await screen.findByTestId('bulk-approve-dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Approve 5 pending row/);
    expect(screen.getByTestId('bulk-approve-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-approve-confirm')).toBeInTheDocument();
  });

  it('Cancel closes the dialog without invoking onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<BulkApproveDialog candidateCount={5} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('bulk-approve-trigger'));
    await screen.findByTestId('bulk-approve-dialog');
    await userEvent.click(screen.getByTestId('bulk-approve-cancel'));
    expect(screen.queryByTestId('bulk-approve-dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Approve triggers onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<BulkApproveDialog candidateCount={5} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('bulk-approve-trigger'));
    await userEvent.click(await screen.findByTestId('bulk-approve-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// Phase 3.8 / ADR-020 — bulk-approve-all (skips confidence gate, keeps
// the categorical-rubric gate on).
describe('BulkApproveAllDialog', () => {
  it('renders the trigger with the pending count and the "skips confidence" eyebrow once open', async () => {
    const onConfirm = vi.fn();
    render(<BulkApproveAllDialog pendingCount={42} onConfirm={onConfirm} />);
    const trigger = screen.getByTestId('bulk-approve-all-trigger');
    expect(trigger).toHaveTextContent('Approve ALL pending');
    expect(trigger).toHaveTextContent('42');
    expect(trigger).not.toBeDisabled();
    await userEvent.click(trigger);
    const dialog = await screen.findByTestId('bulk-approve-all-dialog');
    expect(dialog).toHaveTextContent(/skips confidence gate/i);
    expect(dialog).toHaveTextContent(/categorical rubric gate \(ADR-019\) stays on/);
  });

  it('disables the trigger when the queue is empty', () => {
    render(<BulkApproveAllDialog pendingCount={0} onConfirm={vi.fn()} />);
    const trigger = screen.getByTestId('bulk-approve-all-trigger');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
  });

  it('Cancel closes without invoking onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<BulkApproveAllDialog pendingCount={3} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('bulk-approve-all-trigger'));
    await screen.findByTestId('bulk-approve-all-dialog');
    await userEvent.click(screen.getByTestId('bulk-approve-all-cancel'));
    expect(screen.queryByTestId('bulk-approve-all-dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Confirm triggers onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<BulkApproveAllDialog pendingCount={3} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('bulk-approve-all-trigger'));
    await userEvent.click(await screen.findByTestId('bulk-approve-all-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// Phase 3.8 / ADR-020 — cohort re-score confirmation dialog.
describe('RescoreCohortDialog', () => {
  it('renders the trigger and opens the confirmation dialog', async () => {
    render(<RescoreCohortDialog onConfirm={vi.fn()} />);
    const trigger = screen.getByTestId('rescore-cohort-trigger');
    expect(trigger).toHaveTextContent('Re-score cohort');
    await userEvent.click(trigger);
    const dialog = await screen.findByTestId('rescore-cohort-dialog');
    expect(dialog).toHaveTextContent(/Recompute every row score/);
    expect(dialog).toHaveTextContent(/PHASE2_PLACEHOLDER_PARAMS/);
  });

  it('Cancel closes without invoking onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<RescoreCohortDialog onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('rescore-cohort-trigger'));
    await screen.findByTestId('rescore-cohort-dialog');
    await userEvent.click(screen.getByTestId('rescore-cohort-cancel'));
    expect(screen.queryByTestId('rescore-cohort-dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Confirm triggers onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<RescoreCohortDialog onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('rescore-cohort-trigger'));
    await userEvent.click(await screen.findByTestId('rescore-cohort-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ChangesAudit', () => {
  function mkEvent(overrides: Partial<PolicyChangeRow> = {}): PolicyChangeRow {
    return {
      id: 'pc-' + Math.random().toString(36).slice(2),
      detectedAt: '2026-04-15T00:00:00.000Z',
      severity: 'material',
      programId: 'prog-1',
      programName: 'Tech.Pass',
      countryIso: 'SGP',
      countryName: 'Singapore',
      fieldKey: 'A.1.1',
      fieldLabel: 'Minimum salary',
      pillar: 'A',
      summary: 'Salary floor raised by 5%.',
      paqDelta: 1.4,
      waybackUrl: null,
      ...overrides,
    };
  }

  it('renders the empty state with Phase 5 copy when events is empty', () => {
    render(<ChangesAudit events={[]} />);
    expect(screen.getByTestId('changes-audit')).toHaveTextContent(/Phase 5/);
    expect(screen.getByTestId('changes-audit')).toHaveTextContent(
      /Policy change detection ships in Phase 5/
    );
  });

  it('renders all five filter tabs with counts even when empty', () => {
    render(<ChangesAudit events={[]} />);
    for (const id of ['all', 'data', 'methodology', 'provenance', 'countries']) {
      expect(screen.getByTestId(`changes-filter-${id}`)).toBeInTheDocument();
    }
  });

  it('renders timeline rows when events exist', () => {
    render(
      <ChangesAudit
        events={[
          mkEvent({ id: 'a', severity: 'breaking' }),
          mkEvent({ id: 'b', severity: 'material' }),
          mkEvent({ id: 'c', severity: 'minor' }),
        ]}
      />
    );
    expect(screen.getAllByTestId('changes-timeline-row')).toHaveLength(3);
    const diamonds = screen.getAllByTestId('changes-severity-diamond');
    expect(diamonds[0]).toHaveAttribute('data-severity', 'breaking');
    expect(diamonds[1]).toHaveAttribute('data-severity', 'material');
    expect(diamonds[2]).toHaveAttribute('data-severity', 'minor');
  });

  it('filter tab buckets events correctly', async () => {
    const events: PolicyChangeRow[] = [
      mkEvent({ id: 'data-1', pillar: 'A', severity: 'material' }),
      mkEvent({ id: 'country-1', pillar: 'E', severity: 'material' }),
      mkEvent({ id: 'prov-1', pillar: 'B', severity: 'url_broken' }),
    ];
    render(<ChangesAudit events={events} />);
    // Counts should reflect the 1/1/0/1/1 split (all=3, data=1, methodology=0, provenance=1, countries=1).
    expect(screen.getByTestId('changes-filter-all')).toHaveTextContent('3');
    expect(screen.getByTestId('changes-filter-data')).toHaveTextContent('1');
    expect(screen.getByTestId('changes-filter-provenance')).toHaveTextContent('1');
    expect(screen.getByTestId('changes-filter-countries')).toHaveTextContent('1');
    expect(screen.getByTestId('changes-filter-methodology')).toHaveTextContent('0');

    // Click "Provenance" tab — only the url_broken row should remain.
    await userEvent.click(screen.getByTestId('changes-filter-provenance'));
    const rows = screen.getAllByTestId('changes-timeline-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-severity', 'url_broken');

    // Click "Methodology" — zero rows; tab-empty placeholder.
    await userEvent.click(screen.getByTestId('changes-filter-methodology'));
    expect(screen.queryAllByTestId('changes-timeline-row')).toHaveLength(0);
    expect(screen.getByTestId('changes-tab-empty')).toBeInTheDocument();
  });
});
