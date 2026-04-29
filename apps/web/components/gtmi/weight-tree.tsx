import * as React from 'react';
import { cn } from '@/lib/utils';
import { PILLAR_COLORS, type PillarKey } from '@/lib/theme';
import type { MethodologyPillar } from '@/lib/queries/methodology-current-types';

export interface WeightTreeProps {
  /** CME / PAQ split — drives the two top-level branches. */
  cmePaqSplit: { cme: number; paq: number };
  /** Live pillar tree from getMethodologyCurrent. */
  pillars: MethodologyPillar[];
  /** Render the indicator level too (off by default — adds 48 leaf rows). */
  showIndicators?: boolean;
  className?: string;
}

const PILLAR_LABEL: Record<PillarKey, string> = {
  A: 'Access',
  B: 'Process',
  C: 'Rights',
  D: 'Pathway',
  E: 'Stability',
};

/**
 * Live methodology weight tree. Translates docs/design/screen-methodology.jsx:
 * WeightTree to a nested HTML tree (Composite root → CME / PAQ → Pillar A–E
 * → Sub-factor → optional Indicator leaves) with hairline gutter rules.
 *
 * Server component — every weight reads from getMethodologyCurrent so a
 * methodology version bump auto-rolls the rendering with no code change.
 *
 * Accessibility: `role="tree"` + per-node `role="treeitem"` + `aria-level`
 * + `aria-label` so the SR announces the hierarchy. Hover on any branch
 * tints the gutter rule via :hover.
 */
export function WeightTree({
  cmePaqSplit,
  pillars,
  showIndicators = false,
  className,
}: WeightTreeProps) {
  const cmePct = cmePaqSplit.cme * 100;
  const paqPct = cmePaqSplit.paq * 100;
  const totalIndicators = pillars.reduce((s, p) => s + p.indicatorCount, 0);

  return (
    <div
      role="tree"
      aria-label="Methodology weight tree"
      className={cn('flex flex-col gap-3', className)}
      data-testid="weight-tree"
    >
      <RootRow label="Composite" weightPct={100} indicators={totalIndicators} />

      <Branch
        ariaLevel={2}
        label="CME — Comparative Mobility Engine"
        weightPct={cmePct}
        accentVar="var(--ink-3)"
        testId="weight-tree-cme"
      />

      <Branch
        ariaLevel={2}
        label="PAQ — Programme Architecture & Quality"
        weightPct={paqPct}
        accentVar="var(--ink-2)"
        testId="weight-tree-paq"
      >
        {pillars.map((p) => {
          // Methodology weights are stored as fraction-of-PAQ. Multiply by
          // PAQ share to get fraction-of-composite for the displayed bar.
          const pillarPct = p.weightWithinPaq * paqPct;
          return (
            <PillarBlock
              key={p.key}
              pillar={p}
              pillarPct={pillarPct}
              showIndicators={showIndicators}
            />
          );
        })}
      </Branch>
    </div>
  );
}

function RootRow({
  label,
  weightPct,
  indicators,
}: {
  label: string;
  weightPct: number;
  indicators: number;
}) {
  return (
    <div
      role="treeitem"
      aria-level={1}
      aria-label={`${label}, 100% of composite, ${indicators} indicators total`}
      className="flex items-center gap-4 border-b pb-3"
      style={{ borderColor: 'var(--ink)', borderBottomWidth: 2 }}
    >
      <span className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>
        {label}
      </span>
      <span className="text-data-sm text-ink-4">· {indicators} indicators</span>
      <span className="flex-1" />
      <WeightBar pct={100} accent="var(--ink)" />
      <span className="num w-16 text-right" style={{ fontWeight: 600 }}>
        {weightPct.toFixed(1)}%
      </span>
    </div>
  );
}

function Branch({
  ariaLevel,
  label,
  weightPct,
  accentVar,
  testId,
  children,
}: {
  ariaLevel: number;
  label: string;
  weightPct: number;
  accentVar: string;
  testId: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      role="treeitem"
      aria-level={ariaLevel}
      aria-label={`${label}, ${weightPct.toFixed(1)}% of composite`}
      className="flex flex-col"
      data-testid={testId}
    >
      <div
        className="flex items-center gap-4 py-2"
        style={{ paddingLeft: 24, position: 'relative' }}
      >
        <span aria-hidden style={{ position: 'absolute', left: 0, color: 'var(--ink-5)' }}>
          └─
        </span>
        <span className="serif" style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em' }}>
          {label}
        </span>
        <span className="flex-1" />
        <WeightBar pct={weightPct} accent={accentVar} />
        <span className="num w-16 text-right" style={{ fontWeight: 600 }}>
          {weightPct.toFixed(1)}%
        </span>
      </div>
      {children}
    </section>
  );
}

