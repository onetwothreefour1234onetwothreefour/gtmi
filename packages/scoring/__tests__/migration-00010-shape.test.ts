import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHASE_3_5_INDICATOR_RESTRUCTURES } from '@gtmi/db';

// Phase 3.6 / migration 00010 — shape test.
//
// Asserts that the migration SQL string contains the four reconciliation
// updates plus the three ADR-013 amendments, and that the seed source-of-
// truth (`PHASE_3_5_INDICATOR_RESTRUCTURES`) agrees with the columns the
// migration writes. This catches drift between the migration and the seed
// without requiring a live DB connection.

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '00010_self_improving_sources_and_methodology_v2_reconciliation.sql'
);
const sql = readFileSync(MIGRATION_PATH, 'utf-8');

describe('migration 00010 — sources self-improving schema', () => {
  it('adds last_seen_at column', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ/);
  });

  it('adds discovered_by column with default seed', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "discovered_by" VARCHAR\(50\) DEFAULT 'seed'/);
  });

  it('adds geographic_level column', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "geographic_level" VARCHAR\(20\)/);
  });

  it('drops the old UNIQUE(url) constraint', () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS "sources_url_unique"/);
  });

  it('adds new UNIQUE(program_id, url) constraint', () => {
    expect(sql).toMatch(
      /ADD CONSTRAINT "sources_program_id_url_unique" UNIQUE \("program_id", "url"\)/
    );
  });
});

describe('migration 00010 — methodology v2 column reconciliation', () => {
  it("sets C.3.2 normalization_fn to 'country_substitute_regional'", () => {
    expect(sql).toMatch(
      /SET "normalization_fn" = 'country_substitute_regional',\s*"data_type"\s*=\s*'categorical'\s*WHERE "key" = 'C\.3\.2'/
    );
  });

  it("sets B.2.3, B.2.4, D.1.3, D.1.4 normalization_fn to 'boolean_with_annotation'", () => {
    expect(sql).toMatch(
      /SET "normalization_fn" = 'boolean_with_annotation',\s*"data_type"\s*=\s*'json'\s*WHERE "key" IN \('B\.2\.3', 'B\.2\.4', 'D\.1\.3', 'D\.1\.4'\)/
    );
  });

  it('seed source-of-truth agrees with the surviving boolean_with_annotation overrides', () => {
    // Methodology v3.0.0 (ADR-029) retired B.2.3 and B.2.4. The historical
    // SQL in migration 00010 is preserved as-is; only D.1.3 / D.1.4 remain
    // active in the seed.
    for (const key of ['D.1.3', 'D.1.4']) {
      const r = PHASE_3_5_INDICATOR_RESTRUCTURES[key];
      expect(r, `seed entry missing for ${key}`).toBeDefined();
      expect(r!.normalizationFn).toBe('boolean_with_annotation');
      expect(r!.dataType).toBe('json');
    }
    expect(PHASE_3_5_INDICATOR_RESTRUCTURES['B.2.3']).toBeUndefined();
    expect(PHASE_3_5_INDICATOR_RESTRUCTURES['B.2.4']).toBeUndefined();
  });

  it('seed source-of-truth agrees with C.3.2 country_substitute_regional override', () => {
    const r = PHASE_3_5_INDICATOR_RESTRUCTURES['C.3.2'];
    expect(r).toBeDefined();
    expect(r!.normalizationFn).toBe('country_substitute_regional');
    expect(r!.dataType).toBe('categorical');
  });
});

describe('migration 00010 — Tier 2 allowlist expansion (ADR-013 amendment)', () => {
  it('flips tier2_allowed=true for B.2.3, B.2.4, D.2.4 only (not C.2.1)', () => {
    expect(sql).toMatch(
      /SET "tier2_allowed" = true\s*WHERE "key" IN \('B\.2\.3', 'B\.2\.4', 'D\.2\.4'\)/
    );
    // Per analyst Q2 decision: C.2.1 must not be in this expansion.
    expect(sql).not.toMatch(/'C\.2\.1'/);
  });
});
