'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { scoreColor, type PillarKey } from '@/lib/theme';
import { formatScore, formatRank } from '@/lib/format';
import { PreCalibrationChip } from './pre-calibration-chip';
import { CoverageChip } from './coverage-chip';
import { PillarMiniBars } from './pillar-mini-bars';
import { recomputePaq, type PillarWeights } from '@/lib/advisor-mode';
import type { RankedProgramRow, SortField, SortDirection } from '@/lib/queries/types';

export interface RankingsTableProps {
  rows: RankedProgramRow[];
  /** Total scored programs in the cohort, for "Rank: #X of N" math. */
  scoredCount: number;
  /** Active sort, owned by the parent so it can persist via URL state. */
  sort: { field: SortField; direction: SortDirection };
  onSortChange: (next: { field: SortField; direction: SortDirection }) => void;
  /** When non-null, rows are reweighted client-side using these pillar weights. */
  advisorWeights?: PillarWeights | null;
  className?: string;
}

const HEADERS: { field: SortField; label: string; align?: 'right' }[] = [
  { field: 'composite', label: 'Rank' },
  { field: 'name', label: 'Program' },
  { field: 'country', label: 'Country' },
  { field: 'composite', label: 'Composite', align: 'right' },
  { field: 'cme', label: 'CME', align: 'right' },
  { field: 'paq', label: 'PAQ', align: 'right' },
  { field: 'name', label: 'Pillars' },
  { field: 'coverage', label: 'Coverage', align: 'right' },
];

/** Compute display values, applying advisor weights when present. */
function deriveRow(row: RankedProgramRow, weights: PillarWeights | null) {
  if (!weights || !row.pillarScores) {
    return {
      composite: row.composite,
      paq: row.paq,
      pillarScores: row.pillarScores,
    };
  }
  const newPaq = recomputePaq(row.pillarScores, weights);
  // Composite = 30% CME + 70% PAQ. CME is unaffected by user weights.
  const newComposite = row.cme === null ? null : 0.3 * row.cme + 0.7 * newPaq;
  return {
    composite: newComposite,
    paq: newPaq,
    pillarScores: row.pillarScores,
  };
}

/**
 * Re-sort the rows client-side when advisorWeights are active. This keeps
 * advisor-mode interactive without a DB round-trip per slider tick.
 */
function sortRowsForAdvisor(
  rows: RankedProgramRow[],
  weights: PillarWeights,
  sortField: SortField,
  direction: SortDirection
): RankedProgramRow[] {
  const decorated = rows.map((r) => ({ row: r, derived: deriveRow(r, weights) }));
  const sign = direction === 'asc' ? 1 : -1;
  decorated.sort((a, b) => {
    const aUnscored = a.derived.composite === null;
    const bUnscored = b.derived.composite === null;
    if (aUnscored !== bUnscored) return aUnscored ? 1 : -1; // unscored to bottom
    let cmp = 0;
    if (sortField === 'composite' || sortField === 'name') {
      cmp = (b.derived.composite ?? -Infinity) - (a.derived.composite ?? -Infinity);
      if (sign === 1) cmp = -cmp;
    } else if (sortField === 'paq') {
      cmp = (b.derived.paq ?? -Infinity) - (a.derived.paq ?? -Infinity);
      if (sign === 1) cmp = -cmp;
    } else if (sortField === 'cme') {
      cmp = ((b.row.cme ?? -Infinity) - (a.row.cme ?? -Infinity)) * (sign === 1 ? -1 : 1);
    } else if (sortField === 'country') {
      cmp = a.row.countryName.localeCompare(b.row.countryName) * sign;
    } else if (sortField === 'coverage') {
      cmp = (b.row.fieldsPopulated - a.row.fieldsPopulated) * (sign === 1 ? -1 : 1);
    }
    if (cmp === 0) cmp = a.row.programName.localeCompare(b.row.programName);
    return cmp;
  });
  return decorated.map((d) => d.row);
}

