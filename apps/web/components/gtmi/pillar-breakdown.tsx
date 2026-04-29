'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import { IndicatorRow } from './indicator-row';
import { PillarRadar } from './pillar-radar';
import { formatScore } from '@/lib/format';
import type { ProgramDetailFieldValue, PillarScores } from '@/lib/queries/program-detail-types';

export interface PillarBreakdownProps {
  /** All field values for the programme. Pre-sorted by sub-factor + key. */
  fieldValues: ProgramDetailFieldValue[];
  /** Programme pillar scores; null when unscored. */
  pillarScores: PillarScores | null;
  /** Cohort median pillar scores for the radar overlay. */
  cohortMedianPillarScores: PillarScores | null;
  /** Cohort size — drives the small-cohort caveat. */
  cohortScoredCount: number;
  /** Sub-factor codes → score (e.g. "A.1" → 18.4). */
  subFactorScores: Record<string, number> | null;
  /** Pre-calibration flag — pipes through to indicator rows. */
  phase2Placeholder?: boolean;
  className?: string;
}

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

const PILLAR_ORDER: PillarKey[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Programme detail's "Indicators & provenance" section. Implements analyst Q5:
 *
 *   - **Tabs** mode (default): 5-tab strip across A–E, each tab renders a
 *     pillar radar overlay + the indicator table for that pillar only.
 *   - **All sub-factors** mode: collapses the tab strip and shows every
 *     indicator grouped by sub-factor — a faithful port of the Phase 4.3
 *     SubFactorAccordion behaviour, kept for cross-pillar scanning.
 *
 * Toggling between modes is local UI state; URL sync intentionally stays
 * out of scope.
 */
export function PillarBreakdown({
  fieldValues,
  pillarScores,
  cohortMedianPillarScores,
  cohortScoredCount,
  subFactorScores,
  phase2Placeholder = false,
  className,
}: PillarBreakdownProps) {
  const [mode, setMode] = React.useState<'tabs' | 'all'>('tabs');
  const [activePillar, setActivePillar] = React.useState<PillarKey>('A');

  // Pre-bucket field values for fast tab switching.
  const byPillar = React.useMemo(() => {
    const buckets: Record<PillarKey, ProgramDetailFieldValue[]> = {
      A: [],
      B: [],
      C: [],
      D: [],
      E: [],
    };
    for (const fv of fieldValues) buckets[fv.pillar].push(fv);
    return buckets;
  }, [fieldValues]);

  const subFactorGroups = React.useMemo(() => groupBySubFactor(fieldValues), [fieldValues]);

  return (
    <section
      aria-label="Indicators and provenance"
      className={cn('px-12 py-12', className)}
      data-testid="pillar-breakdown"
      data-mode={mode}
    >
      <div className="mx-auto max-w-page">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            className="serif"
            style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}
          >
            Indicators &amp; provenance
          </h2>

          <div className="flex items-center gap-3" data-testid="pillar-breakdown-mode-controls">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>

        <p className="mt-2 max-w-[720px] text-ink-3">
          Every indicator below is traceable to a primary source. Click any provenance trigger to
          inspect the full chain — sentence, character offsets, document hash, scrape timestamp.
        </p>

        {mode === 'tabs' ? (
          <>
            <PillarTabStrip
              pillarScores={pillarScores}
              active={activePillar}
              onChange={setActivePillar}
            />
            <div className="mt-8 grid items-start gap-12 md:grid-cols-[1fr_1.6fr]">
              <div data-testid="pillar-breakdown-radar">
                {pillarScores ? (
                  <PillarRadar
                    program={pillarScores}
                    programLabel="This programme"
                    cohortMedian={cohortMedianPillarScores ?? undefined}
                    smallCohortNote={cohortScoredCount <= 3}
                  />
                ) : (
                  <p className="italic text-ink-4">
                    Radar lights up once this programme is scored.
                  </p>
                )}
                {cohortScoredCount <= 3 && cohortMedianPillarScores && (
                  <p className="mt-3 text-data-sm text-ink-4">
                    Cohort median computed across{' '}
                    <span className="num text-ink">{cohortScoredCount}</span> scored programmes.
                    Phase 5 calibration will tighten the band.
                  </p>
                )}
              </div>
              <div data-testid="pillar-breakdown-table">
                <PillarSectionHeader
                  pillar={activePillar}
                  pillarScore={pillarScores?.[activePillar] ?? null}
                  indicatorCount={byPillar[activePillar].length}
                />
                <PillarIndicatorTable
                  rows={byPillar[activePillar]}
                  phase2Placeholder={phase2Placeholder}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 flex flex-col gap-12">
            {subFactorGroups.map((group) => (
              <SubFactorBlock
                key={group.subFactor}
                group={group}
                subFactorScore={subFactorScores?.[group.subFactor] ?? null}
                phase2Placeholder={phase2Placeholder}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: 'tabs' | 'all';
  onChange: (next: 'tabs' | 'all') => void;
}) {
  return (
    <div className="flex border" style={{ borderColor: 'var(--rule)' }}>
      <button
        type="button"
        onClick={() => onChange('tabs')}
        aria-pressed={mode === 'tabs'}
        className={cn('chip cursor-pointer h-7 border-0', mode === 'tabs' && 'chip-ink')}
        data-testid="pillar-breakdown-mode-tabs"
      >
        By pillar
      </button>
      <button
        type="button"
        onClick={() => onChange('all')}
        aria-pressed={mode === 'all'}
        className={cn('chip cursor-pointer h-7 border-0 border-l', mode === 'all' && 'chip-ink')}
        style={{ borderLeftColor: 'var(--rule)' }}
        data-testid="pillar-breakdown-mode-all"
      >
        Expand all sub-factors
      </button>
    </div>
  );
}

function PillarTabStrip({
  pillarScores,
  active,
  onChange,
}: {
  pillarScores: PillarScores | null;
  active: PillarKey;
  onChange: (next: PillarKey) => void;
}) {
  return (
    <div
      className="mt-6 flex flex-wrap gap-2"
      role="tablist"
      aria-label="Pillar tabs"
      data-testid="pillar-tab-strip"
    >
      {PILLAR_ORDER.map((p) => {
        const isActive = active === p;
        const score = pillarScores?.[p] ?? null;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(p)}
            className={cn('chip cursor-pointer h-7', isActive && 'chip-ink')}
            data-testid={`pillar-tab-${p}`}
          >
            <span style={{ color: isActive ? undefined : PILLAR_COLORS[p] }}>{p}</span>
            <span className="ml-1">— {PILLAR_LABEL[p]}</span>
            {score !== null && (
              <span className="num ml-2" style={{ fontSize: 11 }}>
                {formatScore(score)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PillarSectionHeader({
  pillar,
  pillarScore,
  indicatorCount,
}: {
  pillar: PillarKey;
  pillarScore: number | null;
  indicatorCount: number;
}) {
  return (
    <div
      className="flex items-center gap-3 border-b pb-3"
      style={{ borderColor: 'var(--ink)', borderBottomWidth: 2 }}
    >
      <span
        className="serif"
        style={{ fontSize: 22, fontWeight: 500, color: PILLAR_COLORS[pillar] }}
      >
        {pillar}
      </span>
      <span className="serif" style={{ fontSize: 22, fontWeight: 500 }}>
        {PILLAR_LABEL[pillar]}
      </span>
      <span className="text-ink-4" style={{ fontSize: 12 }}>
        · {indicatorCount} indicators
      </span>
      <span className="flex-1" />
      <span className="num text-data-sm">
        Pillar score: {pillarScore === null ? '—' : formatScore(pillarScore)}
      </span>
    </div>
  );
}

function PillarIndicatorTable({
  rows,
  phase2Placeholder,
}: {
  rows: ProgramDetailFieldValue[];
  phase2Placeholder: boolean;
}) {
  if (rows.length === 0) {
    return <p className="mt-4 italic text-ink-4">No indicators in this pillar yet.</p>;
  }
  return (
    <table className="gtmi tabular mt-4 w-full" data-testid="pillar-indicator-table">
      <thead>
        <tr>
          <th style={{ width: 80 }}>ID</th>
          <th>Indicator</th>
          <th style={{ width: 90, textAlign: 'right' }}>Weight</th>
          <th style={{ width: 160 }}>Raw value</th>
          <th style={{ width: 130, textAlign: 'right' }}>Score</th>
          <th style={{ width: 100 }}>Provenance</th>
          <th style={{ width: 90 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <IndicatorRow
            key={row.fieldDefinitionId}
            fieldValue={row}
            phase2Placeholder={phase2Placeholder}
          />
        ))}
      </tbody>
    </table>
  );
}

interface SubFactorGroup {
  pillar: PillarKey;
  subFactor: string;
  rows: ProgramDetailFieldValue[];
}

function groupBySubFactor(fieldValues: ProgramDetailFieldValue[]): SubFactorGroup[] {
  const groups = new Map<string, SubFactorGroup>();
  for (const fv of fieldValues) {
    const key = fv.subFactor;
    const existing = groups.get(key);
    if (existing) existing.rows.push(fv);
    else groups.set(key, { pillar: fv.pillar, subFactor: fv.subFactor, rows: [fv] });
  }
  return Array.from(groups.values()).sort((a, b) => a.subFactor.localeCompare(b.subFactor));
}

function SubFactorBlock({
  group,
  subFactorScore,
  phase2Placeholder,
}: {
  group: SubFactorGroup;
  subFactorScore: number | null;
  phase2Placeholder: boolean;
}) {
  return (
    <article data-testid={`sub-factor-${group.subFactor}`}>
      <div
        className="flex items-baseline gap-3 border-b pb-2"
        style={{ borderColor: 'var(--ink)', borderBottomWidth: 1 }}
      >
        <span
          className="serif"
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: PILLAR_COLORS[group.pillar],
          }}
        >
          {group.subFactor}
        </span>
        <span className="text-data-sm text-ink-4">{PILLAR_LABEL[group.pillar]}</span>
        <span className="text-data-sm text-ink-4">
          · {group.rows.length} indicator{group.rows.length === 1 ? '' : 's'}
        </span>
        <span className="flex-1" />
        <span className="num text-data-sm">
          Sub-factor score: {subFactorScore === null ? '—' : formatScore(subFactorScore)}
        </span>
      </div>
      <table className="gtmi tabular mt-3 w-full">
        <thead>
          <tr>
            <th style={{ width: 80 }}>ID</th>
            <th>Indicator</th>
            <th style={{ width: 90, textAlign: 'right' }}>Weight</th>
            <th style={{ width: 160 }}>Raw value</th>
            <th style={{ width: 130, textAlign: 'right' }}>Score</th>
            <th style={{ width: 100 }}>Provenance</th>
            <th style={{ width: 90 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <IndicatorRow
              key={row.fieldDefinitionId}
              fieldValue={row}
              phase2Placeholder={phase2Placeholder}
            />
          ))}
        </tbody>
      </table>
    </article>
  );
}
