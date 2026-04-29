// Phase 3.6.4 / FIX 2 — D.1.2 (years to PR) derive tests + cohort
// completeness assertion against COUNTRY_PR_PRESENCE_POLICY.

import { describe, expect, it } from 'vitest';
import {
  COUNTRY_PR_PRESENCE_POLICY,
  COUNTRY_PR_TIMELINE,
  DERIVE_KNOWLEDGE_CONFIDENCE,
  DERIVE_KNOWLEDGE_MODEL,
  deriveD12,
  deriveD22,
  COUNTRY_CITIZENSHIP_RESIDENCE_YEARS,
  type PrTimelinePolicyEntry,
} from '../index';

const AUS_TIMELINE: PrTimelinePolicyEntry = {
  iso3: 'AUS',
  d12MinYearsToPr: 2,
  notes: '482 → 186 TRT, 2 yrs continuous sponsored employment.',
  sourceUrl:
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186/temporary-residence-transition-stream',
  sourceYear: 2024,
};

const ARE_TIMELINE: PrTimelinePolicyEntry = {
  iso3: 'ARE',
  d12MinYearsToPr: null,
  notes: 'No conventional PR pathway.',
  sourceUrl: 'https://u.ae/...',
  sourceYear: 2024,
};

describe('deriveD12 — Phase 3.6.4 / FIX 2', () => {
  it('AUS happy path: returns numericValue 2, derived-knowledge model', () => {
    const r = deriveD12({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_TIMELINE,
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBe(2);
    expect(r!.extraction.fieldDefinitionKey).toBe('D.1.2');
    expect(r!.extraction.valueRaw).toBe('2');
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_KNOWLEDGE_CONFIDENCE);
    expect(r!.provenance.sourceTier).toBeNull();
    expect(r!.provenance.sourceUrl).toBe(AUS_TIMELINE.sourceUrl);
  });

  it('returns null when no policy entry exists for the country', () => {
    expect(
      deriveD12({
        programId: 'p1',
        countryIso: 'XYZ',
        methodologyVersion: '1.0.0',
        policy: null,
      })
    ).toBeNull();
  });

  it('returns null when d12MinYearsToPr is null (GCC: no PR pathway)', () => {
    expect(
      deriveD12({
        programId: 'p1',
        countryIso: 'ARE',
        methodologyVersion: '1.0.0',
        policy: ARE_TIMELINE,
      })
    ).toBeNull();
  });

  it('confidence forces /review (below 0.85 auto-approve threshold)', () => {
    const r = deriveD12({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_TIMELINE,
    });
    expect(r!.provenance.extractionConfidence).toBeLessThan(0.85);
  });

  it('derivedInputs JSONB extension carries the years and source', () => {
    const r = deriveD12({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_TIMELINE,
    });
    const inputs = (
      r!.provenance as unknown as {
        derivedInputs: Record<string, unknown>;
      }
    ).derivedInputs;
    const d12Inputs = inputs['D.1.2'] as Record<string, unknown>;
    expect(d12Inputs['years']).toBe(2);
    expect(d12Inputs['sourceUrl']).toBe(AUS_TIMELINE.sourceUrl);
  });
});

describe('Cohort completeness — COUNTRY_PR_TIMELINE matches PR_PRESENCE_POLICY', () => {
  it('every cohort country in COUNTRY_PR_PRESENCE_POLICY has a COUNTRY_PR_TIMELINE entry', () => {
    const presenceKeys = Object.keys(COUNTRY_PR_PRESENCE_POLICY).sort();
    const timelineKeys = Object.keys(COUNTRY_PR_TIMELINE).sort();
    const missing = presenceKeys.filter((k) => !timelineKeys.includes(k));
    expect(
      missing,
      `These cohort countries are missing from COUNTRY_PR_TIMELINE: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('cohort size is at least 30', () => {
    expect(Object.keys(COUNTRY_PR_TIMELINE).length).toBeGreaterThanOrEqual(30);
  });

  it('GCC monarchies are mapped to null (no PR pathway)', () => {
    for (const iso of ['ARE', 'SAU', 'BHR', 'OMN']) {
      const entry = COUNTRY_PR_TIMELINE[iso];
      expect(entry, `country ${iso}`).toBeDefined();
      expect(entry!.d12MinYearsToPr, `country ${iso}`).toBeNull();
    }
  });

  it('all numeric d12MinYearsToPr values are positive integers ≤ 15', () => {
    for (const [iso, entry] of Object.entries(COUNTRY_PR_TIMELINE)) {
      if (entry.d12MinYearsToPr === null) continue;
      expect(entry.d12MinYearsToPr, `country ${iso}`).toBeGreaterThan(0);
      expect(entry.d12MinYearsToPr, `country ${iso}`).toBeLessThanOrEqual(15);
      expect(Number.isInteger(entry.d12MinYearsToPr), `country ${iso}`).toBe(true);
    }
  });
});

describe('D.2.2 now computes when D.1.2 is derived', () => {
  it('AUS derive chain: deriveD12 → 2; deriveD22(d12=2, AUS yearsAsPr=4) → 6', () => {
    const d12 = deriveD12({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      policy: AUS_TIMELINE,
    });
    expect(d12).not.toBeNull();
    const ausCitizenship = COUNTRY_CITIZENSHIP_RESIDENCE_YEARS['AUS'];
    expect(ausCitizenship).toBeDefined();
    const d22 = deriveD22({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      d11Boolean: true,
      d12Years: d12!.numericValue,
      d12SourceUrl: AUS_TIMELINE.sourceUrl,
      citizenshipResidence: ausCitizenship!,
    });
    expect(d22).not.toBeNull();
    // 2 (D.1.2) + 4 (AUS yearsAsPr) = 6
    expect(d22!.numericValue).toBe(2 + (ausCitizenship!.yearsAsPr ?? 0));
  });
});
