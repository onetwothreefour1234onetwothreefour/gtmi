import { describe, it, expect } from 'vitest';
import { sanitiseSearchInput, buildTsQuery, buildSearchPredicate, buildSearchRank } from './search';
import { sql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * Tests assert SQL-fragment shape rather than running against Postgres.
 * `PgDialect.sqlToQuery()` is Drizzle's public renderer — it returns the
 * final `{ sql, params }` pair the driver would send. Hermetic, CI-stable,
 * no DB connection required.
 */

const dialect = new PgDialect();

function inspectSql(fragment: SQL): { sql: string; params: unknown[] } {
  const rendered = dialect.sqlToQuery(fragment);
  return { sql: rendered.sql, params: rendered.params };
}

describe('sanitiseSearchInput', () => {
  it('returns "" for empty / whitespace / null inputs', () => {
    expect(sanitiseSearchInput('')).toBe('');
    expect(sanitiseSearchInput('   ')).toBe('');
    expect(sanitiseSearchInput('\t\n')).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitiseSearchInput(undefined as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitiseSearchInput(null as any)).toBe('');
  });

  it('rejects pure-punctuation input (no usable lexemes)', () => {
    expect(sanitiseSearchInput('???')).toBe('');
    expect(sanitiseSearchInput('!!! ...')).toBe('');
    expect(sanitiseSearchInput('---')).toBe('');
  });

  it('preserves alphanumeric content', () => {
    expect(sanitiseSearchInput('australia 482')).toBe('australia 482');
    expect(sanitiseSearchInput('S Pass')).toBe('S Pass');
  });

  it('strips ASCII control characters', () => {
    expect(sanitiseSearchInput('hello\x00world')).toBe('hello world');
    expect(sanitiseSearchInput('a\x1fb')).toBe('a b');
    expect(sanitiseSearchInput('a\x7fb')).toBe('a b');
  });

  it('collapses internal whitespace runs', () => {
    expect(sanitiseSearchInput('   australia   482   ')).toBe('australia 482');
    expect(sanitiseSearchInput('a\t\nb')).toBe('a b');
  });

  it('caps input at 200 characters', () => {
    const long = 'a'.repeat(500);
    expect(sanitiseSearchInput(long)).toHaveLength(200);
  });

  it('does not throw on non-string inputs', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitiseSearchInput(123 as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitiseSearchInput({} as any)).toBe('');
  });
});

describe('buildTsQuery', () => {
  it('returns null for empty / whitespace / non-lexemic input', () => {
    expect(buildTsQuery('')).toBeNull();
    expect(buildTsQuery('   ')).toBeNull();
    expect(buildTsQuery('???')).toBeNull();
  });

  it('returns an SQL fragment for valid input', () => {
    const q = buildTsQuery('australia');
    expect(q).not.toBeNull();
    // It's an SQL object — duck-type via Drizzle's interface.
    expect(q).toHaveProperty('queryChunks');
  });

  it('parameterises the user input rather than inlining it', () => {
    const q = buildTsQuery("australia'; DROP TABLE programs; --");
    expect(q).not.toBeNull();
    const inspected = inspectSql(q!);
    // The dangerous payload must show up as a parameter, not as a literal segment.
    expect(inspected.params).toContain("australia'; DROP TABLE programs; --");
    expect(inspected.sql).not.toContain('DROP TABLE');
  });

  it('uses plainto_tsquery with the english dictionary', () => {
    const q = buildTsQuery('digital nomad');
    const inspected = inspectSql(q!);
    expect(inspected.sql).toContain("plainto_tsquery('english',");
  });
});

describe('buildSearchPredicate', () => {
  it('returns null when input is empty', () => {
    expect(buildSearchPredicate('')).toBeNull();
    expect(buildSearchPredicate('   ')).toBeNull();
  });

  it('builds the @@ predicate against programs.search_tsv', () => {
    const pred = buildSearchPredicate('australia');
    expect(pred).not.toBeNull();
    const inspected = inspectSql(pred!);
    expect(inspected.sql).toContain('programs.search_tsv @@');
  });

  it('parameterises the search term inside the predicate', () => {
    const pred = buildSearchPredicate('australia');
    const inspected = inspectSql(pred!);
    expect(inspected.params).toContain('australia');
  });
});

describe('buildSearchRank', () => {
  it('returns null when input is empty', () => {
    expect(buildSearchRank('')).toBeNull();
    expect(buildSearchRank('!!!')).toBeNull();
  });

  it('emits ts_rank against the search_tsv column', () => {
    const rank = buildSearchRank('australia');
    expect(rank).not.toBeNull();
    const inspected = inspectSql(rank!);
    expect(inspected.sql).toContain('ts_rank(programs.search_tsv,');
  });
});

describe('integration with Drizzle sql builder', () => {
  it('predicates and ranks compose with sql.join without throwing', () => {
    const pred = buildSearchPredicate('australia');
    const rank = buildSearchRank('australia');
    expect(() => sql.join([pred!, rank!], sql`,`)).not.toThrow();
  });
});
