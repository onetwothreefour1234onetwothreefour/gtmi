// Phase 3.9 / W0 — canonical archive path builder.
//
// Layout: {country_iso}/{program_id}/{yyyy-mm-dd}/{sha256(content)}.{ext}
//
// Hash-based filename collapses re-scrapes of identical content into a
// single object (idempotent uploads, native dedup). Date partition keeps
// daily listings tractable at scale.

import { createHash } from 'crypto';

export interface ArchivePathInput {
  countryIso: string;
  programId: string;
  scrapedAt: Date;
  contentHash?: string;
  /** Bytes whose sha256 produces contentHash if not supplied. */
  contentBytes?: Uint8Array | Buffer | string;
  /**
   * File extension without leading dot. md / pdf / html / txt / json.
   * Defaults to 'md'.
   */
  ext?: string;
}

const ISO_RE = /^[A-Z]{3}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function sha256Hex(input: Uint8Array | Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function archivePathFor(input: ArchivePathInput): string {
  if (!ISO_RE.test(input.countryIso)) {
    throw new Error(
      `archivePathFor: countryIso must be 3 uppercase letters, got "${input.countryIso}"`
    );
  }
  if (!UUID_RE.test(input.programId)) {
    throw new Error(`archivePathFor: programId must be a UUID, got "${input.programId}"`);
  }
  const hash =
    input.contentHash ?? (input.contentBytes !== undefined ? sha256Hex(input.contentBytes) : null);
  if (hash === null || hash === '') {
    throw new Error('archivePathFor: contentHash or contentBytes is required');
  }
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(`archivePathFor: contentHash must be 64-char lowercase hex, got "${hash}"`);
  }
  const date = input.scrapedAt;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('archivePathFor: scrapedAt must be a valid Date');
  }
  const ext = (input.ext ?? 'md').toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) {
    throw new Error(`archivePathFor: ext must be 1-8 alphanumeric chars, got "${ext}"`);
  }
  const datePartition = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return `${input.countryIso}/${input.programId}/${datePartition}/${hash}.${ext}`;
}

export function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'md':
      return 'text/markdown; charset=utf-8';
    case 'pdf':
      return 'application/pdf';
    case 'html':
    case 'htm':
      return 'text/html; charset=utf-8';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