function PillarBlock({
  pillar,
  pillarPct,
  showIndicators,
}: {
  pillar: MethodologyPillar;
  pillarPct: number;
  showIndicators: boolean;
}) {
  const color = PILLAR_COLORS[pillar.key];
  const weightWithinPaqPct = pillar.weightWithinPaq * 100;
  return (
    <section
      role="group"
      aria-label={`Pillar ${pillar.key} ${PILLAR_LABEL[pillar.key]}, ${weightWithinPaqPct.toFixed(1)}% of PAQ`}
      data-testid={`weight-tree-pillar-${pillar.key}`}
      className="flex flex-col"
    >
      <div
        role="treeitem"
        aria-level={3}
        aria-label={`${pillar.key} ${PILLAR_LABEL[pillar.key]}, ${pillarPct.toFixed(1)}% of composite, ${pillar.indicatorCount} indicators`}
        className="flex items-center gap-4 py-1.5 hover:bg-paper-2"
        style={{ paddingLeft: 56, position: 'relative' }}
      >
        <span aria-hidden style={{ position: 'absolute', left: 32, color: 'var(--ink-5)' }}>
          └─
        </span>
        <span
          className="serif"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color,
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <span style={{ fontWeight: 600 }}>{pillar.key}</span>
          <span>·</span>
          <span>{PILLAR_LABEL[pillar.key]}</span>
        </span>
        <span className="text-data-sm text-ink-4">
          · {pillar.indicatorCount} indicator{pillar.indicatorCount === 1 ? '' : 's'}
        </span>
        <span className="flex-1" />
        <WeightBar pct={pillarPct} accent={color} />
        <span className="num w-16 text-right text-ink-3">{pillarPct.toFixed(1)}%</span>
      </div>

      {pillar.subFactors.map((sf) => {
        const subFactorPct = sf.weightWithinPillar * pillarPct;
        return (
          <SubFactorBlock
            key={sf.code}
            code={sf.code}
            color={color}
            weightWithinPillarPct={sf.weightWithinPillar * 100}
            subFactorPct={subFactorPct}
            indicatorCount={sf.indicators.length}
            indicators={
              showIndicators
                ? sf.indicators.map((ind) => ({
                    key: ind.key,
                    label: ind.label,
                    pct: ind.weightWithinSubFactor * subFactorPct,
                  }))
                : null
            }
          />
        );
      })}
    </section>
  );
}

function SubFactorBlock({
  code,
  color,
  weightWithinPillarPct,
  subFactorPct,
  indicatorCount,
  indicators,
}: {
  code: string;
  color: string;
  weightWithinPillarPct: number;
  subFactorPct: number;
  indicatorCount: number;
  indicators: { key: string; label: string; pct: number }[] | null;
}) {
  return (
    <>
      <div
        role="treeitem"
        aria-level={4}
        aria-label={`Sub-factor ${code}, ${weightWithinPillarPct.toFixed(1)}% of pillar, ${indicatorCount} indicators`}
        className="flex items-center gap-3 py-1 hover:bg-paper-2"
        style={{ paddingLeft: 88, position: 'relative' }}
        data-testid={`weight-tree-subfactor-${code}`}
      >
        <span aria-hidden style={{ position: 'absolute', left: 64, color: 'var(--ink-5)' }}>
          └─
        </span>
        <span className="num text-data-sm" style={{ color }}>
          {code}
        </span>
        <span className="text-data-sm text-ink-4">
          · {indicatorCount} indicator{indicatorCount === 1 ? '' : 's'}
        </span>
        <span className="flex-1" />
        <WeightBar pct={subFactorPct} accent={color} subtle />
        <span className="num w-16 text-right text-ink-4" style={{ fontSize: 12 }}>
          {subFactorPct.toFixed(1)}%
        </span>
      </div>

      {indicators?.map((ind) => (
        <div
          key={ind.key}
          role="treeitem"
          aria-level={5}
          aria-label={`Indicator ${ind.key}, ${ind.pct.toFixed(2)}% of composite`}
          className="flex items-center gap-3 py-0.5 hover:bg-paper-2"
          style={{ paddingLeft: 120, position: 'relative' }}
          data-testid={`weight-tree-indicator-${ind.key}`}
        >
          <span aria-hidden style={{ position: 'absolute', left: 96, color: 'var(--ink-5)' }}>
            └─
          </span>
          <span className="num text-ink-4" style={{ fontSize: 11 }}>
            {ind.key}
          </span>
          <span className="text-data-sm text-ink-3">{ind.label}</span>
          <span className="flex-1" />
          <span className="num w-16 text-right text-ink-5" style={{ fontSize: 11 }}>
            {ind.pct.toFixed(2)}%
          </span>
        </div>
      ))}
    </>
  );
}

function WeightBar({
  pct,
  accent,
  subtle = false,
}: {
  pct: number;
  accent: string;
  subtle?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span
      aria-hidden
      className={cn('inline-block', subtle ? 'w-32' : 'w-48')}
      style={{ height: subtle ? 3 : 6, background: 'var(--rule-soft)' }}
    >
      <span className="block h-full" style={{ width: `${clamped}%`, background: accent }} />
    </span>
  );
}
