/**
 * Pure helpers used by the editorial review queue (I-01). Kept hermetic so
 * vitest can import without 'server-only'.
 */

export type ReviewFilterTab =
  | 'all'
  | 'pending'
  | 'in-review'
  | 'flagged'
  | 'high-confidence'
  // Phase 3.10d / D.2 — rows where either Phase 3.10b.1 quality signal fires.
  | 'quality-signals'
  // Phase 3.10d / D.3 — rows assigned to the current reviewer (?reviewer=<uuid>).
  | 'my-queue';

export interface ProvenanceConfidence {
  extractionConfidence: number | null;
  validationConfidence: number | null;
  /** Validator's pass/fail signal — Stage 3 of the pipeline writes this. */
  isValid: boolean | null;
}

/**
 * Read defensively from the provenance JSONB. The verifier asserts the 13
 * core ADR-007 keys on every approved row but the queue surfaces pending
 * rows where the shape may be partial.
 */
export function readProvenanceConfidence(raw: unknown): ProvenanceConfidence {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { extractionConfidence: null, validationConfidence: null, isValid: null };
  }
  const obj = raw as Record<string, unknown>;
  return {
    extractionConfidence: numberOrNull(obj.extractionConfidence),
    validationConfidence: numberOrNull(obj.validationConfidence),
    isValid: typeof obj.isValid === 'boolean' ? (obj.isValid as boolean) : null,
  };
}

/**
 * Bulk-approve gate. A row qualifies iff:
 *  - extractionConfidence ≥ 0.85
 *  - validationConfidence ≥ 0.85
 *  - isValid !== false (true OR null both pass — many pending rows haven't
 *    been validated yet but their extraction is already strong enough)
 *
 * Returns false on any malformed provenance — fail closed.
 */
export function isBulkApproveCandidate(prov: ProvenanceConfidence): boolean {
  if (prov.extractionConfidence === null || prov.extractionConfidence < 0.85) return false;
  if (prov.validationConfidence === null || prov.validationConfidence < 0.85) return false;
  if (prov.isValid === false) return false;
  return true;
}

/**
 * Phase 3.10b.1 — quality-signal flags. Read defensively from the
 * provenance JSONB; both signals are written by Phase 3.10 commits
 * but pre-3.10 rows lack them and render as `false`.
 *
 *   crossCheckDisagrees — provenance.crossCheckResult === 'disagree'
 *   deriveLlmMismatch    — provenance.deriveLlmMismatch is a non-empty string
 */
export interface QualitySignals {
  crossCheckDisagrees: boolean;
  deriveLlmMismatch: boolean;
  /** The raw mismatch note when present, for the drawer banner. */
  mismatchNote: string | null;
  /** The raw cross-check Tier-2 URL when present, for the drawer banner. */
  crossCheckUrl: string | null;
}

export function readQualitySignals(raw: unknown): QualitySignals {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      crossCheckDisagrees: false,
      deriveLlmMismatch: false,
      mismatchNote: null,
      crossCheckUrl: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  const ccResult = obj['crossCheckResult'];
  const mismatch = obj['deriveLlmMismatch'];
  const ccUrl = obj['crossCheckUrl'];
  return {
    crossCheckDisagrees: ccResult === 'disagree',
    deriveLlmMismatch: typeof mismatch === 'string' && mismatch.length > 0,
    mismatchNote: typeof mismatch === 'string' && mismatch.length > 0 ? mismatch : null,
    crossCheckUrl: typeof ccUrl === 'string' && ccUrl.length > 0 ? ccUrl : null,
  };
}

/**
 * Source domain extracted from a sourceUrl. Trims protocol, drops `www.`,
 * truncates to 32 chars. Falls back to a literal "—" for empty inputs.
 */
export function sourceDomain(sourceUrl: string | null | undefined): string {
  if (!sourceUrl || typeof sourceUrl !== 'string') return '—';
  try {
    const u = new URL(sourceUrl);
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host.length > 32 ? host.slice(0, 31) + '…' : host;
  } catch {
    return '—';
  }
}

/**
 * Hash an UUID-ish row id into a 6-char display tag (e.g. "RV-3F2A1B").
 * Pure: same input → same output. Used in the queue table's ID column.
 */
export function reviewIdTag(id: string): string {
  if (!id) return 'RV-000000';
  // FNV-1a 32-bit then take the lower 24 bits as 6 hex chars.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'RV-' + (h & 0xffffff).toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Relative age in compact units. "2h" / "1d" / "3d" — for the queue's
 * Age column. Uses fixed `Date.now()` so callers can pass a clock for tests.
 */
export function relativeAge(extractedAt: Date | string | null, now: Date = new Date()): string {
  if (extractedAt === null || extractedAt === undefined) return '—';
  const t =
    typeof extractedAt === 'string' ? new Date(extractedAt).getTime() : extractedAt.getTime();
  if (Number.isNaN(t)) return '—';
  const diffMs = now.getTime() - t;
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

/**
 * Phase 3.10 — SLA tier for the review-queue Age column.
 *
 *   green  — under 7 days old (or undated)
 *   orange — 7 to 13 days old (warning band)
 *   red    — 14 or more days old (overdue)
 *
 * Cohort runs queue ≥1500 rows; the SLA badge is the per-row signal
 * to the reviewer that a row is aging out.
 */
export type SlaTier = 'green' | 'orange' | 'red';

export const SLA_ORANGE_DAYS = 7;
export const SLA_RED_DAYS = 14;

export function slaTier(extractedAt: Date | string | null, now: Date = new Date()): SlaTier {
  if (extractedAt === null || extractedAt === undefined) return 'green';
  const t =
    typeof extractedAt === 'string' ? new Date(extractedAt).getTime() : extractedAt.getTime();
  if (Number.isNaN(t)) return 'green';
  const days = Math.max(0, (now.getTime() - t) / (24 * 60 * 60 * 1000));
  if (days >= SLA_RED_DAYS) return 'red';
  if (days >= SLA_ORANGE_DAYS) return 'orange';
  return 'green';
}

/**
 * Decide which row matches the active filter tab. Status fields on the
 * existing schema are 'pending_review' / 'approved' / 'rejected' / etc.;
 * 'in-review' and 'flagged' are not native statuses. We treat them as
 * derived from confidence + age:
 *   - 'pending'         → status === 'pending_review'
 *   - 'high-confidence' → pending AND isBulkApproveCandidate
 *   - 'flagged'         → pending AND extractionConfidence < 0.7
 *   - 'in-review'       → pending AND not high-confidence AND not flagged
 *   - 'all'             → no filter
 */
export function matchesReviewTab(
  tab: ReviewFilterTab,
  status: string,
  prov: ProvenanceConfidence,
  qualitySignals?: QualitySignals,
  assignedTo: string | null = null,
  reviewerId: string | null = null
): boolean {
  if (tab === 'all') return true;
  if (tab === 'my-queue') {
    return reviewerId !== null && assignedTo === reviewerId;
  }
  if (status !== 'pending_review') return false;
  if (tab === 'pending') return true;
  if (tab === 'high-confidence') return isBulkApproveCandidate(prov);
  if (tab === 'flagged') {
    const c = prov.extractionConfidence;
    return c !== null && c < 0.7;
  }
  if (tab === 'in-review') {
    return !isBulkApproveCandidate(prov) && !((prov.extractionConfidence ?? 1) < 0.7);
  }
  if (tab === 'quality-signals') {
    return Boolean(qualitySignals?.crossCheckDisagrees || qualitySignals?.deriveLlmMismatch);
  }
  return false;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
