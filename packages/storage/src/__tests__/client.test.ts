import { afterEach, describe, expect, it } from 'vitest';
import { clearInMemoryStorage, getInMemoryStorage, getStorage, setStorageImpl } from '../client';

describe('getStorage', () => {
  afterEach(() => {
    setStorageImpl(null);
    clearInMemoryStorage();
  });

  it('uses the override when set', () => {
    const fake = getInMemoryStorage();
    setStorageImpl(fake);
    expect(getStorage()).toBe(fake);
  });

  it('falls back to in-memory when GCS_ARCHIVE_BUCKET is unset', () => {
    const original = process.env['GCS_ARCHIVE_BUCKET'];
    delete process.env['GCS_ARCHIVE_BUCKET'];
    try {
      const impl = getStorage();
      expect(impl.isReal).toBe(false);
    } finally {
      if (original !== undefined) process.env['GCS_ARCHIVE_BUCKET'] = original;
    }
  });
});

describe('InMemoryStorage', () => {
  afterEach(() => {
    clearInMemoryStorage();
  });

  it('round-trips uploaded content', async () => {
    const storage = getInMemoryStorage();
    const path = 'NLD/abc/2026-04-30/deadbeef.md';
    const result = await storage.upload({
      storagePath: path,
      contentBytes: 'hello',
      contentType: 'text/markdown',
    });
    expect(result.created).toBe(true);
    expect(result.byteSize).toBe(5);
    const dl = await storage.download(path);
    expect(dl.contentBytes.toString('utf8')).toBe('hello');
    expect(dl.contentType).toBe('text/markdown');
    expect(dl.byteSize).toBe(5);
  });

  it('reports created=false on second upload of same path', async () => {
    const storage = getInMemoryStorage();
    const path = 'NLD/abc/2026-04-30/deadbeef.md';
    await storage.upload({
      storagePath: path,
      contentBytes: 'first',
      contentType: 'text/markdown',
    });
    const second = await storage.upload({
      storagePath: path,
      contentBytes: 'second',
      contentType: 'text/markdown',
    });
    expect(second.created).toBe(false);
    // Idempotent upload: the original content is preserved (path is
    // hash-derived in production so same path means same content; the
    // test exercises this contract explicitly).
    const dl = await storage.download(path);
    expect(dl.contentBytes.toString('utf8')).toBe('first');
  });

  it('throws on download of missing path', async () => {
    const storage = getInMemoryStorage();
    await expect(storage.download('NLD/abc/2026-04-30/missing.md')).rejects.toThrow(/no object/);
  });

  it('returns a signed-url-shaped string with TTL encoded', async () => {
    const storage = getInMemoryStorage();
    const url = await storage.signedUrl({
      storagePath: 'NLD/abc/2026-04-30/x.md',
      ttlSeconds: 60,
    });
    expect(url).toMatch(/^in-memory:\/\/gtmi-archive\/NLD\/abc\/2026-04-30\/x\.md\?expires=/);
  });
});
