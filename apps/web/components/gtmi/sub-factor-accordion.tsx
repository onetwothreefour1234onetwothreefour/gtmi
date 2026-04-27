'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import { formatScore } from '@/lib/format';
import { IndicatorRow } from './indicator-row';
import type { ProgramDetailFieldValue } from '@/lib/queries/program-detail-types';

export interface SubFactorAccordionProps {
  /** All field values for the program, in pillar/sub-factor/key order. */
  fieldValues: ProgramDetailFieldValue[];
  /** Sub-factor scores keyed by sub-factor code, e.g. "A.1" → 18.4. */
  subFactorScores: Record<string, number> | null;
  phase2Placeholder?: boolean;
  className?: string;
}

interface SubFactorGroup {
  pillar: PillarKey;
  subFactor: string;
  rows: ProgramDetailFieldValue[];
}

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

function groupBySubFactor(fieldValues: ProgramDetailFieldValue[]): SubFactorGroup[] {
  const groups = new Map<string, SubFactorGroup>();
  for (const fv of fieldValues) {
    const key = fv.subFactor;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(fv);
    } else {
      groups.set(key, { pillar: fv.pillar, subFactor: fv.subFactor, rows: [fv] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.subFactor.localeCompare(b.subFactor));
}

/**
 * 15 sub-factors as expandable disclosures, each containing 1–5 indicators.
 * Click the header to expand/collapse. Per-pillar accent on the left rule
 * cues the user to the pillar grouping at a glance.
 */
export function SubFactorAccordion({
  fieldValues,
  subFactorScores,
  phase2Placeholder = false,
  className,
}: SubFactorAccordionProps) {
  const groups = React.useMemo(() => groupBySubFactor(fieldValues), [fieldValues]);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const toggle = (subFactor: string) => {
    setOpen((prev) => ({ ...prev, [subFactor]: !prev[subFactor] }));
  };

  const expandAll = () => setOpen(Object.fromEntries(groups.map((g) => [g.subFactor, true])));
  const collapseAll = () => setOpen({});

  return (
    <section
      aria-label="Indicator drilldown"
      className={cn('flex flex-col gap-2', className)}
      data-testid="sub-factor-accordion"
    >
      <header className="flex items-center justify-between">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
          Indicator drilldown ({groups.length} sub-factors)
        </p>
        <div className="flex items-center gap-3 text-data-sm">
          <button
            type="button"
            onClick={expandAll}
            className="text-accent underline-offset-4 hover:underline"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-accent underline-offset-4 hover:underline"
          >
            Collapse all
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        {groups.map((group) => {
          const isOpen = open[group.subFactor] === true;
          const subFactorScore = subFactorScores?.[group.subFactor] ?? null;
          return (
            <article
              key={group.subFactor}
              className="overflow-hidden rounded-card border border-border"
              style={{ borderLeftWidth: 3, borderLeftColor: PILLAR_COLORS[group.pillar] }}
              data-testid={`sub-factor-${group.subFactor}`}
            >
              <button
                type="button"
                onClick={() => toggle(group.subFactor)}
                aria-expanded={isOpen}
                aria-controls={`sub-factor-body-${group.subFactor}`}
                className="flex w-full items-center justify-between gap-4 bg-surface px-3 py-2 text-left hover:bg-muted/40"
              >
                <span className="inline-flex items-baseline gap-3">
                  <span className="font-mono text-data-md font-semibold tnum text-foreground">
                    {group.subFactor}
                  </span>
                  <span className="text-data-md text-muted-foreground">
                    {PILLAR_LABEL[group.pillar]}
                  </span>
                  <span className="text-data-sm text-muted-foreground">
                    · {group.rows.length} indicator{group.rows.length === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-data-sm tnum text-muted-foreground">
                    {subFactorScore !== null ? formatScore(subFactorScore) : '—'}
                  </span>
                  <ChevronGlyph open={isOpen} />
                </span>
              </button>
              {isOpen && (
                <div id={`sub-factor-body-${group.subFactor}`} className="bg-paper">
                  {group.rows.map((row) => (
                    <IndicatorRow
                      key={row.fieldDefinitionId}
                      fieldValue={row}
                      phase2Placeholder={phase2Placeholder}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
