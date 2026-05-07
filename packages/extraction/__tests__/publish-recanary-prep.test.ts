import { describe, expect, it } from 'vitest';
import {
  buildCountrySubstituteProvenance,
  validateBooleanWithAnnotationShape,
} from '../src/stages/publish';
import { checkProvenanceRow } from '@gtmi/shared';

// Phase 3-recanary-prep — publish.ts pure-helper tests.
// Two paths exercised:
//   1. boolean_with_annotation shape validation
//   2. country-substitute synthetic provenance shape (must pass verify-provenance)

describe('validateBooleanWithAnnotationShape (dormant under v5.0.0)', () => {
  // D.1.3 / D.1.4 (last production users) retired in methodology v5.0.0
  // (ADR-031). Single sentinel test verifying the dormant validator
  // throws on any unknown key.
  it('throws when fieldKey is unknown (no Pillar D fields registered under v5.0.0)', () => {
    expect(() => validateBooleanWithAnnotationShape('D.1.3', { value: true })).toThrow(
      /no boolean key registered/
    );
    expect(() => validateBooleanWithAnnotationShape('X.0.0', { value: true })).toThrow(
      /no boolean key registered/
    );
  });
});

describe('buildCountrySubstituteProvenance', () => {
  const baseArgs = {
    fieldKey: 'C.3.2',
    countryIso: 'AUS',
    region: 'OECD_HIGH_INCOME',
    substitutedValue: 'automatic',
    methodologyVersion: '2.0.0',
  };

  it('produces a provenance object that passes verify-provenance.checkProvenanceRow on approved status', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    const issues = checkProvenanceRow(provenance, 'approved');
    expect(issues).toEqual([]);
  });

  it('sets sourceTier to null (Phase 3.5 nullable required key)', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    expect(provenance.sourceTier).toBeNull();
  });

  it('sets extractionModel and validationModel to country-substitute-regional', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    expect(provenance.extractionModel).toBe('country-substitute-regional');
    expect(provenance.validationModel).toBe('country-substitute-regional');
  });

  it('sets geographicLevel to "regional" per spec', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    expect(provenance.geographicLevel).toBe('regional');
  });

  it('confidence values are 1.0 (deterministic, not LLM-derived)', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    expect(provenance.extractionConfidence).toBe(1.0);
    expect(provenance.validationConfidence).toBe(1.0);
  });

  it('sets reviewedBy="auto", reviewDecision="approve" (auto-approved)', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    expect(provenance.reviewedBy).toBe('auto');
    expect(provenance.reviewDecision).toBe('approve');
    expect(provenance.reviewedAt).toBeInstanceOf(Date);
  });

  it('contentHash is a deterministic 64-char hex (sha256 of sentinel)', () => {
    const a = buildCountrySubstituteProvenance(baseArgs);
    const b = buildCountrySubstituteProvenance(baseArgs);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different inputs produce different contentHashes', () => {
    const a = buildCountrySubstituteProvenance(baseArgs);
    const b = buildCountrySubstituteProvenance({ ...baseArgs, countryIso: 'CAN' });
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('characterOffsets is a {start, end} object (not a tuple)', () => {
    const provenance = buildCountrySubstituteProvenance(baseArgs);
    expect(provenance.characterOffsets).toEqual({ start: 0, end: 0 });
  });

  it('GCC region produces a valid passing provenance for fee_paying value', () => {
    const provenance = buildCountrySubstituteProvenance({
      fieldKey: 'C.3.2',
      countryIso: 'UAE',
      region: 'GCC',
      substitutedValue: 'fee_paying',
      methodologyVersion: '2.0.0',
    });
    expect(checkProvenanceRow(provenance, 'approved')).toEqual([]);
  });
});

describe('verify-provenance accepts country-substitute synthetic rows', () => {
  it('passes with sourceTier=null when the row is otherwise complete + approved', () => {
    const provenance = buildCountrySubstituteProvenance({
      fieldKey: 'C.3.2',
      countryIso: 'AUS',
      region: 'OECD_HIGH_INCOME',
      substitutedValue: 'automatic',
      methodologyVersion: '2.0.0',
    });
    expect(checkProvenanceRow(provenance, 'approved')).toEqual([]);
    // Same row checked under pending_review status — should also pass (no extra keys required).
    expect(checkProvenanceRow(provenance, 'pending_review')).toEqual([]);
  });

  it('still rejects sourceTier=null when sourceTier is the only nullable key — sourceUrl=null still fails', () => {
    const provenance = buildCountrySubstituteProvenance({
      fieldKey: 'C.3.2',
      countryIso: 'AUS',
      region: 'OECD_HIGH_INCOME',
      substitutedValue: 'automatic',
      methodologyVersion: '2.0.0',
    });
    const broken = { ...provenance, sourceUrl: null };
    expect(checkProvenanceRow(broken, 'approved')).toContain('missing required key: sourceUrl');
  });

  it('still rejects undefined sourceTier (not the same as null)', () => {
    const provenance = buildCountrySubstituteProvenance({
      fieldKey: 'C.3.2',
      countryIso: 'AUS',
      region: 'OECD_HIGH_INCOME',
      substitutedValue: 'automatic',
      methodologyVersion: '2.0.0',
    });
    const broken = { ...provenance };
    delete (broken as Partial<typeof broken>).sourceTier;
    expect(checkProvenanceRow(broken, 'approved')).toContain('missing required key: sourceTier');
  });
});
