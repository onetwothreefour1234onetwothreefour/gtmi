import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatScore } from '@/lib/format';
import { DirectionArrow } from './direction-arrow';
import { ProvenanceTrigger } from './provenance-trigger';
import { PreCalibrationChip } from './pre-calibration-chip';
import { ScoreBar } from './score-bar';
import type { ProgramDetailFieldValue } from '@/lib/queries/program-detail-types';

export interface IndicatorRowProps {
  fieldValue: ProgramDetailFieldValue;
  /** Pre-calibration flag from the program's score row. */
  phase2Placeholder?: boolean;
  /** Highlight row treatment (oxblood wash) — used when this row owns the
   *  active provenance drawer or is the page's "anchor" row. */
  highlighted?: boolean;
  className?: string;
}

/**
 * Editorial table row for an indicator. Replaces the Phase 4.3 grid layout
 * with a `<tr>` that drops cleanly into the design's `table.gtmi` atom.
 *
 * Columns (matching docs/design/screen-program.jsx:IndicatorRow):
 *   ID · Indicator · Weight · Raw value · Score (+ bar) · Provenance · Status
 */
export function IndicatorRow({
  fieldValue,
  phase2Placeholder = false,
  highlighted = false,
  className,
}: IndicatorRowProps) {
  const fv = fieldValue;
  const hasValue = fv.valueRaw !== null && fv.valueRaw !== '';
  const direction =
    fv.direction === 'higher_is_better' || fv.direction === 'lower_is_better'
      ? fv.direction
      : 'higher_is_better';
  const valueCurrency = readValueCurrency(fv.provenance);
  const status = fv.status;

  return (
    <tr
      className={cn(className)}
      style={{ background: highlighted ? 'rgba(184,65,42,0.06)' : undefined }}
      data-testid="indicator-row"
      data-field-key={fv.fieldKey}
    >
      <td style={{ width: 80 }}>
        <span className="num text-ink-4" style={{ fontSize: 11 }}>
          {fv.fieldKey}
        </span>
      </td>
      <td>
        <span
          className="serif"
          style={{ fontSize: 14, fontWeight: 500 }}
          data-testid="indicator-label"
        >
          {fv.fieldLabel}
        </span>
      </td>
      <td style={{ width: 90, textAlign: 'right' }}>
        <span className="num inline-flex items-center gap-1 text-ink-3" style={{ fontSize: 12 }}>
          {(fv.weightWithinSubFactor * 100).toFixed(1)}%
          <DirectionArrow direction={direction} />
        </span>
      </td>
      <td style={{ width: 160 }}>
        {hasValue ? (
          <span className="num inline-flex items-baseline gap-1 text-ink" style={{ fontSize: 13 }}>
            <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fv.valueRaw}
            </span>
            {valueCurrency && <span className="text-ink-4">{valueCurrency}</span>}
          </span>
        ) : (
          <span className="num italic text-ink-4" style={{ fontSize: 12 }}>
            Not on government source
          </span>
        )}
      </td>
      <td style={{ width: 130, textAlign: 'right' }}>
        {fv.valueIndicatorScore !== null ? (
          <div className="flex items-center justify-end gap-2">
            <span className="num" style={{ fontWeight: 600 }}>
              {formatScore(fv.valueIndicatorScore)}
            </span>
            <span className="block w-12">
              <ScoreBar
                value={fv.valueIndicatorScore}
                showLabel={false}
                width="sm"
                ariaLabel={`Score ${fv.valueIndicatorScore.toFixed(1)} for ${fv.fieldLabel}`}
              />
            </span>
            {phase2Placeholder && hasValue && <PreCalibrationChip />}
          </div>
        ) : (
          <span className="num text-ink-4" style={{ fontSize: 12 }}>
            —
          </span>
        )}
      </td>
      <td style={{ width: 100 }}>
        <ProvenanceTrigger
          provenance={fv.provenance}
          status={status}
          fieldKey={fv.fieldKey}
          fieldLabel={fv.fieldLabel}
          weightWithinSubFactor={fv.weightWithinSubFactor}
          valueRaw={fv.valueRaw}
          valueIndicatorScore={fv.valueIndicatorScore}
        />
      </td>
      <td style={{ width: 90 }}>
        {!hasValue ? (
          <span className="chip chip-mute">Missing</span>
        ) : status === 'approved' ? (
          <span className="chip chip-mute">Verified</span>
        ) : phase2Placeholder ? (
          <span className="chip chip-amber">Pre-cal</span>
        ) : (
          <span className="chip chip-mute">Scored</span>
        )}
      </td>
    </tr>
  );
}

function readValueCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>).valueCurrency;
  return typeof v === 'string' && v.length > 0 ? v : null;
}
