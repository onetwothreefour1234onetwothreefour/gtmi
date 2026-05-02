'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Phase 3.10 — keyboard navigation for the /review queue.
 *
 * J / ↓ — focus next row
 * K / ↑ — focus previous row
 * O / Enter — open the focused row's review page
 * ? — toggle the on-screen shortcuts hint
 *
 * The component renders a small "Keys" hint in the lower-right and
 * attaches keydown handlers at the document level. It does NOT fire
 * while the user is typing in an input/textarea/contenteditable, and
 * yields to the browser when modifier keys (cmd/ctrl/alt/meta) are
 * pressed (so OS shortcuts still work).
 *
 * Selectors target the `<ReviewQueueTable>` rows by `data-row-index`
 * + `data-row-id` so the component stays a thin sibling of the
 * server-rendered table.
 */
export function ReviewQueueKeyboard() {
  const router = useRouter();
  const [focusIdx, setFocusIdx] = React.useState<number>(-1);
  const [hintOpen, setHintOpen] = React.useState<boolean>(false);

  const focusRow = React.useCallback((idx: number) => {
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-row-index]'));
    if (rows.length === 0) {
      setFocusIdx(-1);
      return;
    }
    const clamped = Math.max(0, Math.min(rows.length - 1, idx));
    rows.forEach((tr, i) => {
      tr.style.outline = i === clamped ? '2px solid var(--accent)' : '';
      tr.style.outlineOffset = i === clamped ? '-2px' : '';
      if (i === clamped) tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    setFocusIdx(clamped);
  }, []);

  const openFocused = React.useCallback(() => {
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-row-index]'));
    if (focusIdx < 0 || focusIdx >= rows.length) return;
    const row = rows[focusIdx];
    if (!row) return;
    const id = row.getAttribute('data-row-id');
    if (!id) return;
    router.push(`/review/${id}`);
  }, [focusIdx, router]);

  React.useEffect(() => {
    function shouldIgnoreEvent(e: KeyboardEvent): boolean {
      if (e.metaKey || e.ctrlKey || e.altKey) return true;
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (shouldIgnoreEvent(e)) return;
      const k = e.key;
      if (k === 'j' || k === 'ArrowDown') {
        e.preventDefault();
        focusRow(focusIdx < 0 ? 0 : focusIdx + 1);
      } else if (k === 'k' || k === 'ArrowUp') {
        e.preventDefault();
        focusRow(focusIdx < 0 ? 0 : focusIdx - 1);
      } else if (k === 'o' || k === 'Enter') {
        e.preventDefault();
        openFocused();
      } else if (k === '?') {
        e.preventDefault();
        setHintOpen((v) => !v);
      } else if (k === 'Escape') {
        // Clear the highlight outline.
        focusRow(-1);
        setHintOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [focusIdx, focusRow, openFocused]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="review-queue-keyboard"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 30,
        background: 'var(--paper)',
        border: '1px solid var(--rule)',
        padding: '6px 10px',
        fontSize: 11,
        lineHeight: 1.4,
        color: 'var(--ink-3)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        maxWidth: 220,
      }}
    >
      <span className="num">⌨</span>{' '}
      <span>
        <kbd>J</kbd>/<kbd>K</kbd> nav, <kbd>O</kbd> open, <kbd>?</kbd> help
      </span>
      {hintOpen && (
        <ul
          style={{
            marginTop: 6,
            paddingLeft: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 2,
          }}
          data-testid="review-queue-keyboard-hint"
        >
          <li>
            <kbd>J</kbd> / <kbd>↓</kbd> next row
          </li>
          <li>
            <kbd>K</kbd> / <kbd>↑</kbd> previous row
          </li>
          <li>
            <kbd>O</kbd> / <kbd>Enter</kbd> open row
          </li>
          <li>
            <kbd>Esc</kbd> clear focus
          </li>
        </ul>
      )}
    </div>
  );
}
