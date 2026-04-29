import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ScoreBar } from './score-bar';
import { CompositeScoreDisplay } from './composite-score-display';
import { CoverageChip } from './coverage-chip';
import { PillarMiniBars } from './pillar-mini-bars';
import { EmptyState } from './empty-state';
import { DataTableNote } from './data-table-note';
import { SectionHeader } from './section-header';
import { DirectionArrow } from './direction-arrow';
import { ProvenanceTrigger } from './provenance-trigger';
import { CountryFlag } from './country-flag';
import { Sparkline, deterministicTrend } from './sparkline';
import { SpecimenPlate } from './specimen-plate';
import { SectionPlate } from './section-plate';
import { MarginNote } from './margin-note';
import { SplitSpecimen } from './split-specimen';
import { PillarsSpecimen } from './pillars-specimen';

/**
 * vitest-axe smoke tests on the leaf primitives. Catches the obvious
 * violations (missing alt text, missing aria-labels, contrast issues
 * that axe can detect from markup, missing form-control labels).
 *
 * Composite primitives (RankingsTable, SubFactorAccordion, the page
 * components) are exercised by the live-render smoke tests against
 * the staging DB; running axe on those would require either a real
 * DB connection or extensive mock fixtures. The leaf primitives are
 * where most a11y bugs land.
 */

const COMPLETE_PROVENANCE = {
  sourceUrl: 'https://example.gov/visa',
  geographicLevel: 'national' as const,
  sourceTier: 1 as const,
  scrapedAt: '2026-04-21T10:00:00.000Z',
  contentHash: 'abc12345',
  sourceSentence: 'The minimum salary is AUD 73,150 per year.',
  charOffsets: [21, 32] as [number, number],
  extractionModel: 'claude-sonnet-4-6',
  extractionConfidence: 0.92,
  validationModel: 'claude-sonnet-4-6',
  validationConfidence: 0.88,
  crossCheckResult: 'agrees' as const,
  methodologyVersion: '1.0.0',
};

describe('axe a11y smoke', () => {
  it('ScoreBar (scored) has no detectable violations', async () => {
    const { container } = render(<ScoreBar value={42.5} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ScoreBar (unscored) has no detectable violations', async () => {
    const { container } = render(<ScoreBar value={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ScoreBar with pre-calibration chip has no detectable violations', async () => {
    const { container } = render(<ScoreBar value={16.36} phase2Placeholder />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CompositeScoreDisplay (scored + placeholder) has no detectable violations', async () => {
    const { container } = render(
      <CompositeScoreDisplay
        composite={16.36}
        cme={22.53}
        paq={13.72}
        phase2Placeholder
        rank={1}
        scoredCount={3}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CompositeScoreDisplay (unscored) has no detectable violations', async () => {
    const { container } = render(<CompositeScoreDisplay composite={null} cme={null} paq={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CoverageChip has no detectable violations', async () => {
    const { container } = render(<CoverageChip populated={30} total={48} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PillarMiniBars (scored) has no detectable violations', async () => {
    const { container } = render(<PillarMiniBars scores={{ A: 18, B: 12, C: 16, D: 10, E: 14 }} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PillarMiniBars (unscored) has no detectable violations', async () => {
    const { container } = render(<PillarMiniBars scores={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('EmptyState has no detectable violations', async () => {
    const { container } = render(
      <EmptyState
        title="Awaiting Phase 3 scoring"
        body="This programme is seeded but has no field values yet."
        ctaHref="/methodology"
        ctaLabel="See methodology"
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('DataTableNote has no detectable violations', async () => {
    const { container } = render(
      <DataTableNote>Composite = 30% CME + 70% PAQ across 48 indicators.</DataTableNote>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SectionHeader has no detectable violations', async () => {
    const { container } = render(
      <SectionHeader eyebrow="01" title="What GTMI measures" dek="Long-form dek copy." />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('DirectionArrow has accessible label and no violations', async () => {
    const { container } = render(<DirectionArrow direction="higher_is_better" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CountryFlag (cohort country) has alt text and no violations', async () => {
    const { container } = render(<CountryFlag iso="AUS" countryName="Australia" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CountryFlag (unknown ISO) falls back to globe glyph cleanly', async () => {
    const { container } = render(<CountryFlag iso="ZZZ" countryName="Unknown" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ProvenanceTrigger (incomplete provenance) has accessible alert chip', async () => {
    const { container } = render(
      <ProvenanceTrigger provenance={null} status="approved" valueRaw="AUD 73,150" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ProvenanceTrigger (complete provenance) has accessible button', async () => {
    const { container } = render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        valueRaw="AUD 73,150"
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Sparkline (trend up) has role=img + aria-label, no violations', async () => {
    const { container } = render(<Sparkline values={deterministicTrend('seed-1', 70)} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Sparkline (trend down) has no violations', async () => {
    const { container } = render(<Sparkline values={[80, 60, 40, 30, 20]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SpecimenPlate has no detectable violations', async () => {
    const { container } = render(
      <SpecimenPlate plateNo="I" title="Five pillars. Forty-eight indicators." caption="A note.">
        <PillarsSpecimen />
      </SpecimenPlate>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SectionPlate has no detectable violations', async () => {
    const { container } = render(
      <SectionPlate
        numeral="01"
        title="The world by composite"
        standfirst="Italic standfirst paragraph."
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('MarginNote has no detectable violations', async () => {
    const { container } = render(<MarginNote>Peer review note.</MarginNote>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SplitSpecimen has accessible svg + aria-label, no violations', async () => {
    const { container } = render(<SplitSpecimen />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PillarsSpecimen has no detectable violations', async () => {
    const { container } = render(<PillarsSpecimen />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
