'use server';

// Phase 3.9 / W7 — server action that mints a short-TTL signed URL for
// a GCS archive snapshot. Used by the provenance drawer (and
// /review/[id]) to render an active "View archived snapshot" link
// when the live sourceUrl returns 404.
//
// Defensive contract:
//   - Path validation: must match the canonical archive layout
//     (ISO3/uuid/yyyy-mm-dd/sha256.ext). Rejects arbitrary paths to
//     prevent the action becoming a generic GCS-URL minting service.
//   - TTL: 15 minutes by default. Caller can override down to 60s
//     and up to 1 hour. Hard-capped to prevent leaked URLs from
//     having multi-day validity.
//   - Failures return null rather than throwing — the UI degrades to
//     a disabled link with a tooltip.

import { getStorage } from '@gtmi/extraction';

const ARCHIVE_PATH_RE =
  /^[A-Z]{3}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{64}\.[a-z0-9]{1,8}$/;

const DEFAULT_TTL_SECONDS = 15 * 60;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 60 * 60;

export interface SignedUrlResult {
  url: string;
  expiresAt: string;
}

export async function getArchiveSignedUrl(
  archivePath: string,
  ttlSecondsArg?: number
): Promise<SignedUrlResult | null> {
  if (!archivePath || !ARCHIVE_PATH_RE.test(archivePath)) {
    return null;
  }
  const ttl = Math.min(
    Math.max(
      typeof ttlSecondsArg === 'number' ? ttlSecondsArg : DEFAULT_TTL_SECONDS,
      MIN_TTL_SECONDS
    ),
    MAX_TTL_SECONDS
  );
  try {
    const url = await getStorage().signedUrl({ storagePath: archivePath, ttlSeconds: ttl });
    return {
      url,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[archive] signedUrl failed for ${archivePath}: ${msg}`);
    return null;
  }
}
