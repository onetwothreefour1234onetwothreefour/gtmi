// Phase 3.9 / W0 — GCS client wrapper for the scrape archive bucket.
//
// Bucket layout: a single regional bucket (europe-west1, matching the
// scraper Cloud Run region) holds every archived scrape under
// {country_iso}/{program_id}/{yyyy-mm-dd}/{sha256}.{ext}. The bucket
// name is read from GCS_ARCHIVE_BUCKET; the test harness can swap a
// process-local in-memory implementation via setStorageImpl().
//
// Uploads are idempotent: hash-based filenames mean re-uploads of the
// same content produce no new object. The Storage class's
// `file().save()` accepts an `options.preconditionOpts.ifGenerationMatch: 0`
// to refuse overwrites — we set it for archive integrity (a hash
// collision OR a path collision should be a hard error, not a silent
// overwrite). The error code from GCS in that case is 412
// PreconditionFailed; we treat it as a no-op success ("already there").

export interface ArchiveUploadOptions {
  /** Canonical path from archivePathFor(). */
  storagePath: string;
  /** Bytes to upload. */
  contentBytes: Uint8Array | Buffer | string;
  /** MIME type. */
  contentType: string;
  /** Optional metadata stored on the object. */
  metadata?: Record<string, string>;
}

export interface ArchiveUploadResult {
  storagePath: string;
  bucket: string;
  byteSize: number;
  /** True if this upload created a new object; false if it already existed. */
  created: boolean;
}

export interface ArchiveDownloadResult {
  storagePath: string;
  bucket: string;
  contentBytes: Buffer;
  contentType: string;
  byteSize: number;
}

export interface SignedUrlOptions {
  storagePath: string;
  /** TTL in seconds. Default 900 (15 min). Max 7 days per GCS limits. */
  ttlSeconds?: number;
}

export interface StorageImpl {
  upload(opts: ArchiveUploadOptions): Promise<ArchiveUploadResult>;
  download(storagePath: string): Promise<ArchiveDownloadResult>;
  signedUrl(opts: SignedUrlOptions): Promise<string>;
  /** True if this implementation is the GCS-backed one (not the test fake). */
  readonly isReal: boolean;
  /** The bucket name in use. */
  readonly bucketName: string;
}

let _override: StorageImpl | null = null;

export function setStorageImpl(impl: StorageImpl | null): void {
  _override = impl;
}

export function getStorage(): StorageImpl {
  if (_override) return _override;
  const bucketName = process.env['GCS_ARCHIVE_BUCKET'];
  if (!bucketName) {
    // Fallback to in-memory so the pipeline doesn't crash in dev/CI
    // environments without GCS configured. The scrape.ts caller decides
    // whether absence of a real bucket is fatal.
    return getInMemoryStorage();
  }
  return new GcsStorage(bucketName);
}

// ───────────────────────────────────────────────────────────────────
// In-memory implementation for tests and dev. Process-local; lost on
// restart. The scrape_history row still gets written, but its
// storage_path is unverifiable across processes.
// ───────────────────────────────────────────────────────────────────

interface InMemoryEntry {
  contentBytes: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

let _inMemory: Map<string, InMemoryEntry> | null = null;

function ensureInMemory(): Map<string, InMemoryEntry> {
  if (_inMemory === null) _inMemory = new Map();
  return _inMemory;
}

class InMemoryStorage implements StorageImpl {
  readonly isReal = false;
  readonly bucketName = 'in-memory://gtmi-archive';

  async upload(opts: ArchiveUploadOptions): Promise<ArchiveUploadResult> {
    const store = ensureInMemory();
    const buf = Buffer.isBuffer(opts.contentBytes)
      ? opts.contentBytes
      : Buffer.from(opts.contentBytes);
    const existed = store.has(opts.storagePath);
    if (!existed) {
      store.set(opts.storagePath, {
        contentBytes: buf,
        contentType: opts.contentType,
        metadata: opts.metadata,
      });
    }
    return {
      storagePath: opts.storagePath,
      bucket: this.bucketName,
      byteSize: buf.byteLength,
      created: !existed,
    };
  }

  async download(storagePath: string): Promise<ArchiveDownloadResult> {
    const store = ensureInMemory();
    const entry = store.get(storagePath);
    if (!entry) {
      throw new Error(`InMemoryStorage: no object at "${storagePath}"`);
    }
    return {
      storagePath,
      bucket: this.bucketName,
      contentBytes: entry.contentBytes,
      contentType: entry.contentType,
      byteSize: entry.contentBytes.byteLength,
    };
  }

