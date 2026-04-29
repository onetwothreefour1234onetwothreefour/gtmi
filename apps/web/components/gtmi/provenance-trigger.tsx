'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { readProvenance, type FieldValueStatus, type Provenance } from '@/lib/provenance';
import { ProvenanceDrawer } from './provenance-drawer';

export interface ProvenanceTriggerProps {
  /** Raw provenance JSONB from `field_values.provenance`. */
  provenance: unknown;
  /** Row status drives whether reviewer/reviewedAt/reviewerNotes are required. */
  status: FieldValueStatus;
  /** Indicator key (e.g. "A.1.1") — drives the drawer eyebrow + aria-labelledby. */
  fieldKey?: string;
  /** Indicator label — drives the drawer title. */
  fieldLabel?: string;
  /** Indicator weight within its sub-factor (0–1), shown in the drawer header. */
  weightWithinSubFactor?: number;
  /** Raw extracted value, displayed in the drawer header. */
  valueRaw?: string | null;
  /** Indicator score 0–100, shown in the drawer header. */
  valueIndicatorScore?: number | null;
  /** Optional override for the trigger label (e.g. "4 src ⛬" in dense rows). */
  triggerLabel?: React.ReactNode;
  className?: string;
}

/**
 * Right-side drawer trigger replacing the Phase 4.1 Radix Popover.
 *
 * Renders an explicit "Provenance incomplete" error chip when required
 * keys are missing — fail-loud per dispatch §5.
 *
 * Click opens a `<ProvenanceDrawer>` (Radix Dialog modal) with focus trap
 * + ESC-to-close + overlay-click-to-close handled by Radix. The drawer
 * renders the full ADR-007 schema (single source card per Q13).
 */
export function ProvenanceTrigger({
  provenance,
  status,
  fieldKey = '',
  fieldLabel = '',
  weightWithinSubFactor = 0,
  valueRaw,
  valueIndicatorScore,
  triggerLabel,
  className,
}: ProvenanceTriggerProps) {
  const [open, setOpen] = React.useState(false);
  const result = readProvenance(provenance, status);

  if (!result.ok) {
    return (
      <span
        title={`Missing required keys: ${result.missing.join(', ')}`}
        className={cn(
          'inline-flex h-5 items-center border border-destructive/40 bg-destructive/10 px-1.5 font-sans text-[10px] font-medium text-destructive',
          className
        )}
        data-testid="provenance-incomplete"
        role="alert"
      >
        Provenance incomplete
      </span>
    );
  }

  const p = result.provenance as Provenance;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Show provenance for ${fieldKey || 'this value'}`}
        data-testid="provenance-trigger"
        className={cn(
          'btn-link num text-data-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          className
        )}
      >
        {triggerLabel ?? <DefaultTriggerLabel />}
      </button>
      <ProvenanceDrawer
        open={open}
        onOpenChange={setOpen}
        fieldKey={fieldKey}
        fieldLabel={fieldLabel}
        provenance={p}
        status={status}
        weightWithinSubFactor={weightWithinSubFactor}
        valueRaw={valueRaw}
        valueIndicatorScore={valueIndicatorScore}
      />
    </>
  );
}

function DefaultTriggerLabel() {
  return (
    <span className="num inline-flex items-center gap-1" style={{ fontSize: 11 }}>
      1 src ⛬
    </span>
  );
}
