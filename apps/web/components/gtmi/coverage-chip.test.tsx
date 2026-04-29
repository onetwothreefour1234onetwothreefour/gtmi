import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageChip } from './coverage-chip';

describe('CoverageChip', () => {
  it('renders the percent format by default (Phase 4-A redesign default)', () => {
    render(<CoverageChip populated={30} total={48} />);
    const chip = screen.getByTestId('coverage-chip');
    // 30/48 = 62.5% → 63%
    expect(chip).toHaveTextContent('63%');
  });

  it('renders the absolute fraction when format="fraction"', () => {
    render(<CoverageChip populated={30} total={48} format="fraction" />);
    expect(screen.getByTestId('coverage-chip')).toHaveTextContent('30/48');
  });

  it('exposes the absolute fraction via the title/aria-label regardless of format', () => {
    render(<CoverageChip populated={30} total={48} />);
    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveAttribute('title', '30/48 fields populated');
    expect(chip).toHaveAttribute('aria-label', '30/48 fields populated');
  });

  it('flags low coverage (<70%) via data-low-coverage', () => {
    render(<CoverageChip populated={20} total={48} />);
    expect(screen.getByTestId('coverage-chip')).toHaveAttribute('data-low-coverage', 'true');
  });

  it('does NOT flag adequate coverage (≥70%)', () => {
    render(<CoverageChip populated={36} total={48} />);
    expect(screen.getByTestId('coverage-chip')).toHaveAttribute('data-low-coverage', 'false');
  });

  it('handles zero total without dividing by zero', () => {
    render(<CoverageChip populated={0} total={0} />);
    expect(screen.getByTestId('coverage-chip')).toHaveTextContent('0%');
  });
});
