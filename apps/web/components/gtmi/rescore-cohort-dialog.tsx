'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface RescoreCohortDialogProps {
  /** Server action invoked from the confirmation form. The return shape
   *  is `{ programsRescored; rowsRescored; rowsSkipped }`; we don't use
   *  it here — the page revalidation surfaces the new scores. */
  onConfirm: () => Promise<unknown> | void;
  className?: string;
}

/**
 * Phase 3.8 / ADR-020 — confirmation dialog for "re-score every
 * approved + pending row across the cohort". Reads the current
 * PHASE2_PLACEHOLDER_PARAMS and rewrites
 * field_values.value_indicator_score for every row whose
 * value_normalized is set. Programme-level composites are NOT
 * recomputed in this commit; that lives in the run-paq-score script.
 *
 * The action takes ~30-60s in steady state at 30-country scale, so
 * the dialog warns the analyst and the button is non-disabled (an
 * empty cohort would still complete in milliseconds — no harm).
 */
export function RescoreCohortDialog({ onConfirm, className }: RescoreCohortDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn('btn', className)}
          data-testid="rescore-cohort-trigger"
          title="Recompute value_indicator_score for every approved + pending row across the cohort"
        >
          Re-score cohort
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(26,26,26,0.18)' }}
          data-testid="rescore-cohort-overlay"
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'border bg-paper text-ink shadow-[0_24px_64px_-24px_rgba(26,26,26,0.32)]',
            'focus:outline-none'
          )}
          style={{ borderColor: 'var(--ink)' }}
          data-testid="rescore-cohort-dialog"
        >
          <header className="border-b px-6 pb-3 pt-5" style={{ borderColor: 'var(--rule)' }}>
            <p className="eyebrow">Re-score cohort</p>
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
                Recompute every row score?
              </h2>
            </Dialog.Title>
          </header>
          <Dialog.Description asChild>
            <div
              className="space-y-2 px-6 py-4 text-data-md text-ink-3"
              style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
            >
              <p>
                Reads <span className="num">field_values.value_normalized</span> for every approved
                or pending row in the cohort and rewrites{' '}
                <span className="num">value_indicator_score</span> using the current{' '}
                <span className="num">PHASE2_PLACEHOLDER_PARAMS</span>. Use after a calibration
                commit changes the scoring parameters.
              </p>
              <p className="text-data-sm" style={{ fontFamily: 'inherit' }}>
                Takes 30-60 seconds. The composite (programme-level) scores in the{' '}
                <span className="num">scores</span> table are NOT touched; re-run{' '}
                <span className="num">run-paq-score.ts</span> per-country to refresh those.
              </p>
            </div>
          </Dialog.Description>
          <form
            action={async () => {
              setPending(true);
              try {
                await onConfirm();
              } finally {
                setPending(false);
                setOpen(false);
              }
            }}
            className="flex items-center justify-end gap-3 border-t px-6 py-4"
            style={{ borderColor: 'var(--rule)' }}
          >
            <Dialog.Close asChild>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pending}
                data-testid="rescore-cohort-cancel"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="submit"
              className="btn"
              disabled={pending}
              data-testid="rescore-cohort-confirm"
            >
              {pending ? 'Re-scoring…' : 'Re-score cohort'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
