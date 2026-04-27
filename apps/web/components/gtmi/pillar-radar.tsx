'use client';

import * as React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';

export type PillarScores = Record<PillarKey, number>;

export interface PillarRadarProps {
  program: PillarScores;
  programLabel?: string;
  cohortMedian?: PillarScores | null;
  /** Optional third polygon — "Compare to..." dropdown selection. */
  compareTo?: { label: string; scores: PillarScores } | null;
  /** Phase 4 cohort = 2 programs. Surface the small-cohort caveat in the chart. */
  smallCohortNote?: boolean;
  className?: string;
}

const ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];
const LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

export function PillarRadar({
  program,
  programLabel = 'This program',
  cohortMedian,
  compareTo,
  smallCohortNote = false,
  className,
}: PillarRadarProps) {
  const data = ORDER.map((k) => {
    type Row = { pillar: string } & Record<string, string | number | null>;
    const row: Row = { pillar: LABEL[k], program: program[k] };
    if (cohortMedian) row.cohort = cohortMedian[k];
    if (compareTo) row.compare = compareTo.scores[k];
    return row;
  });

  return (
    <div className={className} data-testid="pillar-radar">
      {/* Screen-reader text-alternative table — visually hidden, exposed to AT */}
      <table className="sr-only" aria-label={`Pillar scores for ${programLabel}`}>
        <thead>
          <tr>
            <th>Pillar</th>
            <th>{programLabel}</th>
            {cohortMedian && <th>Cohort median</th>}
            {compareTo && <th>{compareTo.label}</th>}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((k) => (
            <tr key={k}>
              <th scope="row">{LABEL[k]}</th>
              <td>{program[k].toFixed(2)}</td>
              {cohortMedian && <td>{cohortMedian[k].toFixed(2)}</td>}
              {compareTo && <td>{compareTo.scores[k].toFixed(2)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} outerRadius={120}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="pillar"
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 4,
              color: 'hsl(var(--popover-foreground))',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Radar
            name={programLabel}
            dataKey="program"
            stroke={PILLAR_COLORS.A}
            fill={PILLAR_COLORS.A}
            fillOpacity={0.25}
          />

          {cohortMedian && (
            <Radar
              name={`Cohort median${smallCohortNote ? ' (n=2)' : ''}`}
              dataKey="cohort"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              fill="none"
            />
          )}

          {compareTo && (
            <Radar
              name={compareTo.label}
              dataKey="compare"
              stroke={PILLAR_COLORS.D}
              fill={PILLAR_COLORS.D}
              fillOpacity={0.15}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
