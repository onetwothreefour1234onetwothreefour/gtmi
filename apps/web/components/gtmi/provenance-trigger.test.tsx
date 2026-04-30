import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('ProvenanceTrigger — drawer migration (Phase 4-C)', () => {
  it('renders the "Provenance incomplete" error chip when required keys are missing', () => {
    const partial = { ...COMPLETE_PROVENANCE } as Partial<Provenance>;
    delete partial.contentHash;
    render(
      <ProvenanceTrigger
        provenance={partial}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );

    const chip = screen.getByTestId('provenance-incomplete');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('role', 'alert');
    expect(chip).toHaveTextContent('Provenance incomplete');
    expect(chip.title).toContain('contentHash');
  });

  it('renders the "Provenance incomplete" error chip when raw is null', () => {
    render(
      <ProvenanceTrigger
        provenance={null}
        status="approved"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    expect(screen.getByTestId('provenance-incomplete')).toBeInTheDocument();
  });

  it('renders the trigger button when all required keys are present', () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    expect(screen.getByTestId('provenance-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('provenance-incomplete')).not.toBeInTheDocument();
    // Drawer is closed by default — content is not in the tree.
    expect(screen.queryByTestId('provenance-drawer')).not.toBeInTheDocument();
  });

  it('renders the trigger when an approved row has all 13+3 keys', () => {
    render(
      <ProvenanceTrigger
        provenance={APPROVED_PROVENANCE}
        status="approved"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    expect(screen.getByTestId('provenance-trigger')).toBeInTheDocument();
  });

  it('downgrades an approved row that lacks reviewer keys to incomplete', () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="approved"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    expect(screen.getByTestId('provenance-incomplete')).toBeInTheDocument();
  });

  it('opens the drawer on click and shows the field key + label', async () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary threshold"
        valueRaw="AUD 73,150"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const drawer = await screen.findByTestId('provenance-drawer');
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent('A.1.1');
    expect(drawer).toHaveTextContent('Minimum salary threshold');
  });

  it('renders the source sentence with charOffset highlighting', async () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const highlight = await screen.findByTestId('provenance-highlight');
    expect(highlight).toHaveTextContent('The minimum salary');
    // The marked substring is sentence.slice(42, 53) → "AUD 73,150 ".
    expect(highlight.querySelector('mark')).not.toBeNull();
  });

  it('renders the Tier 2 advisory note when sourceTier === 2', async () => {
    const tier2: Provenance = { ...COMPLETE_PROVENANCE, sourceTier: 2 };
    render(
      <ProvenanceTrigger
        provenance={tier2}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="not required"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const badge = await screen.findByTestId('tier2-source-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('role', 'note');
    expect(badge).toHaveTextContent('Tier 2 source');
  });

  it('does NOT render the Tier 2 badge when sourceTier === 1', async () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    expect(screen.queryByTestId('tier2-source-badge')).not.toBeInTheDocument();
  });

  it('renders the Country-substitute badge when extractionModel === "country-substitute-regional"', async () => {
    const sub: Provenance = {
      ...COMPLETE_PROVENANCE,
      extractionModel: 'country-substitute-regional',
      validationModel: 'country-substitute-regional',
      reviewer: 'auto',
      reviewedAt: '2026-04-27T00:00:00.000Z',
      reviewerNotes: 'Regional default; ADR-014.',
    };
    render(
      <ProvenanceTrigger
        provenance={sub}
        status="approved"
        fieldKey="C.3.2"
        fieldLabel="Public schooling"
        valueRaw="automatic"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const badge = await screen.findByTestId('country-substitute-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('role', 'note');
    expect(badge).toHaveTextContent('Country-substitute');
  });

  it('renders the Derived badge when extractionModel === "derived-knowledge"', async () => {
    const derived: Provenance = {
      ...COMPLETE_PROVENANCE,
      extractionModel: 'derived-knowledge',
      validationModel: 'derived-knowledge',
      reviewer: 'auto',
      reviewedAt: '2026-04-29T00:00:00.000Z',
      reviewerNotes: 'Derived row routed to /review.',
    };
    render(
      <ProvenanceTrigger
        provenance={derived}
        status="approved"
        fieldKey="A.1.2"
        fieldLabel="Salary as % of local median wage"
        valueRaw="143%"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const badge = await screen.findByTestId('derived-knowledge-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('role', 'note');
    expect(badge).toHaveTextContent('Derived');
  });

  it('renders the Derived badge when extractionModel === "derived-computation"', async () => {
    const derived: Provenance = {
      ...COMPLETE_PROVENANCE,
      extractionModel: 'derived-computation',
      validationModel: 'derived-computation',
      reviewer: 'auto',
      reviewedAt: '2026-04-29T00:00:00.000Z',
      reviewerNotes: 'Derived row routed to /review.',
    };
    render(
      <ProvenanceTrigger
        provenance={derived}
        status="approved"
        fieldKey="A.1.2"
        fieldLabel="Salary as % of local median wage"
        valueRaw="143%"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    expect(await screen.findByTestId('derived-knowledge-badge')).toBeInTheDocument();
  });

  it('renders the "Computed from:" derivedInputs block when present', async () => {
    const derived = {
      ...COMPLETE_PROVENANCE,
      extractionModel: 'derived-computation',
      validationModel: 'derived-computation',
      extractionConfidence: 0.6,
      validationConfidence: 0.6,
      sourceUrl: 'derived-computation:A.1.2',
      derivedInputs: {
        'A.1.1': {
          valueRaw: 'AUD 73,150',
          valueCurrency: 'AUD',
          sourceUrl: 'https://immi.homeaffairs.gov.au/visas/skills-in-demand-482',
        },
        medianWage: {
          value: 60_200,
          year: 2023,
          source: 'OECD',
          sourceUrl: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
        },
      },
    } as unknown as Provenance;
    render(
      <ProvenanceTrigger
        provenance={derived}
        status="pending_review"
        fieldKey="A.1.2"
        fieldLabel="Salary as % of local median wage"
        valueRaw="143%"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const block = await screen.findByTestId('derived-inputs');
    expect(block).toBeInTheDocument();
    expect(block).toHaveTextContent('Computed from');
    expect(block).toHaveTextContent('A.1.1');
    expect(block).toHaveTextContent('medianWage');
    const links = block.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('closes the drawer on Escape', async () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    expect(await screen.findByTestId('provenance-drawer')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    // Radix unmounts the content on close.
    expect(screen.queryByTestId('provenance-drawer')).not.toBeInTheDocument();
  });

  it('closes the drawer when the close button is clicked', async () => {
    render(
      <ProvenanceTrigger
        provenance={COMPLETE_PROVENANCE}
        status="pending_review"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        valueRaw="AUD 73,150"
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    await userEvent.click(await screen.findByTestId('provenance-drawer-close'));
    expect(screen.queryByTestId('provenance-drawer')).not.toBeInTheDocument();
  });

  it('exposes the full ADR-007 schema inside the drawer (single source card per Q13)', async () => {
    render(
      <ProvenanceTrigger
        provenance={APPROVED_PROVENANCE}
        status="approved"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        weightWithinSubFactor={0.03}
        valueRaw="AUD 73,150"
        valueIndicatorScore={64.2}
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    const drawer = await screen.findByTestId('provenance-drawer');

    // Single source card.
    const sourceCards = screen.getAllByTestId('provenance-drawer-source-card');
    expect(sourceCards).toHaveLength(1);

    // Phase 3.9 / W7 — when archivePath is absent (legacy row), the
    // archive link renders the disabled "No archived snapshot" label
    // instead of the Phase 5 Wayback placeholder.
    const archiveDisabled = screen.getByTestId('provenance-drawer-archive-disabled');
    expect(archiveDisabled).toHaveAttribute('aria-disabled', 'true');
    expect(archiveDisabled.title).toMatch(/before Phase 3\.9/);

    // Provenance metadata grid renders extractionModel, validationModel,
    // crossCheckResult, methodologyVersion, reviewer.
    expect(drawer).toHaveTextContent('claude-sonnet-4-6');
    expect(drawer).toHaveTextContent('Agrees');
    expect(drawer).toHaveTextContent('1.0.0');
    expect(screen.getByTestId('provenance-drawer-reviewer')).toBeInTheDocument();
  });

  it('renders the archive snapshot trigger when provenance.archivePath is present (W7)', async () => {
    render(
      <ProvenanceTrigger
        provenance={{
          ...APPROVED_PROVENANCE,
          archivePath:
            'NLD/668cec08-4b78-4cd2-b215-3047c551ce6e/2026-04-30/' + 'a'.repeat(64) + '.md',
        }}
        status="approved"
        fieldKey="A.1.1"
        fieldLabel="Minimum salary"
        weightWithinSubFactor={0.03}
        valueRaw="EUR 5,331"
        valueIndicatorScore={50}
      />
    );
    await userEvent.click(screen.getByTestId('provenance-trigger'));
    await screen.findByTestId('provenance-drawer');
    const trigger = screen.getByTestId('provenance-drawer-archive-trigger');
    expect(trigger).toHaveTextContent(/archived snapshot/i);
    // The signed-URL fetch is lazy; it only fires on click. Verify the
    // disabled-fallback testid is NOT rendered when archivePath is set.
    expect(screen.queryByTestId('provenance-drawer-archive-disabled')).toBeNull();
  });
});
