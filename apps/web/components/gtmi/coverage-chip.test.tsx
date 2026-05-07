import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageChip } from './coverage-chip';

describe('CoverageChip', () => {
  it('renders the percent format by default (Phase 4-A redesign default)', () => {
    render(<CoverageChip populated={21} total={33} />);
    const chip = screen.getByTestId('coverage-chip');
    // 21/33 = 63.6% → 64%
    expect(chip).toHaveTextContent('64%');
  });

  it('renders the absolute fraction when format="fraction"', () => {
    render(<CoverageChip populated={21} total={33} format="fraction" />);
    expect(screen.getByTestId('coverage-chip')).toHaveTextContent('21/33');
  });

  it('exposes the absolute fraction via the title/aria-label regardless of format', () => {
    render(<CoverageChip populated={21} total={33} />);
    const chip = screen.getByTestId('coverage-chip');
    expect(chip).toHaveAttribute('title', '21/33 fields populated');
    expect(chip).toHaveAttribute('aria-label', '21/33 fields populated');
  });

  it('flags low coverage (<70%) via data-low-coverage', () => {
    render(<CoverageChip populated={14} total={33} />);
    expect(screen.getByTestId('coverage-chip')).toHaveAttribute('data-low-coverage', 'true');
  });

  it('does NOT flag adequate coverage (≥70%)', () => {
    render(<CoverageChip populated={25} total={33} />);
    expect(screen.getByTestId('coverage-chip')).toHaveAttribute('data-low-coverage', 'false');
  });

  it('handles zero total without dividing by zero', () => {
    render(<CoverageChip populated={0} total={0} />);
    expect(screen.getByTestId('coverage-chip')).toHaveTextContent('0%');
  });
});
