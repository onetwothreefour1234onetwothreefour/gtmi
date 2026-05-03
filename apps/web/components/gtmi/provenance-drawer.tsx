'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { ProvenanceHighlight } from './provenance-highlight';
import type { Provenance, FieldValueStatus } from '@/lib/provenance';
import { getArchiveSignedUrl } from '@/lib/archive-actions';

export interface ProvenanceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Indicator key (e.g. "A.1.1") for the eyebrow caption. */
  fieldKey: string;
  /** Indicator label (e.g. "Minimum salary threshold"). */
  fieldLabel: string;
  /** Validated provenance object. Caller has already checked `readProvenance().ok`. */
  provenance: Provenance;
  /** Row status — drives whether reviewer / reviewedAt / reviewerNotes render. */
  status: FieldValueStatus;
  /** Indicator weight within its sub-factor (0–1). */
  weightWithinSubFactor: number;
  /** Raw extracted value string. */
  valueRaw?: string | null;
  /** Indicator score (0–100). Null when no value extracted. */
  valueIndicatorScore?: number | null;
}

const TIER_LABEL: Record<number, string> = {
  1: 'Tier 1 — government source',
  2: 'Tier 2 — law firm / advisory',
  3: 'Tier 3 — news / monitoring',
};

const GEO_LABEL = {
  global: 'Global',
  continental: 'Continental',
  national: 'National',
  regional: 'Regional',
} as const;

const CROSS_CHECK_LABEL = {
  agrees: 'Agrees',
  disagrees: 'Disagrees',
  not_checked: 'Not checked',
} as const;