  async signedUrl(opts: SignedUrlOptions): Promise<string> {
    const ttl = opts.ttlSeconds ?? 900;
    const expires = new Date(Date.now() + ttl * 1000).toISOString();
    return `in-memory://gtmi-archive/${opts.storagePath}?expires=${encodeURIComponent(expires)}`;
  }
}

let _inMemoryInstance: InMemoryStorage | null = null;

export function getInMemoryStorage(): StorageImpl {
  if (_inMemoryInstance === null) _inMemoryInstance = new InMemoryStorage();
  return _inMemoryInstance;
}

export function clearInMemoryStorage(): void {
  _inMemory = null;
}

// ───────────────────────────────────────────────────────────────────
// Real GCS implementation. Lazily-imported so the package is usable
// (and testable) without @google-cloud/storage installed.
// ───────────────────────────────────────────────────────────────────

// Structural type narrow enough to express what we need from a GCS Bucket
// without dragging in the @google-cloud/storage type-tree (whose CJS/ESM
// duality breaks `as` casts inside this package — the runtime is the same
// class either way).
interface GcsFile {
  save(
    data: Buffer,
    opts: {
      contentType: string;
      metadata?: { metadata?: Record<string, string> };
      preconditionOpts?: { ifGenerationMatch?: number };
    }
  ): Promise<unknown>;
  download(): Promise<[Buffer]>;
  getMetadata(): Promise<[{ size?: string | number; contentType?: string }]>;
  getSignedUrl(opts: { action: 'read'; expires: number }): Promise<[string]>;
}
interface GcsBucket {
  file(name: string): GcsFile;
}

class GcsStorage implements StorageImpl {
  readonly isReal = true;
  readonly bucketName: string;
  private _bucket: GcsBucket | null = null;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  private async ensureBucket(): Promise<GcsBucket> {
    if (this._bucket) return this._bucket;
    const mod = (await import('@google-cloud/storage')) as unknown as {
      Storage: new () => { bucket(name: string): GcsBucket };
    };
    const storage = new mod.Storage();
    const bucket = storage.bucket(this.bucketName);
    this._bucket = bucket;
    return bucket;
  }

  async upload(opts: ArchiveUploadOptions): Promise<ArchiveUploadResult> {
    const bucket = await this.ensureBucket();
    const buf = Buffer.isBuffer(opts.contentBytes)
      ? opts.contentBytes
      : Buffer.from(opts.contentBytes);
    const file = bucket.file(opts.storagePath);
    try {
      await file.save(buf, {
        contentType: opts.contentType,
        metadata: opts.metadata ? { metadata: opts.metadata } : undefined,
        // ifGenerationMatch: 0 means "only if the object does not exist".
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      return {
        storagePath: opts.storagePath,
        bucket: this.bucketName,
        byteSize: buf.byteLength,
        created: true,
      };
    } catch (err) {
      // 412 PreconditionFailed → object already exists. Idempotent
      // success: same content_hash means same content (or a sha256
      // collision, which we treat as "no-op" because the path would
      // already point at correct content).
      const code = (err as { code?: number }).code;
      if (code === 412) {
        return {
          storagePath: opts.storagePath,
          bucket: this.bucketName,
          byteSize: buf.byteLength,
          created: false,
        };
      }
      throw err;
    }
  }

  async download(storagePath: string): Promise<ArchiveDownloadResult> {
    const bucket = await this.ensureBucket();
    const file = bucket.file(storagePath);
    const [contents] = await file.download();
    const [metadata] = await file.getMetadata();
    const sizeRaw = metadata.size;
    const size =
      typeof sizeRaw === 'number'
        ? sizeRaw
        : typeof sizeRaw === 'string'
          ? parseInt(sizeRaw, 10)
          : contents.byteLength;
    return {
      storagePath,
      bucket: this.bucketName,
      contentBytes: contents,
      contentType: metadata.contentType ?? 'application/octet-stream',
      byteSize: Number.isFinite(size) ? size : contents.byteLength,
    };
  }

  async signedUrl(opts: SignedUrlOptions): Promise<string> {
    const bucket = await this.ensureBucket();
    const file = bucket.file(opts.storagePath);
    const ttl = opts.ttlSeconds ?? 900;
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + ttl * 1000,
    });
    return url;
  }
}
