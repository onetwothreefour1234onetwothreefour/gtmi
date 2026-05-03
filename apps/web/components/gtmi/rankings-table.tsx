'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { type PillarKey } from '@/lib/theme';
import { formatScore, formatRank } from '@/lib/format';
import { PreCalibrationChip } from './pre-calibration-chip';
import { CoverageChip } from './coverage-chip';
import { PillarMiniBars } from './pillar-mini-bars';
import { CountryFlag } from './country-flag';
import { Sparkline, deterministicTrend } from './sparkline';
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

interface HeaderSpec {
  field: SortField | null;
  label: string;
  align?: 'left' | 'right';
  /** Sortable when true; rank/pillars/trend columns have no sort target. */
  sortable: boolean;
  width?: string;
}

/**
 * Phase 3.10d / E.1 — minimum points before we trust score_history.
 * Below this we render the deterministic pseudo-walk so the column is
 * never misleadingly empty for new programmes.
 */
const MIN_REAL_HISTORY = 4;

const HEADERS: HeaderSpec[] = [
  { field: null, label: '#', sortable: false, width: '36px' },
  { field: 'country', label: 'Country', sortable: true, width: '180px' },
  { field: 'name', label: 'Programme', sortable: true },
  { field: null, label: 'Category', sortable: false, width: '110px' },
  { field: 'composite', label: 'Composite', sortable: true, align: 'right', width: '100px' },
  { field: 'paq', label: 'PAQ', sortable: true, align: 'right', width: '70px' },
  { field: 'cme', label: 'CME', sortable: true, align: 'right', width: '70px' },
  { field: null, label: 'Pillars (A→E)', sortable: false, width: '110px' },
  { field: null, label: 'Trend (12m)', sortable: false, width: '80px' },
  { field: 'coverage', label: 'Coverage', sortable: true, align: 'right', width: '90px' },
  { field: null, label: 'Status', sortable: false, width: '90px' },
];

function deriveRow(row: RankedProgramRow, weights: PillarWeights | null) {
  if (!weights || !row.pillarScores) {
    return {
      composite: row.composite,
      paq: row.paq,
      pillarScores: row.pillarScores,
    };
  }
  const newPaq = recomputePaq(row.pillarScores, weights);
  const newComposite = row.cme === null ? null : 0.3 * row.cme + 0.7 * newPaq;
  return {
    composite: newComposite,
    paq: newPaq,
    pillarScores: row.pillarScores,
  };
}

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
    if (aUnscored !== bUnscored) return aUnscored ? 1 : -1;
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

/**
 * Editorial rankings table — Phase 4-B restyle. Replaces the rounded
 * shadcn-style card with the design's `table.gtmi` atom: hairline rules,
 * uppercase header eyebrow, mono numerals, Fraunces programme names,
 * sparkline column (deterministic placeholder until score history matures),
 * row-1 oxblood wash on the leader.
 */