function relative(scrapedAt: string): string {
  const then = new Date(scrapedAt).getTime();
  if (Number.isNaN(then)) return scrapedAt;
  const diff = Date.now() - then;
  const days = Math.round(diff / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

function isDerivedModel(model: string): boolean {
  return model === 'derived-knowledge' || model === 'derived-computation';
}

function formatScrapedAtIso(scrapedAt: string): string {
  const d = new Date(scrapedAt);
  if (Number.isNaN(d.getTime())) return scrapedAt;
  return d.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

/**
 * Right-side provenance drawer. Replaces the Phase 4.1 Radix Popover with a
 * Radix Dialog (modal) that slides in from the right edge. Per analyst Q13,
 * a single source card is rendered — no corroborating-source slot until the
 * data lights up.
 *
 * Accessibility:
 *  - Radix Dialog ships focus trap + ESC + scroll-lock + overlay click out
 *    of the box; modal=true so keyboard navigation cannot escape behind.
 *  - `role="dialog"` + `aria-labelledby` + `aria-describedby` are wired
 *    through Dialog.Title and Dialog.Description.
 */
export function ProvenanceDrawer({
  open,
  onOpenChange,
  fieldKey,
  fieldLabel,
  provenance: p,
  status,
  weightWithinSubFactor,
  valueRaw,
  valueIndicatorScore,
}: ProvenanceDrawerProps) {
  const confExtraction = Math.round(p.extractionConfidence * 100);
  const confValidation = Math.round(p.validationConfidence * 100);
  const derivedInputs = (p as unknown as { derivedInputs?: Record<string, DerivedInputValue> })
    .derivedInputs;
  const derived = isDerivedModel(p.extractionModel);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 transition-opacity',
            'data-[state=open]:opacity-100 data-[state=closed]:opacity-0'
          )}
          style={{ background: 'rgba(26,26,26,0.18)' }}
          data-testid="provenance-drawer-overlay"
        />
        <Dialog.Content
          aria-describedby={`provenance-drawer-desc-${fieldKey}`}
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-[540px] max-w-full flex-col',
            'border-l-2 bg-paper text-ink shadow-[-24px_0_64px_-24px_rgba(26,26,26,0.18)]',
            'data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full',
            'transition-transform duration-200 ease-out',
            'focus:outline-none'
          )}
          style={{ borderColor: 'var(--ink)' }}
          data-testid="provenance-drawer"
        >
          {/* Drawer header */}
          <header className="border-b px-7 pb-4 pt-5" style={{ borderColor: 'var(--rule)' }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Indicator · Provenance</p>
              <Dialog.Close
                aria-label="Close provenance drawer"
                className="border-0 bg-transparent text-2xl leading-none text-ink-3 hover:text-ink"
                data-testid="provenance-drawer-close"
              >
                ×
              </Dialog.Close>
            </div>
            <p className="num text-data-sm text-ink-4">{fieldKey}</p>
            <Dialog.Title asChild>
              <h3
                className="serif"
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  margin: '4px 0 12px',
                  letterSpacing: '-0.01em',
                }}
              >
                {fieldLabel}
              </h3>
            </Dialog.Title>

            <div
              className="grid items-baseline gap-x-4 gap-y-1 text-data-sm"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
              id={`provenance-drawer-desc-${fieldKey}`}
            >
              <DrawerHeaderCell
                label="Raw"
                value={
                  valueRaw && valueRaw.trim().length > 0 ? (
                    <span>
                      {valueRaw}
                      {p.valueCurrency && (
                        <span className="ml-1 text-ink-4">{p.valueCurrency}</span>
                      )}
                    </span>
                  ) : (
                    <span className="italic text-ink-4">none</span>
                  )
                }
              />
              <DrawerHeaderCell
                label="Score"
                value={
                  valueIndicatorScore !== null && valueIndicatorScore !== undefined ? (
                    <span>{valueIndicatorScore.toFixed(0)} / 100</span>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )
                }
              />
              <DrawerHeaderCell
                label="Weight"
                value={<span>{(weightWithinSubFactor * 100).toFixed(1)}%</span>}
              />
              <DrawerHeaderCell label="Sources" value={<span>1 chained</span>} />
            </div>
          </header>

          {/* Drawer body — scrollable */}
          <div
            className="flex-1 overflow-y-auto px-7 pb-8 pt-5"
            data-testid="provenance-drawer-body"
          >
            <p className="eyebrow mb-3">Source · Primary</p>

            <article
              className="border bg-paper-2 p-4"
              style={{ borderColor: 'var(--rule)' }}
              data-testid="provenance-drawer-source-card"
            >
              <div
                className="num mb-2 flex justify-between text-data-sm text-ink-4"
                style={{ fontSize: 11 }}
              >
                <span>
                  {GEO_LABEL[p.geographicLevel]}
                  {p.sourceTier !== null && ` · ${TIER_LABEL[p.sourceTier]}`}
                </span>
                <span>
                  <time dateTime={p.scrapedAt} title={p.scrapedAt}>
                    {formatScrapedAtIso(p.scrapedAt)}
                  </time>
                </span>
              </div>
              <ProvenanceHighlight sentence={p.sourceSentence} charOffsets={p.charOffsets} />
              <dl
                className="num mt-3 grid border-t pt-3 text-ink-4"
                style={{
                  gridTemplateColumns: '1fr 1fr',
                  borderColor: 'var(--rule)',
                  fontSize: 11,
                  rowGap: 8,
                  columnGap: 16,
                }}
              >
                <div>
                  <dt className="text-ink-5">chars</dt>
                  <dd>
                    {p.charOffsets[0]} → {p.charOffsets[1]}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-5">scraped</dt>
                  <dd>
                    <time dateTime={p.scrapedAt}>{relative(p.scrapedAt)}</time>
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-5">sha256</dt>
                  <dd title={p.contentHash}>{p.contentHash.slice(0, 12)}…</dd>
                </div>
                <div>
                  <dt className="text-ink-5">methodology</dt>
                  <dd>{p.methodologyVersion}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between text-data-sm">
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  View at source ↗
                </a>
                <ArchiveSnapshotLink archivePath={p.archivePath ?? null} />
              </div>
            </article>

            {/* Phase 3.9 / W2 — translation banner */}
            {p.translatedFrom && (
              <aside
                className="mt-4 border bg-paper-2 px-3 py-2 text-data-sm"
                style={{ borderColor: 'var(--rule)' }}
                data-testid="provenance-drawer-translation-banner"
                role="note"
              >
                <p className="font-medium text-ink-3">
                  Translated from {p.translatedFrom.toUpperCase()}
                </p>
                <p className="mt-1 text-ink-4">
                  The source page was rendered in {p.translatedFrom.toUpperCase()} and
                  auto-translated to English before extraction. Verify the source sentence against
                  the original-language page when reviewing.
                </p>
              </aside>
            )}

            {/* Tier 2 advisory note */}
            {p.sourceTier === 2 && (
              <aside
                className="mt-4 border bg-paper-2 px-3 py-2 text-data-sm"
                style={{ borderColor: 'var(--rule)' }}
                data-testid="tier2-source-badge"
                role="note"
              >
                <p className="font-medium text-ink-3">Tier 2 source</p>
                <p className="mt-1 text-ink-4">
                  This value was sourced from a law firm or advisory publication, not a government
                  source directly.
                </p>
              </aside>
            )}

            {/* Country-substitute note */}
            {p.extractionModel === 'country-substitute-regional' && (
              <aside
                className="mt-4 border bg-navy/[0.06] px-3 py-2 text-data-sm"
                style={{ borderColor: 'var(--navy-soft)', color: 'var(--navy)' }}
                data-testid="country-substitute-badge"
                role="note"
              >
                <p className="font-medium">Country-substitute</p>
                <p className="mt-1 text-ink-4">
                  This value was inferred from regional norms, not extracted from a government
                  source directly.
                </p>
              </aside>
            )}

            {/* Derived note */}
            {derived && (
              <aside
                className="mt-4 border bg-precalib-bg px-3 py-2 text-data-sm"
                style={{ borderColor: 'var(--precalib-fg)', color: 'var(--precalib-fg)' }}
                data-testid="derived-knowledge-badge"
                role="note"
              >
                <p className="font-medium">Derived ({p.extractionModel})</p>
                <p className="mt-1 text-ink-4">
                  Computed deterministically from already-extracted inputs plus static lookup
                  tables. No LLM was invoked.
                </p>
              </aside>
            )}

            {/* Phase 3.10d / D.1 — quality-signal banners. Read defensively
                from provenance JSONB so pre-3.10 rows don't break. */}
            <QualitySignalBanners provenance={p as unknown as Record<string, unknown>} />

            {/* Derived inputs detail */}
            {derivedInputs && (
              <section
                className="mt-4 border bg-paper-2 p-3 text-data-sm"
                style={{ borderColor: 'var(--rule)' }}
                data-testid="derived-inputs"
                role="note"
              >
                <p className="eyebrow mb-2">Computed from</p>
                <dl className="space-y-2">
                  {Object.entries(derivedInputs).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid gap-x-2"
                      style={{ gridTemplateColumns: 'auto 1fr' }}
                    >
                      <dt className="num text-ink-4" style={{ fontSize: 11 }}>
                        {key}
                      </dt>
                      <dd>
                        <DerivedInputDisplay value={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Provenance metadata grid */}
            <section className="mt-6">
              <p className="eyebrow mb-3">Provenance metadata</p>
              <dl
                className="grid items-baseline text-data-sm"
                style={{
                  gridTemplateColumns: 'auto 1fr',
                  rowGap: 10,
                  columnGap: 16,
                }}
              >
                <dt className="text-ink-4">Extraction</dt>
                <dd>
                  <span
                    className="num text-ink-2"
                    style={{ fontSize: 11 }}
                    data-testid="provenance-drawer-extractionModel"
                  >
                    {p.extractionModel}
                  </span>
                  <ConfidenceBar value={confExtraction} />
                </dd>

                <dt className="text-ink-4">Validation</dt>
                <dd>
                  <span
                    className="num text-ink-2"
                    style={{ fontSize: 11 }}
                    data-testid="provenance-drawer-validationModel"
                  >
                    {p.validationModel}
                  </span>
                  <ConfidenceBar value={confValidation} />
                </dd>

                <dt className="text-ink-4">Cross-check</dt>
                <dd data-testid="provenance-drawer-crossCheck">
                  {CROSS_CHECK_LABEL[p.crossCheckResult]}
                </dd>

                <dt className="text-ink-4">Methodology</dt>
                <dd
                  className="num"
                  style={{ fontSize: 11 }}
                  data-testid="provenance-drawer-methodologyVersion"
                >
                  {p.methodologyVersion}
                </dd>

                {status === 'approved' && p.reviewer && (
                  <>
                    <dt className="text-ink-4">Reviewed</dt>
                    <dd data-testid="provenance-drawer-reviewer">
                      <span title={p.reviewedAt}>{p.reviewer}</span>
                      {p.reviewedAt && (
                        <span className="ml-2 text-ink-4">
                          <time dateTime={p.reviewedAt}>{relative(p.reviewedAt)}</time>
                        </span>
                      )}
                      {p.reviewerNotes && (
                        <p
                          className="mt-1 text-ink-3"
                          style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
                        >
                          {p.reviewerNotes}
                        </p>
                      )}
                    </dd>
                  </>
                )}

                {p.stabilityEdgeCase && (
                  <>
                    <dt className="text-ink-4">Note</dt>
                    <dd className="text-precalib-fg" data-testid="provenance-drawer-stability-note">
                      E.1.1 mean-substitution applied (program younger than 3 years).
                    </dd>
                  </>
                )}
              </dl>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DrawerHeaderCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow" style={{ fontSize: 9 }}>
        {label}
      </p>
      <p className="num mt-1" style={{ fontSize: 14 }}>
        {value}
      </p>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="ml-2 inline-flex items-center gap-1.5">
      <span
        className="inline-block w-16"
        style={{ height: 4, background: 'var(--rule-soft)' }}
        aria-hidden
      >
        <span className="block h-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </span>
      <span className="num text-ink-4" style={{ fontSize: 10 }}>
        {pct}%
      </span>
    </span>
  );
}

/**
 * Phase 3.9 / W7 — archive snapshot link. When provenance.archivePath is
 * present, fetches a 15-min signed URL on first interaction (lazy: avoids
 * burning a signed-URL quota on every drawer open). Falls back to a
 * disabled label with an explanatory tooltip when:
 *   - archivePath is null (legacy row, pre-W0 archive),
 *   - the signed-URL action returns null (GCS misconfigured / path
 *     validation rejected the path).
 */
function ArchiveSnapshotLink({ archivePath }: { archivePath: string | null }) {
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleFetch = React.useCallback(async () => {
    if (loading || signedUrl || !archivePath) return;
    setLoading(true);
    try {
      const result = await getArchiveSignedUrl(archivePath);
      if (result) {
        setSignedUrl(result.url);
      } else {
        setError('Snapshot unavailable');
      }
    } catch {
      setError('Snapshot unavailable');
    } finally {
      setLoading(false);
    }
  }, [archivePath, loading, signedUrl]);

  if (!archivePath) {
    return (
      <span
        title="No archived snapshot for this row (created before Phase 3.9 archive went live)."
        aria-disabled="true"
        className="num cursor-not-allowed text-ink-4 line-through"
        data-testid="provenance-drawer-archive-disabled"
      >
        No archived snapshot
      </span>
    );
  }

  if (signedUrl) {
    return (
      <a
        href={signedUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-accent underline-offset-4 hover:underline"
        data-testid="provenance-drawer-archive-link"
      >
        View archived snapshot ↗
      </a>
    );
  }

  if (error) {
    return (
      <span
        title={error}
        aria-disabled="true"
        className="num cursor-not-allowed text-ink-4"
        data-testid="provenance-drawer-archive-error"
      >
        {error}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleFetch}
      disabled={loading}
      className="text-accent underline-offset-4 hover:underline disabled:cursor-wait disabled:text-ink-4"
      data-testid="provenance-drawer-archive-trigger"
    >
      {loading ? 'Fetching…' : 'View archived snapshot ↗'}
    </button>
  );
}

type DerivedInputValue = Record<string, unknown>;

function DerivedInputDisplay({ value }: { value: DerivedInputValue }) {
  const sourceUrl = typeof value['sourceUrl'] === 'string' ? (value['sourceUrl'] as string) : null;
  const entries = Object.entries(value).filter(
    ([k, v]) => k !== 'sourceUrl' && v !== null && v !== undefined
  );
  return (
    <span className="text-data-sm">
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 ? ' · ' : null}
          <span className="text-ink-4">{k}</span>
          {': '}
          <span className="num text-ink-2" style={{ fontSize: 11 }}>
            {String(v)}
          </span>
        </span>
      ))}
      {sourceUrl && (
        <>
          {' '}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline-offset-4 hover:underline"
          >
            View source ↗
          </a>
        </>
      )}
    </span>
  );
}

