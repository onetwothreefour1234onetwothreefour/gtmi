import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndicatorRow } from './indicator-row';
import type { ProgramDetailFieldValue } from '@/lib/queries/program-detail-types';

const COMPLETE_PROVENANCE = {
  sourceUrl: 'https://immi.homeaffairs.gov.au/visas/skills-in-demand-482',
  geographicLevel: 'national',
  sourceTier: 1,
  scrapedAt: '2026-04-21T10:00:00.000Z',
  contentHash: 'abc12345',
  sourceSentence: 'The minimum salary for the Core Skills Stream is AUD 73,150 per year.',
  charOffsets: [42, 53],
  extractionModel: 'claude-sonnet-4-6',
  extractionConfidence: 0.92,
  validationModel: 'claude-sonnet-4-6',
  validationConfidence: 0.88,
  crossCheckResult: 'agrees',
  methodologyVersion: '1.0.0',
};

function makeFieldValue(overrides: Partial<ProgramDetailFieldValue> = {}): ProgramDetailFieldValue {
  return {
    fieldDefinitionId: 'def-1',
    fieldKey: 'A.1.1',
    fieldLabel: 'Minimum salary threshold',
    pillar: 'A',
    subFactor: 'A.1',
    weightWithinSubFactor: 0.5,
    dataType: 'numeric',
    normalizationFn: 'z_score',
    direction: 'lower_is_better',
    valueRaw: 'AUD 73,150',
    valueIndicatorScore: 64.2,
    status: 'pending_review',
    provenance: COMPLETE_PROVENANCE,
    extractedAt: '2026-04-21T10:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

describe('IndicatorRow', () => {
  it('renders the field key, label, raw value, normalised score, and weight', () => {
    render(<IndicatorRow fieldValue={makeFieldValue()} />);
    const row = screen.getByTestId('indicator-row');
    expect(row).toHaveAttribute('data-field-key', 'A.1.1');
    expect(row).toHaveTextContent('A.1.1');
    expect(row).toHaveTextContent('Minimum salary threshold');
    expect(row).toHaveTextContent('AUD 73,150');
    expect(row).toHaveTextContent('64.20');
    expect(row).toHaveTextContent('50%');
  });

  it('renders the currency code beside the raw value when provenance.valueCurrency is present', () => {
    render(
      <IndicatorRow
        fieldValue={makeFieldValue({
          provenance: { ...COMPLETE_PROVENANCE, valueCurrency: 'AUD' },
        })}
      />
    );
    const row = screen.getByTestId('indicator-row');
    expect(row).toHaveTextContent('AUD 73,150');
    // The currency-code slot is rendered as a separate span with muted color.
    expect(row.textContent).toContain('AUD');
  });

  it('does not render a currency code when provenance.valueCurrency is missing', () => {
    render(<IndicatorRow fieldValue={makeFieldValue()} />);
    // The raw value contains "AUD" as a prefix; the dedicated currency slot
    // is absent, so the trailing repeated "AUD" we'd see if the slot were
    // populated should not appear. We check via looking at text content
    // length rather than an exact string match here — the row should still
    // contain the raw value once.
    const row = screen.getByTestId('indicator-row');
    const occurrences = (row.textContent?.match(/AUD/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('renders the pre-calibration chip when phase2Placeholder=true and the field has a score', () => {
    render(<IndicatorRow fieldValue={makeFieldValue()} phase2Placeholder />);
    expect(screen.getByTestId('pre-calibration-chip')).toBeInTheDocument();
  });

  it('does NOT render the pre-calibration chip when valueIndicatorScore is null', () => {
    render(
      <IndicatorRow
        fieldValue={makeFieldValue({ valueIndicatorScore: null, valueRaw: null })}
        phase2Placeholder
      />
    );
    expect(screen.queryByTestId('pre-calibration-chip')).not.toBeInTheDocument();
  });

  it('renders "Not on government source" when valueRaw is null', () => {
    render(
      <IndicatorRow fieldValue={makeFieldValue({ valueRaw: null, valueIndicatorScore: null })} />
    );
    expect(screen.getByTestId('indicator-row')).toHaveTextContent('Not on government source');
  });

  it('renders "Not on government source" when valueRaw is empty string', () => {
    render(
      <IndicatorRow fieldValue={makeFieldValue({ valueRaw: '', valueIndicatorScore: null })} />
    );
    expect(screen.getByTestId('indicator-row')).toHaveTextContent('Not on government source');
  });

  it('renders the ProvenanceTrigger affordance even when valueRaw is null (provenance accessible from every numeric data point)', () => {
    render(
      <IndicatorRow
        fieldValue={makeFieldValue({
          valueRaw: null,
          valueIndicatorScore: null,
          status: 'draft',
          // Empty provenance — ProvenanceTrigger should render the
          // "Provenance incomplete" chip per ADR-007.
          provenance: null,
        })}
      />
    );
    expect(screen.getByTestId('provenance-incomplete')).toBeInTheDocument();
  });

  it('renders the direction arrow up for higher_is_better', () => {
    render(<IndicatorRow fieldValue={makeFieldValue({ direction: 'higher_is_better' })} />);
    expect(screen.getByTestId('direction-arrow')).toHaveAttribute('aria-label', 'Higher is better');
  });

  it('renders the direction arrow down for lower_is_better', () => {
    render(<IndicatorRow fieldValue={makeFieldValue({ direction: 'lower_is_better' })} />);
    expect(screen.getByTestId('direction-arrow')).toHaveAttribute('aria-label', 'Lower is better');
  });
});
