'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface BulkApproveDialogProps {
  /** Number of rows that match the bulk-approve gate (≥0.85 confidence both). */
  candidateCount: number;
  /** Server action invoked from the confirmation form. The return value is
   *  ignored — server actions may return anything (e.g. a count of rows
   *  approved); we just need a Promise to await before closing the dialog. */
  onConfirm: () => Promise<unknown> | void;
  className?: string;
}

/**
 * Bulk-approve confirmation dialog (I-01). Radix Dialog (modal); the inner
 * form posts directly to the server action so the round-trip happens in a
 * single navigation.
 *
 * The trigger button is disabled when zero candidates exist — keeps the
 * analyst from opening a dialog with nothing to do.
 */
export function BulkApproveDialog({
  candidateCount,
  onConfirm,
  className,
}: BulkApproveDialogProps) {
  const [open, setOpen] = React.useState(false);
  const disabled = candidateCount === 0;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn('btn', disabled && 'cursor-not-allowed', className)}
          style={disabled ? { background: 'var(--ink-5)', borderColor: 'var(--ink-5)' } : undefined}
          data-testid="bulk-approve-trigger"
          aria-disabled={disabled}
          title={
            disabled
              ? 'No rows currently match the bulk-approve gate.'
              : `Approve ${candidateCount} pending row${candidateCount === 1 ? '' : 's'}`
          }
        >
          Bulk approve high-confidence{!disabled ? ` (${candidateCount})` : ''}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(26,26,26,0.18)' }}
          data-testid="bulk-approve-overlay"
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'border bg-paper text-ink shadow-[0_24px_64px_-24px_rgba(26,26,26,0.32)]',
            'focus:outline-none'
          )}
          style={{ borderColor: 'var(--ink)' }}
          data-testid="bulk-approve-dialog"
        >
          <header className="border-b px-6 pb-3 pt-5" style={{ borderColor: 'var(--rule)' }}>
            <p className="eyebrow">Confirm bulk approve</p>
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
                Approve {candidateCount} pending row{candidateCount === 1 ? '' : 's'}?
              </h2>
            </Dialog.Title>
          </header>
          <Dialog.Description asChild>
            <p
              className="px-6 py-4 text-data-md text-ink-3"
              style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
            >
              Every row meets the gate: extraction confidence ≥ 0.85, validation confidence ≥ 0.85,
              validator did not flag the source sentence as a mismatch. Composite scores re-compute
              on the next scoring run.
            </p>
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
              <button type="button" className="btn btn-ghost" data-testid="bulk-approve-cancel">
                Cancel
              </button>
            </Dialog.Close>
            <button type="submit" className="btn" data-testid="bulk-approve-confirm">
              Approve {candidateCount}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
