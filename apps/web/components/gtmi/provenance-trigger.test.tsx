import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProvenanceTrigger } from './provenance-trigger';
import { readProvenance, type Provenance } from '@/lib/provenance';

const COMPLETE_PROVENANCE: Provenance = {
  sourceUrl: 'https://immi.homeaffairs.gov.au/visas/skills-in-demand-482',
  geographicLevel: 'national',
  sourceTier: 1,
  scrapedAt: '2026-04-21T10:00:00.000Z',
  contentHash: 'abc123def456789012345678',
  sourceSentence: 'The minimum salary for the Core Skills Stream is AUD 73,150 per year.',
  charOffsets: [42, 53],
  extractionModel: 'claude-sonnet-4-6',
  extractionConfidence: 0.92,
  validationModel: 'claude-sonnet-4-6',
  validationConfidence: 0.88,
  crossCheckResult: 'agrees',
  methodologyVersion: '1.0.0',
};

const APPROVED_PROVENANCE: Provenance = {
  ...COMPLETE_PROVENANCE,
  reviewer: 'reviewer-uuid-123',
  reviewedAt: '2026-04-22T14:00:00.000Z',
  reviewerNotes: '',
};

describe('readProvenance — defensive read against ADR-007 schema', () => {
  it('flags every required key when raw is null', () => {
    const result = readProvenance(null, 'pending_review');
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(13);
    expect(result.missing).toContain('sourceUrl');
    expect(result.missing).toContain('charOffsets');
    expect(result.missing).toContain('methodologyVersion');
  });

  it('flags every required key when raw is not an object', () => {
    const result = readProvenance('not-an-object', 'pending_review');
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(13);
  });

  it('returns ok=true when all 13 core keys present on a non-approved row', () => {
    const result = readProvenance(COMPLETE_PROVENANCE, 'pending_review');
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('does NOT require reviewer/reviewedAt/reviewerNotes on a pending row', () => {
    const result = readProvenance(COMPLETE_PROVENANCE, 'pending_review');
    expect(result.ok).toBe(true);
  });

  it('requires reviewer/reviewedAt/reviewerNotes on an approved row', () => {
    const result = readProvenance(COMPLETE_PROVENANCE, 'approved');
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['reviewer', 'reviewedAt', 'reviewerNotes'])
    );
  });

  it('passes when all 13+3 keys are present on an approved row', () => {
    const result = readProvenance(APPROVED_PROVENANCE, 'approved');
    expect(result.ok).toBe(true);
  });

  it('flags missing required keys individually', () => {
    const partial = { ...COMPLETE_PROVENANCE };
    delete (partial as Partial<Provenance>).extractionModel;
    delete (partial as Partial<Provenance>).validationConfidence;
    const result = readProvenance(partial, 'pending_review');
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['extractionModel', 'validationConfidence'])
    );
    expect(result.missing).not.toContain('sourceUrl');
  });

  it('flags charOffsets that is not a 2-tuple of numbers', () => {
    const malformed = {
      ...COMPLETE_PROVENANCE,
      charOffsets: ['a', 'b'] as unknown as [number, number],
    };
    const result = readProvenance(malformed, 'pending_review');
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('charOffsets');
  });
});

describe('ProvenanceTrigger', () => {
  it('renders the "Provenance incomplete" error chip when required keys are missing', () => {
    const partial = { ...COMPLETE_PROVENANCE } as Partial<Provenance>;
    delete partial.contentHash;
    render(
      <ProvenanceTrigger provenance={partial} status="pending_review" valueRaw="AUD 73,150" />
    );

    const chip = screen.getByTestId('provenance-incomplete');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('role', 'alert');
    expect(chip).toHaveTextContent('Provenance incomplete');
    expect(chip.title).toContain('contentHash');
  });

  it('renders the "Provenance incomplete" error chip when raw is null', () => {
    render(<ProvenanceTrigger provenance={null} status="approved" valueRaw="AUD 73,150" />);
    expect(screen.getByTestId('provenance-incomplete')).toBeInTheDocument();
  });

  it('renders the trigger button when all required keys are present', () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        valueRaw="AUD 73,150"
      />
    );
    expect(screen.getByTestId('provenance-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('provenance-incomplete')).not.toBeInTheDocument();
  });

  it('renders the trigger when an approved row has all 13+3 keys', () => {
    render(
      <ProvenanceTrigger provenance={APPROVED_PROVENANCE} status="approved" valueRaw="AUD 73,150" />
    );
    expect(screen.getByTestId('provenance-trigger')).toBeInTheDocument();
  });

  it('downgrades an approved row that lacks reviewer keys to incomplete', () => {
    // Pipeline contract: an approved row without reviewer keys is malformed
    // and verify-provenance.ts would have failed — UI must surface the same
    // posture rather than silently swallow it.
    render(
      <ProvenanceTrigger provenance={COMPLETE_PROVENANCE} status="approved" valueRaw="AUD 73,150" />
    );
    expect(screen.getByTestId('provenance-incomplete')).toBeInTheDocument();
  });

  it('valueCurrency is read defensively (not required, no error when absent)', () => {
    const noCurrency = { ...COMPLETE_PROVENANCE };
    expect(noCurrency.valueCurrency).toBeUndefined();
    const result = readProvenance(noCurrency, 'pending_review');
    expect(result.ok).toBe(true);
    expect(result.missing).not.toContain('valueCurrency');
  });

  it('valueCurrency surfaces when present (read path returns it)', () => {
    const withCurrency = { ...COMPLETE_PROVENANCE, valueCurrency: 'AUD' };
    const result = readProvenance(withCurrency, 'pending_review');
    expect(result.ok).toBe(true);
    expect((result.provenance as Provenance).valueCurrency).toBe('AUD');
  });
});
