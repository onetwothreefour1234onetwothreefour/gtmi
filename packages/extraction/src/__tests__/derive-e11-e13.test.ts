// Phase 3.9 / W20 — E.1.3 (program age) + E.1.1 (severity-weighted
// policy-change count) derive tests.

import { describe, expect, it } from 'vitest';
import {
  DERIVE_CONFIDENCE,
  DERIVE_EXTRACTION_MODEL,
  DERIVE_KNOWLEDGE_CONFIDENCE,
  DERIVE_KNOWLEDGE_MODEL,
  PROGRAM_POLICY_HISTORY,
  deriveE11,
  deriveE13,
  type ProgramPolicyHistoryEntry,
} from '../index';

describe('deriveE13 — program age (Phase 3.9 / W20)', () => {
  it('happy path: 2026 - 2014 = 12 (under cap)', () => {
    const r = deriveE13({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      launchYear: 2014,
      currentYear: 2026,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('E.1.3');
    expect(r!.extraction.valueRaw).toBe('12');
    expect(r!.numericValue).toBe(12);
    expect(r!.extraction.extractionModel).toBe(DERIVE_EXTRACTION_MODEL);
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_CONFIDENCE);
  });

  it('caps at 20 when raw years > 20', () => {
    const r = deriveE13({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      launchYear: 1990,
      currentYear: 2026,
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBe(20);
    expect(r!.extraction.valueRaw).toBe('20');
  });

  it('returns 0 when launchYear == currentYear', () => {
    const r = deriveE13({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      launchYear: 2026,
      currentYear: 2026,
    });
    expect(r!.numericValue).toBe(0);
  });

  it('returns null when launchYear is null', () => {
    expect(
      deriveE13({
        programId: 'p1',
        countryIso: 'AUS',
        methodologyVersion: '1.0.0',
        launchYear: null,
        currentYear: 2026,
      })
    ).toBeNull();
  });

  it('returns null when launchYear is in the future', () => {
    expect(
      deriveE13({
        programId: 'p1',
        countryIso: 'AUS',
        methodologyVersion: '1.0.0',
        launchYear: 2030,
        currentYear: 2026,
      })
    ).toBeNull();
  });

  it('uses sourceUrl override when provided', () => {
    const r = deriveE13({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      launchYear: 2014,
      currentYear: 2026,
      sourceUrl: 'https://example.com/launch-announcement',
    });
    expect(r!.provenance.sourceUrl).toBe('https://example.com/launch-announcement');
  });

  it('falls back to urn sentinel sourceUrl when omitted', () => {
    const r = deriveE13({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      launchYear: 2014,
      currentYear: 2026,
    });
    expect(r!.provenance.sourceUrl.startsWith('urn:gtmi:derived:')).toBe(true);
  });
});

const SAMPLE_HISTORY: ProgramPolicyHistoryEntry = {
  programId: 'p1',
  programName: 'Sample Visa',
  windowStartYear: 2021,
  windowEndYear: 2026,
  events: [
    {
      year: 2024,
      severity: 'major',
      description: 'Eligibility criteria reformed.',
    },
    {
      year: 2023,
      severity: 'moderate',
      description: 'Quota expanded.',
    },
    {
      year: 2022,
      severity: 'minor',
      description: 'Form renumbered.',
    },
  ],
  sourceUrl: 'https://example.com/changelog',
};

describe('deriveE11 — severity-weighted policy-change count (Phase 3.9 / W20)', () => {
  it('happy path: severity sum 3+2+1 = 6', () => {
    const r = deriveE11({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      history: SAMPLE_HISTORY,
    });
    expect(r).not.toBeNull();
    expect(r!.extraction.fieldDefinitionKey).toBe('E.1.1');
    expect(r!.extraction.valueRaw).toBe('6');
    expect(r!.numericValue).toBe(6);
    expect(r!.extraction.extractionModel).toBe(DERIVE_KNOWLEDGE_MODEL);
    expect(r!.extraction.extractionConfidence).toBe(DERIVE_KNOWLEDGE_CONFIDENCE);
  });

  it('returns 0 when events array is empty', () => {
    const r = deriveE11({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      history: { ...SAMPLE_HISTORY, events: [] },
    });
    expect(r).not.toBeNull();
    expect(r!.numericValue).toBe(0);
    expect(r!.extraction.valueRaw).toBe('0');
  });

  it('returns null when history is null (LLM extraction will run)', () => {
    expect(
      deriveE11({
        programId: 'p1',
        countryIso: 'AUS',
        methodologyVersion: '1.0.0',
        history: null,
      })
    ).toBeNull();
  });

  it('confidence forces /review (below 0.85 auto-approve threshold)', () => {
    const r = deriveE11({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      history: SAMPLE_HISTORY,
    });
    expect(r!.provenance.extractionConfidence).toBeLessThan(0.85);
  });

  it('derivedInputs preserves the full event list for /review audit', () => {
    const r = deriveE11({
      programId: 'p1',
      countryIso: 'AUS',
      methodologyVersion: '1.0.0',
      history: SAMPLE_HISTORY,
    });
    const provenance = r!.provenance as { derivedInputs?: { 'E.1.1'?: { events?: unknown[] } } };
    expect(provenance.derivedInputs?.['E.1.1']?.events).toHaveLength(3);
  });
});

describe('PROGRAM_POLICY_HISTORY registry sanity', () => {
  it('every entry has events with valid severity buckets', () => {
    const allowed = new Set(['major', 'moderate', 'minor']);
    for (const [pid, h] of Object.entries(PROGRAM_POLICY_HISTORY)) {
      for (const e of h.events) {
        expect(allowed.has(e.severity), `${pid} event severity=${e.severity}`).toBe(true);
      }
    }
  });

  it('every entry has a windowEndYear >= windowStartYear', () => {
    for (const [pid, h] of Object.entries(PROGRAM_POLICY_HISTORY)) {
      expect(h.windowEndYear, `${pid}`).toBeGreaterThanOrEqual(h.windowStartYear);
    }
  });

  it('every event year is within the entry window', () => {
    for (const [pid, h] of Object.entries(PROGRAM_POLICY_HISTORY)) {
      for (const e of h.events) {
        expect(e.year, `${pid} event year=${e.year}`).toBeGreaterThanOrEqual(h.windowStartYear);
        expect(e.year, `${pid} event year=${e.year}`).toBeLessThanOrEqual(h.windowEndYear);
      }
    }
  });
});
