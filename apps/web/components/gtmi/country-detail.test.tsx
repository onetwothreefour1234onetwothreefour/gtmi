import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountryHeader } from './country-header';
import { CountryProgramsTable } from './country-programs-table';
import { TaxTreatmentCard } from './tax-treatment-card';
import type { CountryProgramRow, CountryTaxTreatment } from '@/lib/queries/country-detail-types';
import type { PillarKey } from '@/lib/theme';

function mkProgram(
  id: string,
  name: string,
  composite: number | null,
  overrides: Partial<CountryProgramRow> = {}
): CountryProgramRow {
  return {
    programId: id,
    programName: name,
    programCategory: 'Skilled Worker',
    programStatus: 'active',
    composite,
    paq: composite,
    pillarScores:
      composite !== null
        ? ({ A: 60, B: 50, C: 55, D: 45, E: 40 } as Record<PillarKey, number>)
        : null,
    fieldsPopulated: composite !== null ? 30 : 0,
    fieldsTotal: 48,
    phase2Placeholder: composite !== null,
    ...overrides,
  };
}

describe('CountryHeader', () => {
  it('renders the country name in serif and the IMD rank/score in the standfirst', () => {
    render(
      <CountryHeader
        iso="AUS"
        name="Australia"
        region="Oceania"
        imdRank={9}
        imdAppealScore={76.34}
        programmesScored={1}
        programmesTotal={5}
        topProgrammeName="Skills in Demand 482"
        topProgrammeRank={1}
        averageComposite={16.36}
        averageCoverage={0.625}
      />
    );
    expect(screen.getByTestId('country-name')).toHaveTextContent('Australia');
    expect(screen.getByTestId('country-header')).toHaveTextContent('Appeal #9');
    expect(screen.getByTestId('country-header')).toHaveTextContent('76.34');
    expect(screen.getByTestId('country-header-stats')).toHaveTextContent('Skills in Demand 482');
  });

  it('renders dashes in the stat strip when nothing is scored', () => {
    render(
      <CountryHeader
        iso="OMN"
        name="Oman"
        region="MENA"
        imdRank={null}
        imdAppealScore={null}
        programmesScored={0}
        programmesTotal={2}
        topProgrammeName={null}
        topProgrammeRank={null}
        averageComposite={null}
        averageCoverage={null}
      />
    );
    const strip = screen.getByTestId('country-header-stats');
    expect(strip).toHaveTextContent('No scored programmes');
  });
});

describe('CountryProgramsTable', () => {
  it('renders one row per programme with correct rank prefixes for scored rows', () => {
    render(
      <CountryProgramsTable
        programs={[
          mkProgram('p1', 'Top', 78.4),
          mkProgram('p2', 'Mid', 50.1),
          mkProgram('p3', 'Unscored', null),
        ]}
      />
    );
    const rows = screen.getAllByTestId('country-program-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('#01');
    expect(rows[1]).toHaveTextContent('#02');
    expect(rows[2]).toHaveTextContent('Not yet scored');
  });

  it('renders the empty state for a country with no programmes', () => {
    render(<CountryProgramsTable programs={[]} />);
    expect(screen.queryByTestId('country-programs-table')).not.toBeInTheDocument();
    expect(screen.getByText(/No programmes seeded/)).toBeInTheDocument();
  });

  it('shows the Pre-cal chip on placeholder rows and the Awaiting chip on unscored rows', () => {
    render(
      <CountryProgramsTable
        programs={[mkProgram('p1', 'Scored placeholder', 16.36), mkProgram('p2', 'Unscored', null)]}
      />
    );
    // The placeholder row exposes the Pre-cal chip via the PreCalibrationChip
    // primitive (testid='pre-calibration-chip') alongside a status chip with
    // the same text — both being present is the intended rendering.
    const precalChips = screen.getAllByText(/Pre-cal/);
    expect(precalChips.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Awaiting/)).toBeInTheDocument();
  });
});

describe('TaxTreatmentCard', () => {
  const empty: CountryTaxTreatment = {
    taxationModel: null,
    specialRegime: null,
    totalProgramsInCountry: 4,
  };

  it('renders the empty state when both fields are null', () => {
    render(<TaxTreatmentCard tax={empty} taxAuthorityUrl="https://ato.gov.au" />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('Data not yet collected');
    expect(screen.getByTestId('empty-state')).toHaveTextContent('https://ato.gov.au');
  });

  it('renders both buckets with distribution counts when populated', () => {
    const tax: CountryTaxTreatment = {
      taxationModel: { territorial: 2, worldwide: 1 },
      specialRegime: { yes: 2 },
      totalProgramsInCountry: 4,
    };
    render(<TaxTreatmentCard tax={tax} taxAuthorityUrl={null} />);
    const card = screen.getByTestId('tax-treatment-card');
    expect(card).toHaveTextContent('Territorial vs worldwide');
    expect(card).toHaveTextContent('Special regime');
    expect(card).toHaveTextContent('territorial');
    expect(card).toHaveTextContent('2 of 4');
  });

  it('handles half-populated payloads (one indicator extracted, one not)', () => {
    const tax: CountryTaxTreatment = {
      taxationModel: { territorial: 1 },
      specialRegime: null,
      totalProgramsInCountry: 1,
    };
    render(<TaxTreatmentCard tax={tax} taxAuthorityUrl={null} />);
    const card = screen.getByTestId('tax-treatment-card');
    expect(card).toHaveTextContent('Territorial vs worldwide');
    expect(card).toHaveTextContent('territorial');
    expect(card).toHaveTextContent('Data not yet collected');
  });
});
