import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplitSpecimen } from './split-specimen';
import { PillarsSpecimen } from './pillars-specimen';

describe('SplitSpecimen', () => {
  it('renders an accessible SVG donut with the default 30/70 split', () => {
    render(<SplitSpecimen />);
    const root = screen.getByTestId('split-specimen');
    const svg = root.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Composite split: 70% PAQ, 30% CME');
  });

  it('honours custom cmePaqSplit values', () => {
    render(<SplitSpecimen cmePaqSplit={{ cme: 0.4, paq: 0.6 }} />);
    const svg = screen.getByTestId('split-specimen').querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toBe('Composite split: 60% PAQ, 40% CME');
  });
});

describe('PillarsSpecimen', () => {
  it('renders all five pillar columns with default methodology v1 weights', () => {
    render(<PillarsSpecimen />);
    const root = screen.getByTestId('pillars-specimen');
    expect(root).toHaveTextContent('Access');
    expect(root).toHaveTextContent('Process');
    expect(root).toHaveTextContent('Rights');
    expect(root).toHaveTextContent('Pathway');
    expect(root).toHaveTextContent('Stability');
    // Default weights: 28% / 15% / 20% / 22% / 15%
    expect(root).toHaveTextContent('28% wt');
    expect(root).toHaveTextContent('15% wt');
    expect(root).toHaveTextContent('20% wt');
    expect(root).toHaveTextContent('22% wt');
  });

  it('honours custom pillarWeights', () => {
    render(<PillarsSpecimen pillarWeights={{ A: 0.25, B: 0.2, C: 0.2, D: 0.2, E: 0.15 }} />);
    const root = screen.getByTestId('pillars-specimen');
    expect(root).toHaveTextContent('25% wt');
    expect(root).toHaveTextContent('20% wt');
  });
});
