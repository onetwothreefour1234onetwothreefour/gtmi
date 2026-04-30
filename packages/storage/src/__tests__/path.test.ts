import { describe, expect, it } from 'vitest';
import { archivePathFor, contentTypeForExt } from '../path';

describe('archivePathFor', () => {
  const VALID_UUID = '668cec08-4b78-4cd2-b215-3047c551ce6e';
  const VALID_HASH = 'a'.repeat(64);
  const VALID_DATE = new Date('2026-04-30T12:34:56Z');

  it('builds canonical layout {iso}/{program}/{date}/{hash}.{ext}', () => {
    const path = archivePathFor({
      countryIso: 'NLD',
      programId: VALID_UUID,
      scrapedAt: VALID_DATE,
      contentHash: VALID_HASH,
      ext: 'md',
    });
    expect(path).toBe(`NLD/${VALID_UUID}/2026-04-30/${VALID_HASH}.md`);
  });

  it('defaults extension to md', () => {
    const path = archivePathFor({
      countryIso: 'JPN',
      programId: VALID_UUID,
      scrapedAt: VALID_DATE,
      contentHash: VALID_HASH,
    });
    expect(path.endsWith('.md')).toBe(true);
  });

  it('hashes contentBytes when contentHash is not supplied', () => {
    const path = archivePathFor({
      countryIso: 'NLD',
      programId: VALID_UUID,
      scrapedAt: VALID_DATE,
      contentBytes: 'hello world',
      ext: 'txt',
    });
    // sha256('hello world') = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    expect(path).toContain('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9.txt');
  });

  it('rejects non-ISO3 country codes', () => {
    expect(() =>
      archivePathFor({
        countryIso: 'us',
        programId: VALID_UUID,
        scrapedAt: VALID_DATE,
        contentHash: VALID_HASH,
      })
    ).toThrow(/countryIso/);
  });

  it('rejects non-UUID program IDs', () => {
    expect(() =>
      archivePathFor({
        countryIso: 'NLD',
        programId: 'not-a-uuid',
        scrapedAt: VALID_DATE,
        contentHash: VALID_HASH,
      })
    ).toThrow(/programId/);
  });

  it('rejects malformed content hashes', () => {
    expect(() =>
      archivePathFor({
        countryIso: 'NLD',
        programId: VALID_UUID,
        scrapedAt: VALID_DATE,
        contentHash: 'short',
      })
    ).toThrow(/contentHash/);
  });

  it('requires either contentHash or contentBytes', () => {
    expect(() =>
      archivePathFor({
        countryIso: 'NLD',
        programId: VALID_UUID,
        scrapedAt: VALID_DATE,
      })
    ).toThrow(/contentHash or contentBytes/);
  });

  it('rejects extensions outside [a-z0-9]{1,8}', () => {
    expect(() =>
      archivePathFor({
        countryIso: 'NLD',
        programId: VALID_UUID,
        scrapedAt: VALID_DATE,
        contentHash: VALID_HASH,
        ext: 'with space',
      })
    ).toThrow(/ext/);
  });

  it('partitions by UTC date (not local)', () => {
    // Set a UTC time near midnight that would land on different dates
    // depending on timezone interpretation.
    const lateUtc = new Date('2026-04-30T23:59:00Z');
    const path = archivePathFor({
      countryIso: 'NLD',
      programId: VALID_UUID,
      scrapedAt: lateUtc,
      contentHash: VALID_HASH,
    });
    expect(path).toContain('/2026-04-30/');
  });
});

describe('contentTypeForExt', () => {
  it.each([
    ['md', 'text/markdown; charset=utf-8'],
    ['pdf', 'application/pdf'],
    ['html', 'text/html; charset=utf-8'],
    ['txt', 'text/plain; charset=utf-8'],
    ['json', 'application/json'],
    ['unknown-ext', 'application/octet-stream'],
  ])('maps %s → %s', (ext, expected) => {
    expect(contentTypeForExt(ext)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(contentTypeForExt('PDF')).toBe('application/pdf');
  });
});