export function RankingsTable({
  rows,
  scoredCount: _scoredCount,
  sort,
  onSortChange,
  advisorWeights = null,
  className,
}: RankingsTableProps) {
  const orderedRows = React.useMemo(() => {
    if (!advisorWeights) return rows;
    return sortRowsForAdvisor(rows, advisorWeights, sort.field, sort.direction);
  }, [rows, advisorWeights, sort.field, sort.direction]);

  // For "Rank: #X of N" — only count scored rows in advisor mode if the
  // composite came back non-null.
  const scoredRanks = React.useMemo(() => {
    const m = new Map<string, number>();
    let n = 1;
    for (const r of orderedRows) {
      const derived = deriveRow(r, advisorWeights);
      if (derived.composite !== null) m.set(r.programId, n++);
    }
    return m;
  }, [orderedRows, advisorWeights]);

  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      onSortChange({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ field, direction: field === 'name' || field === 'country' ? 'asc' : 'desc' });
    }
  };

  return (
    <div
      className={cn('overflow-x-auto rounded-table border border-border bg-surface', className)}
      data-testid="rankings-table"
    >
      <table className="w-full border-collapse text-data-md">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-data-sm uppercase tracking-wider text-muted-foreground">
            {HEADERS.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn(
                  'px-3 py-2 font-medium',
                  h.align === 'right' ? 'text-right' : 'text-left'
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSort(h.field)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground',
                    sort.field === h.field && 'text-foreground'
                  )}
                  aria-label={`Sort by ${h.label}`}
                >
                  {h.label}
                  {sort.field === h.field && <SortGlyph direction={sort.direction} aria-hidden />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row) => {
            const derived = deriveRow(row, advisorWeights);
            const rank = scoredRanks.get(row.programId);
            return (
              <motion.tr
                key={row.programId}
                layout
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="border-b border-border last:border-b-0 hover:bg-muted/40"
              >
                <td className="px-3 py-3 font-mono text-data-sm tnum text-muted-foreground">
                  {formatRank(rank ?? null)}
                </td>
                <td className="px-3 py-3">
                  <Link href={`/programs/${row.programId}`} className="block hover:text-accent">
                    <span className="font-medium text-foreground">{row.programName}</span>
                    <span className="ml-2 text-data-sm text-muted-foreground">
                      {row.programCategory}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/countries/${row.countryIso}`}
                    className="text-foreground hover:text-accent"
                  >
                    {row.countryName}
                  </Link>
                  <span className="ml-2 font-mono text-data-sm text-muted-foreground">
                    {row.countryIso}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <CompositeCell value={derived.composite} placeholder={row.phase2Placeholder} />
                </td>
                <td className="px-3 py-3 text-right">
                  <SubScore value={row.cme} fallback="Phase 3" />
                </td>
                <td className="px-3 py-3 text-right">
                  <SubScore value={derived.paq} />
                </td>
                <td className="px-3 py-3">
                  <PillarMiniBars scores={derived.pillarScores ?? null} />
                </td>
                <td className="px-3 py-3 text-right">
                  {row.composite === null ? (
                    <span className="font-mono text-data-sm text-muted-foreground">—</span>
                  ) : (
                    <CoverageChip populated={row.fieldsPopulated} total={row.fieldsTotal} />
                  )}
                </td>
              </motion.tr>
            );
          })}
          {orderedRows.length === 0 && (
            <tr>
              <td colSpan={HEADERS.length} className="px-3 py-12 text-center text-muted-foreground">
                No programs match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CompositeCell({ value, placeholder }: { value: number | null; placeholder: boolean }) {
  if (value === null) {
    return (
      <span className="font-mono text-data-sm italic text-muted-foreground">Not yet scored</span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-2">
        <span className="font-mono text-data-lg font-semibold tnum text-foreground">
          {formatScore(value)}
        </span>
        {placeholder && <PreCalibrationChip />}
      </span>
      <span
        className="block h-1 w-16 rounded-table"
        style={{ backgroundColor: scoreColor(value) }}
        aria-hidden
      />
    </span>
  );
}

function SubScore({ value, fallback }: { value: number | null; fallback?: string }) {
  if (value === null) {
    return (
      <span className="font-mono text-data-sm text-muted-foreground" title={fallback}>
        {fallback ? '—' : '—'}
      </span>
    );
  }
  return (
    <span className="font-mono text-data-sm tnum text-muted-foreground">{formatScore(value)}</span>
  );
}

function SortGlyph({ direction }: { direction: SortDirection }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {direction === 'asc' ? (
        <path d="M12 19V5M5 12l7-7 7 7" />
      ) : (
        <path d="M12 5v14M5 12l7 7 7-7" />
      )}
    </svg>
  );
}

// Re-export PillarKey so tests can reference it without going through theme.ts
export type { PillarKey };
