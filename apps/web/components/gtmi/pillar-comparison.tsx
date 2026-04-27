'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PillarRadar } from './pillar-radar';
import { PillarBreakdownTable } from './pillar-breakdown-table';
import type { PillarScores } from '@/lib/queries/program-detail-types';
import type { PillarKey } from '@/lib/theme';

export interface PillarComparisonProps {
  programLabel: string;
  programPillarScores: PillarScores;
  cohortMedian: PillarScores | null;
  /** Cohort size, for the small-cohort caveat label on the radar. */
  cohortScoredCount: number;
  /** Other scored programs available in the "Compare to..." dropdown. */
  compareCandidates: { programId: string; programName: string; pillarScores: PillarScores }[];
  indicatorCounts?: Record<PillarKey, number>;
  className?: string;
}

/**
 * Side-by-side pillar radar (left) + breakdown table (right) with a
 * "Compare to..." dropdown that overlays a third polygon on the radar.
 * Phase 4.3 reality: the cohort is 2 programs (AUS + SGP), so the
 * dropdown will surface at most one option.
 */
export function PillarComparison({
  programLabel,
  programPillarScores,
  cohortMedian,
  cohortScoredCount,
  compareCandidates,
  indicatorCounts,
  className,
}: PillarComparisonProps) {
  const [compareId, setCompareId] = React.useState<string | ''>('');
  const compareTo =
    compareId === '' ? null : compareCandidates.find((c) => c.programId === compareId);

  return (
    <section
      aria-label="Pillar breakdown"
      className={cn('grid grid-cols-1 gap-6 md:grid-cols-2', className)}
      data-testid="pillar-comparison"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
            Pillar profile
          </p>
          {compareCandidates.length > 0 ? (
            <label className="inline-flex items-center gap-2 text-data-sm">
              <span className="text-muted-foreground">Compare to</span>
              <select
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                className="rounded-button border border-border bg-paper px-2 py-1 text-data-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">— none —</option>
                {compareCandidates.map((c) => (
                  <option key={c.programId} value={c.programId}>
                    {c.programName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <PillarRadar
          program={programPillarScores}
          programLabel={programLabel}
          cohortMedian={cohortMedian ?? undefined}
          smallCohortNote={cohortScoredCount <= 3}
          compareTo={
            compareTo ? { label: compareTo.programName, scores: compareTo.pillarScores } : null
          }
        />
        {cohortScoredCount <= 3 && cohortMedian && (
          <p className="text-data-sm text-muted-foreground">
            Cohort median computed across{' '}
            <span className="font-mono tnum">{cohortScoredCount}</span> scored programmes (Phase 2
            preview). Will tighten as Phase 3 calibration scores the full pilot.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          Pillar scores and contributions
        </p>
        <PillarBreakdownTable
          pillarScores={programPillarScores}
          indicatorCounts={indicatorCounts}
        />
      </div>
    </section>
  );
}
