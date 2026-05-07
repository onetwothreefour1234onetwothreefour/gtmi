// Methodology v6.0.0 / ADR-032 — deriveProgramAge tests.
//
// Replaces the v5 derive-e11-e13.test.ts. Under v6 only one derive
// remains (program age, written to E.1.1); the severity-weighted
// policy-change derive (deriveE11) was retired in favour of LLM
// extraction. The 20-year ceiling moved from the derive to the
// scoring engine, so the derive emits the raw uncapped year count.

import { describe, expect, it } from 'vitest';
import { DERIVE_CONFIDENCE, DERIVE_EXTRACTION_MODEL, deriveProgramAge } from '../index';

describe('deriveProgramAge — methodology v6.0.0 (ADR-032)', () => {
  it('happy path: 2026 - 2014 = 12 years, raw uncapped', () => {
    const r = deriveProgramAge({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '6.0.0',
      launchYear: 2014,
      currentYear: 2026,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('E.1.1');
    expect(r!.extraction.valueRaw).toBe('12');
    expect(r!.numericValue).toBe(12);
    expect(r!.extraction.extractionModel).toBe(DERIVE_EXTRACTION_MODEL);
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_CONFIDENCE);
  });

  it('emits the raw uncapped count when older than 20 (engine clamps at score time)', () => {
    const r = deriveProgramAge({
      programId: 'p1',
      countryIso: 'USA',
      methodologyVersion: '6.0.0',
      launchYear: 1990,
      currentYear: 2026,
    });
    expect(r).not.toBeNull();
    // Raw integer is 36; the scoring engine's min_max with params.max=20
    // clamps the score to 100, but the audit value is preserved here.
    expect(r!.numericValue).toBe(36);
    expect(r!.extraction.valueRaw).toBe('36');
  });

  it('returns 0 when launchYear == currentYear', () => {
    const r = deriveProgramAge({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '6.0.0',
      launchYear: 2026,
      currentYear: 2026,
    });
    expect(r!.numericValue).toBe(0);
  });

  it('returns null when launchYear is null', () => {
    expect(
      deriveProgramAge({
        programId: 'p1',
        countryIso: 'AUS',
        methodologyVersion: '6.0.0',
        launchYear: null,
        currentYear: 2026,
      })
    ).toBeNull();
  });

  it('returns null when launchYear is in the future', () => {
    expect(
      deriveProgramAge({
        programId: 'p1',
        countryIso: 'AUS',
        methodologyVersion: '6.0.0',
        launchYear: 2030,
        currentYear: 2026,
      })
    ).toBeNull();
  });

  it('uses sourceUrl override when provided', () => {
    const r = deriveProgramAge({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '6.0.0',
      launchYear: 2014,
      currentYear: 2026,
      sourceUrl: 'https://example.com/launch-announcement',
    });
    expect(r!.provenance.sourceUrl).toBe('https://example.com/launch-announcement');
  });

  it('falls back to urn sentinel sourceUrl when omitted', () => {
    const r = deriveProgramAge({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '6.0.0',
      launchYear: 2014,
      currentYear: 2026,
    });
    expect(r!.provenance.sourceUrl.startsWith('urn:gtmi:derived:')).toBe(true);
  });
});
