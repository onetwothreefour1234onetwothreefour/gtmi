import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatScore } from '@/lib/format';
import { DirectionArrow } from './direction-arrow';
import { ProvenanceTrigger } from './provenance-trigger';
import { PreCalibrationChip } from './pre-calibration-chip';
import type { ProgramDetailFieldValue } from '@/lib/queries/program-detail-types';

export interface IndicatorRowProps {
  fieldValue: ProgramDetailFieldValue;
  /** Pre-calibration flag from the program's score row. */
  phase2Placeholder?: boolean;
  className?: string;
}

/**
 * One indicator inside the sub-factor accordion. Shows the indicator key,
 * label, raw extracted value (with currency code if provenance carries
 * `valueCurrency`), normalised 0-100 score, weight within its sub-factor,
 * direction-arrow, and the ProvenanceTrigger affordance.
 *
 * Three rendering branches:
 *   1. fieldValue with valueRaw + status='approved'   → full row
 *   2. fieldValue with valueRaw + status='pending_…'  → muted row, queue chip
 *   3. fieldValue without valueRaw (no field_value yet) → "Not on government source"
 */
export function IndicatorRow({
  fieldValue,
  phase2Placeholder = false,
  className,
}: IndicatorRowProps) {
  const fv = fieldValue;
  const hasValue = fv.valueRaw !== null && fv.valueRaw !== '';
  const direction =
    fv.direction === 'higher_is_better' || fv.direction === 'lower_is_better'
      ? fv.direction
      : 'higher_is_better';

  // ProvenanceTrigger needs the row's status. When no field_value row
  // exists at all, status defaults to 'draft' from the query layer; we
  // show the affordance regardless so users can still see "Not on
  // government source" with a Provenance Incomplete chip if needed.
  const valueCurrency = readValueCurrency(fv.provenance);

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 text-data-md',
        className
      )}
      data-testid="indicator-row"
      data-field-key={fv.fieldKey}
    >
      <span className="font-mono text-data-sm text-muted-foreground">{fv.fieldKey}</span>
      <span className="text-foreground">{fv.fieldLabel}</span>

      <span className="font-mono text-data-sm tnum text-foreground">
        {hasValue ? (
          <span className="inline-flex items-baseline gap-1">
            <span className="max-w-[180px] truncate">{fv.valueRaw}</span>
            {valueCurrency && <span className="text-muted-foreground">{valueCurrency}</span>}
          </span>
        ) : (
          <span className="italic text-muted-foreground">Not on government source</span>
        )}
      </span>

      <span className="inline-flex items-center gap-2">
        {fv.valueIndicatorScore !== null ? (
          <span className="font-mono text-data-sm tnum text-foreground">
            {formatScore(fv.valueIndicatorScore)}
          </span>
        ) : (
          <span className="font-mono text-data-sm text-muted-foreground">—</span>
        )}
        {phase2Placeholder && fv.valueIndicatorScore !== null && hasValue && <PreCalibrationChip />}
      </span>

      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-data-sm tnum text-muted-foreground">
          {Math.round(fv.weightWithinSubFactor * 100)}%
        </span>
        <DirectionArrow direction={direction} />
      </span>

      <ProvenanceTrigger provenance={fv.provenance} status={fv.status} valueRaw={fv.valueRaw} />
    </div>
  );
}

/** Read provenance.valueCurrency defensively without importing the full schema. */
function readValueCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>).valueCurrency;
  return typeof v === 'string' && v.length > 0 ? v : null;
}