/**
 * Phase 3.10d / D.1 — drawer banners for the two quality signals
 * shipped in Phase 3.10b.1 (cross-check disagreement and derive-LLM
 * mismatch). The table shows chips per row; the drawer surfaces the
 * full context so the reviewer can adjudicate without leaving the
 * panel.
 */
function QualitySignalBanners({ provenance }: { provenance: Record<string, unknown> }) {
  const ccResult = provenance['crossCheckResult'];
  const ccUrl =
    typeof provenance['crossCheckUrl'] === 'string'
      ? (provenance['crossCheckUrl'] as string)
      : null;
  const mismatch =
    typeof provenance['deriveLlmMismatch'] === 'string' &&
    (provenance['deriveLlmMismatch'] as string).length > 0
      ? (provenance['deriveLlmMismatch'] as string)
      : null;
  const showCrossCheck = ccResult === 'disagree';
  if (!showCrossCheck && !mismatch) return null;
  return (
    <div className="mt-4 grid gap-3" data-testid="quality-signal-banners">
      {showCrossCheck && (
        <aside
          role="note"
          className="border-l-4 px-4 py-3 text-data-sm"
          style={{
            borderColor: 'var(--accent)',
            background: 'rgba(155, 32, 49, 0.06)',
          }}
          data-testid="banner-crosscheck-disagree"
        >
          <p className="eyebrow mb-1" style={{ color: 'var(--accent)' }}>
            Cross-check disagreement
          </p>
          <p className="text-ink" style={{ fontSize: 12, lineHeight: 1.5 }}>
            A Tier-2 source disagrees with this extracted value. The row is queued for /review with{' '}
            <code className="num">crossCheckResult=disagree</code> recorded for the audit trail.
            Adjudicate in /review before approving.
          </p>
          {ccUrl && (
            <p className="mt-2 text-data-sm">
              <a
                href={ccUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline-offset-4 hover:underline"
              >
                View Tier-2 source ↗
              </a>
            </p>
          )}
        </aside>
      )}
      {mismatch && (
        <aside
          role="note"
          className="border-l-4 px-4 py-3 text-data-sm"
          style={{
            borderColor: 'var(--accent)',
            background: 'rgba(155, 32, 49, 0.06)',
          }}
          data-testid="banner-derive-llm-mismatch"
        >
          <p className="eyebrow mb-1" style={{ color: 'var(--accent)' }}>
            Derive ↔ LLM mismatch
          </p>
          <p className="text-ink" style={{ fontSize: 12, lineHeight: 1.5 }}>
            The derived value differs from a prior LLM extraction for this field. The
            methodology-mandated derive published; the prior LLM row is preserved for audit. Either
            the country lookup is stale or the LLM extracted from a wrong page.
          </p>
          <p className="mt-2 text-data-sm text-ink-3" style={{ fontSize: 11 }}>
            <strong>Note:</strong> {mismatch}
          </p>
        </aside>
      )}
    </div>
  );
}
