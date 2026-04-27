/**
 * Pure row-level provenance checker shared by:
 *   - scripts/verify-provenance.ts (CI verifier; reads field_values.provenance from DB)
 *   - publish stage / canary-run / Vitest tests (verify the row we're about to
 *     write would be accepted by CI before we INSERT it)
 *
 * Exporting the check from a shared, dependency-free module avoids the
 * "test mirrors the script" drift that happened in early Phase 3.
 */

export const REQUIRED_KEYS_ALWAYS = [
  'sourceUrl',
  'geographicLevel',
  'sourceTier',
  'scrapeTimestamp',
  'contentHash',
  'sourceSentence',
  'characterOffsets',
  'extractionModel',
  'extractionConfidence',
  'validationModel',
  'validationConfidence',
  'crossCheckResult',
  'methodologyVersion',
] as const;

/**
 * Keys where `null` is a legitimate value (presence required, content
 * may be null). Phase 3.5 / ADR-014: synthetic country-substitute rows
 * set sourceTier: null because there is no real source tier.
 */
export const NULLABLE_REQUIRED_KEYS: ReadonlySet<string> = new Set(['sourceTier']);

/** Keys required only when status='approved' — reviewer attribution. */
export const REQUIRED_KEYS_APPROVED = ['reviewedBy', 'reviewedAt', 'reviewDecision'] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Returns a list of issues. Empty list = row passes the verifier.
 *
 * `status` is one of `field_values.status` — usually 'approved' or
 * 'pending_review'. The 'approved'-only key checks fire when status
 * is exactly 'approved'.
 */
export function checkProvenanceRow(provenance: unknown, status: string): string[] {
  const issues: string[] = [];

  if (!isObject(provenance)) {
    return [`provenance is not an object (got ${typeof provenance})`];
  }

  for (const key of REQUIRED_KEYS_ALWAYS) {
    const isNullable = NULLABLE_REQUIRED_KEYS.has(key);
    if (!(key in provenance) || provenance[key] === undefined) {
      issues.push(`missing required key: ${key}`);
    } else if (provenance[key] === null && !isNullable) {
      issues.push(`missing required key: ${key}`);
    }
  }

  // Shape checks for fields that are easy to corrupt.
  const offsets = provenance['characterOffsets'];
  if (offsets !== undefined && offsets !== null) {
    if (
      !isObject(offsets) ||
      typeof offsets['start'] !== 'number' ||
      typeof offsets['end'] !== 'number'
    ) {
      issues.push('characterOffsets must be { start: number, end: number }');
    }
  }

  const tier = provenance['sourceTier'];
  if (tier !== undefined && tier !== null && typeof tier !== 'number') {
    issues.push(`sourceTier must be a number (got ${typeof tier})`);
  }

  if (status === 'approved') {
    for (const key of REQUIRED_KEYS_APPROVED) {
      if (!(key in provenance)) {
        issues.push(`approved row missing reviewer key: ${key}`);
      }
    }
  }

  return issues;
}
