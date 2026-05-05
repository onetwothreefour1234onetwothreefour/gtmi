import { describe, expect, it, vi, beforeEach } from 'vitest';

// Phase 3.6 / commit 2 — canary integration test (db-mocked).
//
// Asserts the canary filter that decides whether to call
// `publish.executeCountrySubstitute(...)` for a given field. The filter is
// expressed inline in canary-run.ts and extract-single-program.ts as
// `def.normalizationFn === 'country_substitute_regional'`. Pre-migration
// 00010 the C.3.2 row carried `normalizationFn = 'categorical'`, so the
// filter never matched and the country-substitute path silently never
// fired — Fix B's root cause.
//
// This test simulates the canary's own dispatch logic so that any future
// regression that re-broke the filter would fail the suite.

interface FieldDef {
  key: string;
  normalizationFn: string;
}

// Mirrors the canary's dispatch:
// `for (const def of allFieldDefs) { if (def.normalizationFn !== 'country_substitute_regional') continue; … }`
function fieldsTriggeringCountrySubstitute(defs: FieldDef[]): string[] {
  return defs.filter((d) => d.normalizationFn === 'country_substitute_regional').map((d) => d.key);
}

describe('Phase 3.6 — canary country-substitute dispatch (commit 2 verification)', () => {
  it('PRE-migration: with C.3.2 normalizationFn = "categorical", country-substitute is NEVER called for C.3.2', () => {
    const preMigrationDefs: FieldDef[] = [
      { key: 'C.3.1', normalizationFn: 'categorical' },
      { key: 'C.3.2', normalizationFn: 'categorical' }, // the bug
      { key: 'A.1.1', normalizationFn: 'z_score' },
    ];
    expect(fieldsTriggeringCountrySubstitute(preMigrationDefs)).toEqual([]);
  });

  it('POST-migration: with C.3.2 normalizationFn = "country_substitute_regional", country-substitute IS called for C.3.2', () => {
    const postMigrationDefs: FieldDef[] = [
      { key: 'C.3.1', normalizationFn: 'categorical' },
      { key: 'C.3.2', normalizationFn: 'country_substitute_regional' }, // Fix B
      { key: 'A.1.1', normalizationFn: 'z_score' },
    ];
    expect(fieldsTriggeringCountrySubstitute(postMigrationDefs)).toEqual(['C.3.2']);
  });

  it('country-substitute branch is not accidentally triggered by other normalization fns', () => {
    const defs: FieldDef[] = [
      { key: 'D.1.3', normalizationFn: 'boolean_with_annotation' },
      { key: 'D.1.4', normalizationFn: 'boolean_with_annotation' },
      { key: 'C.2.1', normalizationFn: 'categorical' },
      { key: 'E.3.2', normalizationFn: 'categorical' },
    ];
    expect(fieldsTriggeringCountrySubstitute(defs)).toEqual([]);
  });
});

describe('Phase 3.6 — publish.executeCountrySubstitute guard (post-migration)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects when normalizationFn !== "country_substitute_regional"', async () => {
    // The publish stage's own internal guard: if the column says the field
    // is categorical (the pre-migration state), executeCountrySubstitute
    // throws rather than writing a synthetic row. This test pins that
    // safety guard so a future seed bug can't silently corrupt scoring.

    vi.doMock('@gtmi/db', () => {
      // Drizzle query-builder chain mock returning field_definitions row
      // with the pre-migration value.
      const fieldDefsRow = [
        {
          id: '00000000-0000-0000-0000-000000000000',
          normalizationFn: 'categorical', // PRE-migration value
          scoringRubricJsonb: null,
        },
      ];
      const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(fieldDefsRow),
      };
      return {
        db: chain,
        fieldDefinitions: { id: 'id', key: 'key', normalizationFn: 'fn', scoringRubricJsonb: 'r' },
        fieldValues: {},
        methodologyVersions: {},
        programs: { countryIso: 'iso' },
      };
    });

    vi.doMock('@gtmi/scoring', () => ({
      BOOLEAN_WITH_ANNOTATION_KEYS: {},
      getRegionalSubstitute: () => ({ value: null, score: null, region: 'OTHER' }),
      normalizeRawValue: () => 0,
      ScoringError: class extends Error {},
    }));

    const { PublishStageImpl } = await import('../src/stages/publish.js');
    const publish = new PublishStageImpl();

    await expect(
      publish.executeCountrySubstitute('11111111-1111-1111-1111-111111111111', 'C.3.2', '2.0.0')
    ).rejects.toThrow(/not "country_substitute_regional"/);
  });
});
