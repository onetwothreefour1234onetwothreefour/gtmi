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
import { ACCENT_OXBLOOD, type PillarKey } from '@/lib/theme';
import { cn } from '@/lib/utils';

export interface CountryRadarProgram {
  programId: string;
  programName: string;
  pillarScores: Record<PillarKey, number>;
}

export interface CountryRadarProps {
  /** Scored programmes for this country. Unscored rows must be filtered upstream. */
  programs: CountryRadarProgram[];
  /** Country name — drives the empty-state copy + title. */
  countryName: string;
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

/**
 * Country-level radar overlay. Renders one polygon per scored programme
 * (oxblood for the cohort leader, navy for the rest) so the user can see
 * how the country's programmes cluster across the five pillars.
 *
 * The legend shows up to 5 programme names; if the country has more,
 * additional programmes still plot but the legend collapses to "+N more".
 */
export function CountryRadar({ programs, countryName, className }: CountryRadarProps) {
  if (programs.length === 0) {
    return (
      <div className={cn('italic text-ink-4', className)} data-testid="country-radar-empty">
        Radar lights up once at least one programme in {countryName} is scored.
      </div>
    );
  }

  // Recharts `data` shape: one row per pillar, columns keyed by programme.
  type Row = { pillar: string } & Record<string, string | number | null>;
  const data: Row[] = ORDER.map((k) => {
    const row: Row = { pillar: LABEL[k] };
    for (const p of programs) row[p.programId] = p.pillarScores[k];
    return row;
  });

  return (
    <div className={className} data-testid="country-radar">
      <table className="sr-only" aria-label={`Pillar scores per programme for ${countryName}`}>
        <thead>
          <tr>
            <th>Pillar</th>
            {programs.map((p) => (
              <th key={p.programId}>{p.programName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((k) => (
            <tr key={k}>
              <th scope="row">{LABEL[k]}</th>
              {programs.map((p) => (
                <td key={p.programId}>{p.pillarScores[k].toFixed(2)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} outerRadius={120}>
          <PolarGrid stroke="var(--rule)" />
          <PolarAngleAxis
            dataKey="pillar"
            tick={{
              fill: 'var(--ink-3)',
              fontSize: 12,
              fontFamily: 'var(--font-serif), Georgia, serif',
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--rule)',
              borderRadius: 0,
              color: 'var(--popover-foreground)',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {programs.map((p, i) => {
            const isLeader = i === 0;
            return (
              <Radar
                key={p.programId}
                name={p.programName}
                dataKey={p.programId}
                stroke={isLeader ? ACCENT_OXBLOOD : 'var(--navy)'}
                fill={isLeader ? ACCENT_OXBLOOD : 'var(--navy)'}
                fillOpacity={isLeader ? 0.18 : 0.08}
                strokeWidth={isLeader ? 2 : 1.2}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
