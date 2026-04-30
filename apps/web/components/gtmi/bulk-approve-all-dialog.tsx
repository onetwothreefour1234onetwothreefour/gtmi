'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface BulkApproveAllDialogProps {
  /** Total pending_review rows. Mirrors `ReviewQueueStats.inQueue`. */
  pendingCount: number;
  /** Server action invoked from the confirmation form. */
  onConfirm: () => Promise<unknown> | void;
  className?: string;
}

/**
 * Phase 3.8 / ADR-020 — confirmation dialog for "approve EVERY pending
 * row regardless of confidence". Distinct from the high-confidence
 * `<BulkApproveDialog>` (amber styling, explicit "skips confidence
 * gate" wording) so the analyst can't fat-finger the wrong button.
 *
 * The ADR-019 categorical-rubric gate stays ON — that's surfaced in
 * the description so the analyst knows the methodology integrity
 * floor isn't being lifted.
 */
export function BulkApproveAllDialog({
  pendingCount,
  onConfirm,
  className,
}: BulkApproveAllDialogProps) {
  const [open, setOpen] = React.useState(false);
  const disabled = pendingCount === 0;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn('btn', disabled && 'cursor-not-allowed', className)}
          style={
            disabled
              ? { background: 'var(--ink-5)', borderColor: 'var(--ink-5)' }
              : { background: 'var(--warning)', borderColor: 'var(--warning)' }
          }
          data-testid="bulk-approve-all-trigger"
          aria-disabled={disabled}
          title={
            disabled
              ? 'Queue is empty.'
              : `Approve all ${pendingCount} pending row${pendingCount === 1 ? '' : 's'} regardless of confidence`
          }
        >
          Approve ALL pending{!disabled ? ` (${pendingCount})` : ''}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(26,26,26,0.18)' }}
          data-testid="bulk-approve-all-overlay"
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'border bg-paper text-ink shadow-[0_24px_64px_-24px_rgba(26,26,26,0.32)]',
            'focus:outline-none'
          )}
          style={{ borderColor: 'var(--warning)' }}
          data-testid="bulk-approve-all-dialog"
        >
          <header className="border-b px-6 pb-3 pt-5" style={{ borderColor: 'var(--rule)' }}>
            <p className="eyebrow" style={{ color: 'var(--warning)' }}>
              Confirm — skips confidence gate
            </p>
            <Dialog.Title asChild>
              <h2
                className="serif"
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  margin: '4px 0 0',
                  letterSpacing: '-0.01em',
                }}
              >
                Approve {pendingCount} pending row{pendingCount === 1 ? '' : 's'}?
              </h2>
            </Dialog.Title>
          </header>
          <Dialog.Description asChild>
            <div
              className="space-y-2 px-6 py-4 text-data-md text-ink-3"
              style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
            >
              <p>
                This bypasses the extractionConfidence ≥ 0.85 / validationConfidence ≥ 0.85 gate.
                Use only after spot-checking — once a row is approved it contributes to the public
                composite.
              </p>
              <p className="text-data-sm" style={{ fontFamily: 'inherit' }}>
                The categorical rubric gate (ADR-019) stays on: any row whose <code>value_raw</code>{' '}
                is not in the rubric still won&apos;t be approved.
              </p>
            </div>
          </Dialog.Description>
          <form
            action={async () => {
              await onConfirm();
              setOpen(false);
            }}
            className="flex items-center justify-end gap-3 border-t px-6 py-4"
            style={{ borderColor: 'var(--rule)' }}
          >
            <Dialog.Close asChild>
              <button type="button" className="btn btn-ghost" data-testid="bulk-approve-all-cancel">
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="submit"
              className="btn"
              style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}
              data-testid="bulk-approve-all-confirm"
            >
              Approve all {pendingCount}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
