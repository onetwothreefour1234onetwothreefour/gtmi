import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CountriesGrid } from './countries-grid';
import type { CountryIndexRow } from '@/lib/queries/all-countries';

function row(overrides: Partial<CountryIndexRow> = {}): CountryIndexRow {
  return {
    iso: 'CAN',
    name: 'Canada',
    region: 'Americas',
    imdRank: 14,
    cmeScore: 34.49,
    programmeCount: 4,
    scoredProgrammeCount: 1,
    bestComposite: 18.3,
    bestProgrammeName: 'Express Entry – Federal Skilled Worker',
    bestProgrammeId: '0e2d340e-78ce-4813-8cd2-d914abcc5554',
    averageCoveragePct: 81,
    flaggedAny: true,
    ...overrides,
  };
}

describe('CountriesGrid', () => {
  it('renders one card per row', () => {
    render(
      <CountriesGrid
        rows={[row({ iso: 'CAN', name: 'Canada' }), row({ iso: 'SGP', name: 'Singapore' })]}
      />
    );
    expect(screen.getAllByTestId('country-card')).toHaveLength(2);
  });

  it('each card links to the per-country detail page', () => {
    render(<CountriesGrid rows={[row({ iso: 'CAN' })]} />);
    const card = screen.getByTestId('country-card');
    expect(card).toHaveAttribute('href', '/countries/CAN');
    expect(card).toHaveAttribute('data-iso', 'CAN');
  });

  it('renders region eyebrow + IMD rank when present', () => {
    render(<CountriesGrid rows={[row({ region: 'Americas', imdRank: 14 })]} />);
    const card = screen.getByTestId('country-card');
    expect(within(card).getByText(/AMERICAS/)).toBeInTheDocument();
    expect(within(card).getByText(/IMD #/)).toBeInTheDocument();
    expect(within(card).getByText('14')).toBeInTheDocument();
  });

  it('omits the IMD rank when the country has no rank (e.g. non-IMD-cohort)', () => {
    render(<CountriesGrid rows={[row({ iso: 'BHR', imdRank: null })]} />);
    const card = screen.getByTestId('country-card');
    expect(within(card).queryByText(/IMD #/)).not.toBeInTheDocument();
  });

  it('shows the CME score with two decimals when present', () => {
    render(<CountriesGrid rows={[row({ cmeScore: 34.49 })]} />);
    expect(screen.getByTestId('country-card-cme')).toHaveTextContent('34.49');
  });

  it('renders an em-dash when the country has no CME score', () => {
    render(<CountriesGrid rows={[row({ cmeScore: null })]} />);
    expect(screen.queryByTestId('country-card-cme')).not.toBeInTheDocument();
    const card = screen.getByTestId('country-card');
    expect(within(card).getByText('—')).toBeInTheDocument();
  });

  it('renders the top-composite chip with the pre-calibration marker for scored countries', () => {
    render(<CountriesGrid rows={[row({ scoredProgrammeCount: 1, bestComposite: 18.3 })]} />);
    expect(screen.getByTestId('country-card-best')).toHaveTextContent('18.30');
    // <PreCalibrationChip> renders inside this block; the chip itself
    // owns its data-testid so we check by presence rather than scraping
    // text out of a Radix Popover trigger.
    expect(
      within(screen.getByTestId('country-card-best')).getByTestId('pre-calibration-chip')
    ).toBeInTheDocument();
  });

  it('renders the "Not yet scored" empty branch when no programme has a composite', () => {
    render(
      <CountriesGrid
        rows={[
          row({
            iso: 'NAM',
            name: 'Namibia',
            scoredProgrammeCount: 0,
            bestComposite: null,
            bestProgrammeName: null,
            averageCoveragePct: null,
          }),
        ]}
      />
    );
    expect(screen.getByTestId('country-card-unscored')).toHaveTextContent('Not yet scored');
    expect(screen.queryByTestId('country-card-best')).not.toBeInTheDocument();
  });

  it('shows the top programme name for scored countries', () => {
    render(<CountriesGrid rows={[row({ bestProgrammeName: 'Express Entry – FSW' })]} />);
    const card = screen.getByTestId('country-card');
    expect(within(card).getByText(/Express Entry – FSW/)).toBeInTheDocument();
  });

  it('renders the empty placeholder when rows is empty', () => {
    render(<CountriesGrid rows={[]} />);
    expect(screen.getByTestId('countries-grid-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('countries-grid')).not.toBeInTheDocument();
  });
});
