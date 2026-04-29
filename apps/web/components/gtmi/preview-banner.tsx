import * as React from 'react';
import { cn } from '@/lib/utils';
import { PreCalibrationChip } from './pre-calibration-chip';

export interface PreviewBannerProps {
  /** Optional override for the inline note body (server-rendered Markdown). */
  bodyHtml?: string | null;
  className?: string;
}

/**
 * Amber pre-release banner that sits below the top nav on every public
 * route. Translates docs/design/primitives.jsx:PreviewBanner. The body
 * defaults to canonical copy explaining engineer-chosen normalization
 * ranges; pass `bodyHtml` to override with Markdown from
 * `apps/web/content/preview-banner.md`.
 *
 * Phase 4-A note: the banner is a server component because the body comes
 * from the content loader; the chip inside is a client component, so we
 * compose without leaking client state to the rest of the page.
 */
export function PreviewBanner({ bodyHtml, className }: PreviewBannerProps) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-center justify-between gap-4 border-b px-8 py-2.5 text-data-sm',
        className
      )}
      style={{
        background: '#FBF3DC',
        borderColor: '#E0C896',
        color: 'var(--ink-2)',
      }}
      data-testid="preview-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong style={{ fontWeight: 600 }}>Preview release.</strong>
        {bodyHtml ? (
          <span dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <>
            <span>
              Composite scores are computed with engineer-chosen normalization ranges and are
              flagged
            </span>
            <PreCalibrationChip />
            <span>per programme. Calibrated scores ship in Phase 5 (5-country pilot).</span>
          </>
        )}
      </div>
    </div>
  );
}
