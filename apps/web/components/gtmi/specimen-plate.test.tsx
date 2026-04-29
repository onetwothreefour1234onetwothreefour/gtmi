import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpecimenPlate } from './specimen-plate';
import { SectionPlate } from './section-plate';
import { MarginNote } from './margin-note';

describe('SpecimenPlate', () => {
  it('renders the plate number, title, and child artefact', () => {
    render(
      <SpecimenPlate plateNo="I" title="Five pillars">
        <div data-testid="artefact">child</div>
      </SpecimenPlate>
    );
    const plate = screen.getByTestId('specimen-plate');
    expect(plate).toHaveTextContent('Plate I · Specimen');
    expect(plate).toHaveTextContent('Five pillars');
    expect(screen.getByTestId('artefact')).toBeInTheDocument();
  });

  it('renders the optional caption when passed', () => {
    render(
      <SpecimenPlate plateNo="II" title="t" caption="A note about provenance">
        <div />
      </SpecimenPlate>
    );
    expect(screen.getByTestId('specimen-plate')).toHaveTextContent('A note about provenance');
  });

  it('exposes the tone via data-tone for snapshot/styling assertions', () => {
    render(
      <SpecimenPlate plateNo="III" title="t" tone="ink">
        <div />
      </SpecimenPlate>
    );
    expect(screen.getByTestId('specimen-plate')).toHaveAttribute('data-tone', 'ink');
  });

  it('defaults to paper-2 tone when not specified', () => {
    render(
      <SpecimenPlate plateNo="IV" title="t">
        <div />
      </SpecimenPlate>
    );
    expect(screen.getByTestId('specimen-plate')).toHaveAttribute('data-tone', 'paper-2');
  });
});

describe('SectionPlate', () => {
  it('renders the numeral, title, and standfirst', () => {
    render(<SectionPlate numeral="01" title="The world by composite" standfirst="A short note." />);
    const plate = screen.getByTestId('section-plate');
    expect(plate).toHaveTextContent('01');
    expect(plate).toHaveTextContent('The world by composite');
    expect(plate).toHaveTextContent('A short note.');
  });

  it('omits standfirst when not passed', () => {
    render(<SectionPlate numeral="02" title="t" />);
    const plate = screen.getByTestId('section-plate');
    expect(plate).toHaveTextContent('02');
    expect(plate).toHaveTextContent('t');
    // No paragraph beyond the title; no standfirst text node.
    const paragraphs = plate.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('exposes the tone via data-tone (ink default)', () => {
    render(<SectionPlate numeral="03" title="t" />);
    expect(screen.getByTestId('section-plate')).toHaveAttribute('data-tone', 'ink');
  });
});

describe('MarginNote', () => {
  it('renders a navy peer-review note by default', () => {
    render(<MarginNote>peer review note</MarginNote>);
    const note = screen.getByTestId('margin-note');
    expect(note).toHaveTextContent('peer review note');
    expect(note.tagName).toBe('ASIDE');
  });

  it('honours a custom colour for accent / score-change use', () => {
    render(<MarginNote color="var(--accent)">attention</MarginNote>);
    const note = screen.getByTestId('margin-note');
    expect(note.getAttribute('style')).toContain('var(--accent)');
  });
});
