import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgramHeader } from './program-header';
import { PillarStrip } from './pillar-strip';
import { PillarBreakdown } from './pillar-breakdown';
import type { ProgramDetailFieldValue } from '@/lib/queries/program-detail-types';
import type { Provenance } from '@/lib/provenance';
import type { PillarKey } from '@/lib/theme';

const PROVENANCE: Provenance = {
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

function mkFieldValue(
  pillar: PillarKey,
  key: string,
  subFactor: string,
  label: string,
  overrides: Partial<ProgramDetailFieldValue> = {}
): ProgramDetailFieldValue {
  return {
    fieldDefinitionId: `def-${key}`,
    fieldKey: key,
    fieldLabel: label,
    pillar,
    subFactor,
    weightWithinSubFactor: 0.5,
    dataType: 'numeric',
    normalizationFn: 'min_max',
    direction: 'higher_is_better',
    valueRaw: 'AUD 73,150',
    valueIndicatorScore: 64.2,
    status: 'pending_review',
    provenance: PROVENANCE,
    extractedAt: '2026-04-21T10:00:00.000Z',
    reviewedAt: null,
    ...overrides,
  };
}

const PILLAR_SCORES = { A: 18.4, B: 12.1, C: 16.8, D: 10.3, E: 14.6 };
const COHORT_MEDIAN = { A: 21, B: 15.5, C: 16.5, D: 11.5, E: 15 };

describe('ProgramHeader', () => {
  function renderHeader(overrides: Partial<React.ComponentProps<typeof ProgramHeader>> = {}) {
    return render(
      <ProgramHeader
        countryIso="AUS"
        countryName="Australia"
        programName="Skills in Demand 482 — Core"
        programCategory="Skilled Worker"
        programStatus="active"
        programDescriptionMd="A short-term residence permit issued under the SID 482 visa for skilled workers in nominated occupations."
        composite={16.36}
        cme={22.53}
        paq={13.72}
        rank={1}
        scoredCount={2}
        fieldsPopulated={30}
        fieldsTotal={48}
        phase2Placeholder={true}
        {...overrides}
      />
    );
  }

  it('renders the breadcrumb, eyebrow, programme name in serif, and description', () => {
    renderHeader();
    const header = screen.getByTestId('program-header');
    expect(header).toHaveTextContent('Programmes');
    expect(header).toHaveTextContent('Australia');
    expect(header).toHaveTextContent('Skilled Worker');
    expect(screen.getByTestId('program-name')).toHaveTextContent('Skills in Demand 482 — Core');
    expect(header).toHaveTextContent('A short-term residence permit');
  });

  it('renders the pre-calibration chip when phase2Placeholder=true and the programme is scored', () => {
    renderHeader();
    expect(screen.getByTestId('pre-calibration-chip')).toBeInTheDocument();
  });

  it('does NOT render the pre-calibration chip when phase2Placeholder=false', () => {
    renderHeader({ phase2Placeholder: false });
    expect(screen.queryByTestId('pre-calibration-chip')).not.toBeInTheDocument();
  });

  it('does NOT render the pre-calibration chip when the programme is unscored', () => {
    renderHeader({ composite: null, cme: null, paq: null, fieldsPopulated: 0 });
    expect(screen.queryByTestId('pre-calibration-chip')).not.toBeInTheDocument();
  });

  it('renders the coverage chip with populated/total math when scored', () => {
    renderHeader();
    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveAttribute('title', '30/48 fields populated');
    // Default percent format = 30/48 → 63%.
    expect(chip).toHaveTextContent('63%');
  });

  it('hides the coverage chip when the programme is unscored', () => {
    renderHeader({ composite: null, cme: null, paq: null, fieldsPopulated: 0 });
    expect(screen.queryByTestId('coverage-chip')).not.toBeInTheDocument();
  });

  it('shows the composite score plate (Phase A CompositeScoreDisplay)', () => {
    renderHeader();
    const plate = screen.getByTestId('composite-score-display');
    expect(plate).toHaveTextContent('16.36');
    expect(plate).toHaveTextContent('22.53'); // CME
    expect(plate).toHaveTextContent('13.72'); // PAQ
  });
});

describe('PillarStrip', () => {
  it('renders all five pillar cells with scores and indicator counts', () => {
    render(
      <PillarStrip
        pillarScores={PILLAR_SCORES}
        indicatorCounts={{ A: 9, B: 10, C: 10, D: 11, E: 8 }}
      />
    );
    for (const p of ['A', 'B', 'C', 'D', 'E'] as const) {
      const cell = screen.getByTestId(`pillar-strip-cell-${p}`);
      expect(cell).toBeInTheDocument();
    }
    expect(screen.getByTestId('pillar-strip-score-A')).toHaveTextContent('18.40');
    expect(screen.getByTestId('pillar-strip-cell-D')).toHaveTextContent('11 ind.');
  });

  it('renders dashes for missing pillar scores', () => {
    render(<PillarStrip pillarScores={null} />);
    expect(screen.getByTestId('pillar-strip-score-A')).toHaveTextContent('—');
  });

  it('renders pillar weights from the (default) methodology v1 block', () => {
    render(<PillarStrip pillarScores={PILLAR_SCORES} />);
    // Defaults: A 28% / B 15% / C 20% / D 22% / E 15%.
    expect(screen.getByTestId('pillar-strip-cell-A')).toHaveTextContent('28%');
    expect(screen.getByTestId('pillar-strip-cell-B')).toHaveTextContent('15%');
    expect(screen.getByTestId('pillar-strip-cell-D')).toHaveTextContent('22%');
  });

  it('honours custom pillarWeights when methodology v2+ overrides them', () => {
    render(
      <PillarStrip
        pillarScores={PILLAR_SCORES}
        pillarWeights={{ A: 0.3, B: 0.18, C: 0.2, D: 0.2, E: 0.12 }}
      />
    );
    expect(screen.getByTestId('pillar-strip-cell-A')).toHaveTextContent('30%');
    expect(screen.getByTestId('pillar-strip-cell-E')).toHaveTextContent('12%');
  });
});

describe('PillarBreakdown — tabs vs expand-all (Q5)', () => {
  const fieldValues: ProgramDetailFieldValue[] = [
    mkFieldValue('A', 'A.1.1', 'A.1', 'Minimum salary'),
    mkFieldValue('A', 'A.2.1', 'A.2', 'Education floor'),
    mkFieldValue('B', 'B.1.1', 'B.1', 'Application fee'),
    mkFieldValue('C', 'C.1.1', 'C.1', 'Spouse work rights'),
    mkFieldValue('D', 'D.2.2', 'D.2', 'Years to citizenship'),
    mkFieldValue('E', 'E.3.2', 'E.3', 'Government effectiveness'),
  ];

  function renderBreakdown(overrides: Partial<React.ComponentProps<typeof PillarBreakdown>> = {}) {
    return render(
      <PillarBreakdown
        fieldValues={fieldValues}
        pillarScores={PILLAR_SCORES}
        cohortMedianPillarScores={COHORT_MEDIAN}
        cohortScoredCount={2}
        subFactorScores={{ 'A.1': 19, 'A.2': 20 }}
        phase2Placeholder
        {...overrides}
      />
    );
  }

  it('defaults to tabs mode and shows pillar A indicators', () => {
    renderBreakdown();
    expect(screen.getByTestId('pillar-breakdown')).toHaveAttribute('data-mode', 'tabs');
    const tabA = screen.getByTestId('pillar-tab-A');
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    const table = screen.getByTestId('pillar-indicator-table');
    expect(table).toHaveTextContent('A.1.1');
    expect(table).toHaveTextContent('A.2.1');
    expect(table).not.toHaveTextContent('B.1.1');
  });

  it('switches indicator table when a different pillar tab is clicked', async () => {
    renderBreakdown();
    await userEvent.click(screen.getByTestId('pillar-tab-D'));
    expect(screen.getByTestId('pillar-tab-D')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('pillar-tab-A')).toHaveAttribute('aria-selected', 'false');
    const table = screen.getByTestId('pillar-indicator-table');
    expect(table).toHaveTextContent('D.2.2');
    expect(table).not.toHaveTextContent('A.1.1');
  });

  it('"Expand all sub-factors" mode renders every indicator grouped by sub-factor', async () => {
    renderBreakdown();
    await userEvent.click(screen.getByTestId('pillar-breakdown-mode-all'));
    const breakdown = screen.getByTestId('pillar-breakdown');
    expect(breakdown).toHaveAttribute('data-mode', 'all');
    // Tab strip + per-pillar table no longer rendered; sub-factor blocks render.
    expect(screen.queryByTestId('pillar-tab-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pillar-indicator-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('sub-factor-A.1')).toBeInTheDocument();
    expect(screen.getByTestId('sub-factor-A.2')).toBeInTheDocument();
    expect(screen.getByTestId('sub-factor-D.2')).toBeInTheDocument();
    // Every indicator across every sub-factor renders.
    const rows = screen.getAllByTestId('indicator-row');
    expect(rows.length).toBe(fieldValues.length);
  });

  it('switches back to tabs mode from expand-all', async () => {
    renderBreakdown();
    await userEvent.click(screen.getByTestId('pillar-breakdown-mode-all'));
    expect(screen.getByTestId('pillar-breakdown')).toHaveAttribute('data-mode', 'all');
    await userEvent.click(screen.getByTestId('pillar-breakdown-mode-tabs'));
    expect(screen.getByTestId('pillar-breakdown')).toHaveAttribute('data-mode', 'tabs');
    expect(screen.getByTestId('pillar-tab-strip')).toBeInTheDocument();
  });
});
