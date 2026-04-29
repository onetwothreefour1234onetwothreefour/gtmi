import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatScore } from '@/lib/format';
import { ScoreBar } from './score-bar';
import { PreCalibrationChip } from './pre-calibration-chip';
import { CoverageChip } from './coverage-chip';
import { PillarMiniBars } from './pillar-mini-bars';
import type { CountryProgramRow } from '@/lib/queries/country-detail-types';

export interface CountryProgramsTableProps {
  programs: CountryProgramRow[];
  className?: string;
}

/**
 * Country-scoped programmes table. Reuses Phase A primitives (ScoreBar,
 * PillarMiniBars, CoverageChip, PreCalibrationChip) inside the editorial
 * `table.gtmi` atom from globals.css.
 */
export function CountryProgramsTable({ programs, className }: CountryProgramsTableProps) {
  if (programs.length === 0) {
    return (
      <p className={cn('italic text-ink-4', className)}>
        No programmes seeded for this country yet.
      </p>
    );
  }
  return (
    <div className={cn('w-full overflow-x-auto', className)} data-testid="country-programs-table">
      <table className="gtmi tabular w-full">
        <thead>
          <tr>
            <th style={{ width: 60 }}>#</th>
            <th>Programme</th>
            <th style={{ width: 140 }}>Category</th>
            <th style={{ width: 120, textAlign: 'right' }}>Composite</th>
            <th style={{ width: 80, textAlign: 'right' }}>PAQ</th>
            <th style={{ width: 110 }}>Pillars (A→E)</th>
            <th style={{ width: 90, textAlign: 'right' }}>Coverage</th>
            <th style={{ width: 90 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((row, idx) => {
            const rank = row.composite !== null ? idx + 1 : null;
            return (
              <tr
                key={row.programId}
                data-testid="country-program-row"
                data-program-id={row.programId}
              >
                <td>
                  <span className="num text-ink-4" style={{ fontSize: 12 }}>
                    {rank !== null ? `#${String(rank).padStart(2, '0')}` : '—'}
                  </span>
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
                  {row.composite === null ? (
                    <span className="num italic text-ink-4" style={{ fontSize: 12 }}>
                      Not yet scored
                    </span>
                  ) : (
                    <span className="inline-flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="num" style={{ fontWeight: 600 }}>
                          {formatScore(row.composite)}
                        </span>
                        {row.phase2Placeholder && <PreCalibrationChip />}
                      </span>
                      <span className="block w-20">
                        <ScoreBar
                          value={row.composite}
                          showLabel={false}
                          width="sm"
                          ariaLabel={`Composite score ${formatScore(row.composite)} for ${row.programName}`}
                        />
                      </span>
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {row.paq === null ? (
                    <span className="num text-ink-4" style={{ fontSize: 12 }}>
                      —
                    </span>
                  ) : (
                    <span className="num text-ink-3" style={{ fontSize: 12 }}>
                      {formatScore(row.paq)}
                    </span>
                  )}
                </td>
                <td>
                  <PillarMiniBars scores={row.pillarScores} />
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
