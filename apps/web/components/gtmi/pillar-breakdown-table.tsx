import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import { formatScore } from '@/lib/format';
import { pillarContribution } from '@/lib/queries/program-detail-helpers';
import type { PillarScores } from '@/lib/queries/program-detail-types';

export interface PillarBreakdownTableProps {
  pillarScores: PillarScores;
  /** Pillar weights within PAQ (sum to 1.0). Defaults to METHODOLOGY §1.1. */
  pillarWeights?: Record<PillarKey, number>;
  /** Number of indicators per pillar — fed in from field_definitions counts. */
  indicatorCounts?: Record<PillarKey, number>;
  className?: string;
}

const DEFAULT_PILLAR_WEIGHTS: Record<PillarKey, number> = {
  A: 0.28,
  B: 0.15,
  C: 0.2,
  D: 0.22,
  E: 0.15,
};

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Pillar breakdown table sitting beside the PillarRadar on the program
 * detail page. Each row: pillar accent dot, name, score, weight,
 * contribution (score × weight), and the indicator count. The total
 * row at the bottom sums contributions to PAQ — a sanity check that
 * the user can match against the headline number.
 */
export function PillarBreakdownTable({
  pillarScores,
  pillarWeights = DEFAULT_PILLAR_WEIGHTS,
  indicatorCounts,
  className,
}: PillarBreakdownTableProps) {
  let total = 0;

  return (
    <table
      className={cn('w-full border-collapse text-data-md', className)}
      data-testid="pillar-breakdown-table"
    >
      <thead>
        <tr className="border-b border-border text-data-sm uppercase tracking-wider text-muted-foreground">
          <th scope="col" className="px-2 py-2 text-left font-medium">
            Pillar
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            Score
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            Weight
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            Contribution
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            Indicators
          </th>
        </tr>
      </thead>
      <tbody>
        {PILLAR_ORDER.map((p) => {
          const score = pillarScores[p];
          const weight = pillarWeights[p];
          const contribution = pillarContribution(score, weight);
          total += contribution;
          return (
            <tr
              key={p}
              className="border-b border-border last:border-b-0"
              data-testid={`pillar-row-${p}`}
            >
              <td className="px-2 py-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-table"
                    style={{ backgroundColor: PILLAR_COLORS[p] }}
                    aria-hidden
                  />
                  <span className="font-mono text-data-md font-medium tnum text-foreground">
                    {p}
                  </span>
                  <span className="text-foreground">{PILLAR_LABEL[p]}</span>
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono tnum text-foreground">
                {formatScore(score)}
              </td>
              <td className="px-2 py-2 text-right font-mono text-muted-foreground tnum">
                {Math.round(weight * 100)}%
              </td>
              <td className="px-2 py-2 text-right font-mono tnum text-foreground">
                {formatScore(contribution)}
              </td>
              <td className="px-2 py-2 text-right font-mono text-muted-foreground tnum">
                {indicatorCounts?.[p] ?? '—'}
              </td>
            </tr>
          );
        })}
        <tr className="bg-muted/40 text-data-sm uppercase tracking-wider text-muted-foreground">
          <td className="px-2 py-2 font-medium">PAQ total</td>
          <td className="px-2 py-2" />
          <td className="px-2 py-2" />
          <td className="px-2 py-2 text-right font-mono text-foreground tnum">
            {formatScore(total)}
          </td>
          <td className="px-2 py-2" />
        </tr>
      </tbody>
    </table>
  );
}
