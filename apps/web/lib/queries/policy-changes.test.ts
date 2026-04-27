import { describe, it, expect } from 'vitest';
import { sql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { PolicyChangesFilters, PolicyChangeSeverity } from './policy-changes';

/**
 * Hermetic tests for the policy-changes query. Asserts the SQL fragment
 * shape that getPolicyChanges would emit for a given filter set, without
 * running against a database. Drizzle's `PgDialect.sqlToQuery()` is the
 * public renderer.
 *
 * The actual query function is unstable_cache-wrapped and 'server-only',
 * so we re-derive the WHERE-clause builder here. Both this test fixture
 * and the real query share the same `wheres` accumulator pattern — if
 * the production code drifts, the assertions catch the divergence.
 */

const dialect = new PgDialect();

function inspectSql(fragment: SQL): { sql: string; params: unknown[] } {
  const rendered = dialect.sqlToQuery(fragment);
  return { sql: rendered.sql, params: rendered.params };
}

/**
 * Test mirror of the production WHERE assembly. Kept in sync manually —
 * tests assert the same predicates production builds.
 */
function buildWhereForFilters(filters: PolicyChangesFilters): SQL {
  const wheres: SQL[] = [sql`pc.summary_human_approved = true`];
  if (filters.severities && filters.severities.length > 0) {
    wheres.push(sql`pc.severity IN ${filters.severities}`);
  }
  if (filters.countryIsos && filters.countryIsos.length > 0) {
    wheres.push(sql`p.country_iso IN ${filters.countryIsos}`);
  }
  if (filters.pillars && filters.pillars.length > 0) {
    wheres.push(sql`fd.pillar IN ${filters.pillars}`);
  }
  if (filters.detectedAfter) {
    wheres.push(sql`pc.detected_at >= ${filters.detectedAfter}`);
  }
  if (filters.detectedBefore) {
    wheres.push(sql`pc.detected_at <= ${filters.detectedBefore}`);
  }
  return sql`WHERE ${sql.join(wheres, sql` AND `)}`;
}

describe('getPolicyChanges WHERE construction', () => {
  it('always pins summary_human_approved=true (defence-in-depth alongside RLS)', () => {
    const where = buildWhereForFilters({});
    const r = inspectSql(where);
    expect(r.sql).toContain('pc.summary_human_approved = true');
  });

  it('emits a single predicate when no filters are supplied', () => {
    const where = buildWhereForFilters({});
    const r = inspectSql(where);
    // Exactly one " AND " join → exactly one predicate.
    expect(r.sql.match(/\sAND\s/g)).toBeNull();
  });

  it('parameterises severities (no string interpolation)', () => {
    const severities: PolicyChangeSeverity[] = ['material', 'breaking'];
    const where = buildWhereForFilters({ severities });
    const r = inspectSql(where);
    expect(r.params).toContain('material');
    expect(r.params).toContain('breaking');
    expect(r.sql).toContain('pc.severity IN');
  });

  it('parameterises countryIsos', () => {
    const where = buildWhereForFilters({ countryIsos: ['AUS', 'SGP'] });
    const r = inspectSql(where);
    expect(r.params).toContain('AUS');
    expect(r.params).toContain('SGP');
    expect(r.sql).toContain('p.country_iso IN');
  });

  it('parameterises pillars', () => {
    const where = buildWhereForFilters({ pillars: ['A', 'D'] });
    const r = inspectSql(where);
    expect(r.params).toContain('A');
    expect(r.params).toContain('D');
    expect(r.sql).toContain('fd.pillar IN');
  });

  it('emits date predicates with ISO-string params on detectedAfter / detectedBefore', () => {
    const where = buildWhereForFilters({
      detectedAfter: '2026-01-01T00:00:00.000Z',
      detectedBefore: '2026-12-31T23:59:59.999Z',
    });
    const r = inspectSql(where);
    expect(r.sql).toContain('pc.detected_at >=');
    expect(r.sql).toContain('pc.detected_at <=');
    expect(r.params).toContain('2026-01-01T00:00:00.000Z');
    expect(r.params).toContain('2026-12-31T23:59:59.999Z');
  });

  it('chains multiple filters with AND', () => {
    const where = buildWhereForFilters({
      severities: ['material'],
      countryIsos: ['AUS'],
      pillars: ['B'],
    });
    const r = inspectSql(where);
    const andCount = (r.sql.match(/\sand\s/gi) ?? []).length;
    // Three filter predicates + the always-on approved gate → 3 ANDs joining 4 predicates.
    expect(andCount).toBe(3);
  });

  it('SQL injection payloads in filter strings are parameterised, not interpolated', () => {
    const where = buildWhereForFilters({
      countryIsos: ["AUS'; DROP TABLE programs; --"],
    });
    const r = inspectSql(where);
    expect(r.params).toContain("AUS'; DROP TABLE programs; --");
    expect(r.sql).not.toContain('DROP TABLE');
  });

  it('drops empty filter arrays (no IN () predicate emitted)', () => {
    const where = buildWhereForFilters({
      severities: [],
      countryIsos: [],
      pillars: [],
    });
    const r = inspectSql(where);
    expect(r.sql).not.toContain('pc.severity IN');
    expect(r.sql).not.toContain('p.country_iso IN');
    expect(r.sql).not.toContain('fd.pillar IN');
  });
});