export function RankingsTable({
  rows,
  scoredCount: _scoredCount,
  sort,
  onSortChange,
  advisorWeights = null,
  className,
}: RankingsTableProps) {
  const reduceMotion = useReducedMotion();
  const orderedRows = React.useMemo(() => {
    if (!advisorWeights) return rows;
    return sortRowsForAdvisor(rows, advisorWeights, sort.field, sort.direction);
  }, [rows, advisorWeights, sort.field, sort.direction]);

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
    <div className={cn('w-full overflow-x-auto', className)} data-testid="rankings-table">
      <table className="gtmi tabular w-full">
        <thead>
          <tr>
            {HEADERS.map((h, i) => (
              <th
                key={`${h.label}-${i}`}
                scope="col"
                style={{ width: h.width, textAlign: h.align ?? 'left' }}
              >
                {h.sortable && h.field ? (
                  <button
                    type="button"
                    onClick={() => h.field && handleSort(h.field)}
                    className={cn(
                      'inline-flex items-center gap-1 hover:text-ink',
                      sort.field === h.field && 'text-ink'
                    )}
                    aria-label={`Sort by ${h.label}`}
                  >
                    {h.label}
                    {sort.field === h.field && <SortGlyph direction={sort.direction} aria-hidden />}
                  </button>
                ) : (
                  <span>{h.label}</span>
                )}
              </th>
            ))}
            <th aria-hidden style={{ width: 30 }} />
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row, idx) => {
            const derived = deriveRow(row, advisorWeights);
            const rank = scoredRanks.get(row.programId);
            const isLeader = rank === 1;
            // Phase 3.10d / E.1 — prefer real score_history when we have
            // ≥ MIN_REAL_HISTORY points. Below that the trend is
            // statistically uninformative so we keep the deterministic
            // pseudo-walk and disclose it in the row's ariaLabel.
            const realHistory = row.scoreHistory ?? [];
            const useReal = realHistory.length >= MIN_REAL_HISTORY && !advisorWeights;
            const trend =
              derived.composite !== null
                ? useReal
                  ? realHistory
                  : deterministicTrend(row.programId, derived.composite)
                : null;
            return (
              <motion.tr
                key={row.programId}
                layout={reduceMotion ? false : true}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                style={{
                  background: isLeader ? 'rgba(184,65,42,0.04)' : undefined,
                }}
                data-testid="rankings-row"
                data-rank={rank ?? 'unscored'}
                data-program-id={row.programId}
              >
                <td>
                  <span className="num text-ink-4" style={{ fontSize: 12 }}>
                    {rank ? String(rank).padStart(2, '0') : formatRank(null)}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/countries/${row.countryIso}`}
                    className="inline-flex items-center gap-2.5 text-ink hover:text-accent"
                  >
                    <CountryFlag iso={row.countryIso} countryName={row.countryName} size="sm" />
                    <span style={{ fontWeight: 500 }}>{row.countryName}</span>
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/programs/${row.programId}`}
                    className="serif hover:text-accent"
                    style={{ fontSize: 14, fontWeight: 500 }}
                  >
                    {row.programName}
                  </Link>
                </td>
                <td>
                  <span
                    className="text-ink-4"
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {row.programCategory}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <CompositeCell
                    value={derived.composite}
                    placeholder={row.phase2Placeholder}
                    isLeader={isLeader}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <SubScore value={derived.paq} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <SubScore value={row.cme} />
                </td>
                <td>
                  <PillarMiniBars scores={derived.pillarScores ?? null} />
                </td>
                <td>
                  {trend ? (
                    <Sparkline
                      values={trend}
                      width={64}
                      height={18}
                      color={isLeader ? 'var(--accent)' : 'var(--ink-3)'}
                      ariaLabel={
                        useReal
                          ? `${trend.length}-point composite history for ${row.programName} from score_history`
                          : `12-month trend for ${row.programName} (placeholder; deterministic until score history matures)`
                      }
                      dataSource={useReal ? 'real' : 'placeholder'}
                    />
                  ) : (
                    <span className="num text-ink-5" style={{ fontSize: 11 }}>
                      —
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {row.composite === null ? (
                    <span className="num text-ink-4" style={{ fontSize: 12 }}>
                      —
                    </span>
                  ) : (
                    <CoverageChip populated={row.fieldsPopulated} total={row.fieldsTotal} />
                  )}
                </td>
                <td>
                  {row.composite === null ? (
                    <span className="chip chip-mute">Awaiting</span>
                  ) : row.phase2Placeholder ? (
                    <span className="chip chip-amber">Pre-cal</span>
                  ) : (
                    <span className="chip chip-mute">Scored</span>
                  )}
                </td>
                <td className="text-ink-4" style={{ fontSize: 12 }} aria-hidden>
                  {idx >= 0 ? '›' : null}
                </td>
              </motion.tr>
            );
          })}
          {orderedRows.length === 0 && (
            <tr>
              <td colSpan={HEADERS.length + 1} style={{ padding: 48, textAlign: 'center' }}>
                <span className="text-ink-4">No programmes match these filters.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CompositeCell({
  value,
  placeholder,
  isLeader,
}: {
  value: number | null;
  placeholder: boolean;
  isLeader: boolean;
}) {
  if (value === null) {
    return (
      <span className="num italic text-ink-4" style={{ fontSize: 12 }}>
        Not yet scored
      </span>
    );
  }
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-2">
        <span className="num" style={{ fontWeight: 600 }}>
          {formatScore(value)}
        </span>
        {placeholder && <PreCalibrationChip />}
      </span>
      <span
        className="block w-20"
        style={{ height: 3, background: 'var(--rule-soft)' }}
        aria-hidden
      >
        <span
          className="block h-full"
          style={{
            width: `${pct}%`,
            background: isLeader ? 'var(--accent)' : 'var(--ink)',
          }}
        />
      </span>
    </span>
  );
}

function SubScore({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="num text-ink-4" style={{ fontSize: 12 }}>
        —
      </span>
    );
  }
  return (
    <span className="num text-ink-3" style={{ fontSize: 12 }}>
      {formatScore(value)}
    </span>
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

export type { PillarKey };
