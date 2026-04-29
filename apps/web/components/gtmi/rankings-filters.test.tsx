import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingsFilters } from './rankings-filters';
import type { RankedProgramsFilters } from '@/lib/queries/types';

const FACETS = {
  countries: [
    { iso: 'AUS', name: 'Australia', region: 'Oceania' },
    { iso: 'SGP', name: 'Singapore', region: 'Asia' },
  ],
  regions: ['Asia', 'Europe', 'Oceania'],
  categories: ['Skilled Worker', 'Tech Talent', 'Talent Visa'],
};

function setup(initial: RankedProgramsFilters = {}) {
  const onChange = vi.fn();
  render(
    <RankingsFilters
      filters={initial}
      onChange={onChange}
      facets={FACETS}
      totalCount={42}
      scoredCount={2}
    />
  );
  return { onChange };
}

describe('RankingsFilters — chip strip front-of-stage (Q4)', () => {
  it('renders an "All categories" chip plus one chip per facet', () => {
    setup();
    expect(screen.getByTestId('filter-chip-all-categories')).toBeInTheDocument();
    const chips = screen.getAllByTestId('filter-chip-category');
    expect(chips).toHaveLength(FACETS.categories.length);
    expect(chips.map((c) => c.getAttribute('data-category'))).toEqual(FACETS.categories);
  });

  it('marks "All categories" as active when no categories are selected', () => {
    setup();
    expect(screen.getByTestId('filter-chip-all-categories')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('clearing the "All categories" chip emits an empty categories array', async () => {
    const { onChange } = setup({ categories: ['Skilled Worker'] });
    await userEvent.click(screen.getByTestId('filter-chip-all-categories'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categories: [] }));
  });

  it('toggling a category chip flips it in the categories array', async () => {
    const { onChange } = setup();
    const chip = screen
      .getAllByTestId('filter-chip-category')
      .find((c) => c.getAttribute('data-category') === 'Tech Talent');
    expect(chip).toBeDefined();
    await userEvent.click(chip!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categories: ['Tech Talent'] }));
  });
});

describe('RankingsFilters — More filters disclosure', () => {
  it('hides the advanced filter form by default', () => {
    setup();
    expect(screen.queryByTestId('more-filters')).not.toBeInTheDocument();
    expect(screen.getByTestId('more-filters-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the disclosure on toggle and exposes search/country/region/range', async () => {
    setup();
    await userEvent.click(screen.getByTestId('more-filters-toggle'));
    const panel = screen.getByTestId('more-filters');
    expect(panel).toBeInTheDocument();
    expect(screen.getByLabelText('Search programmes')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by country')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Composite score range')).toBeInTheDocument();
  });

  it('closes again on second toggle', async () => {
    setup();
    const toggle = screen.getByTestId('more-filters-toggle');
    await userEvent.click(toggle);
    expect(screen.getByTestId('more-filters')).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.queryByTestId('more-filters')).not.toBeInTheDocument();
  });

  it('shows the active-advanced-filter count badge on the toggle when advanced filters are set', () => {
    setup({ countryIsos: ['AUS'], scoredOnly: true });
    const toggle = screen.getByTestId('more-filters-toggle');
    expect(toggle.textContent).toContain('More filters');
    expect(toggle.textContent).toContain('2');
  });

  it('does NOT count category selections towards the advanced badge (chips are front-of-stage)', () => {
    setup({ categories: ['Skilled Worker'] });
    const toggle = screen.getByTestId('more-filters-toggle');
    // Category chips live in the front-of-stage row; the toggle's badge only
    // tracks advanced filters (country / region / range / search / scored-only).
    expect(toggle.textContent).not.toMatch(/More filters\s*1/);
  });
});

describe('RankingsFilters — Reset', () => {
  it('renders a Reset link only when at least one filter is active', () => {
    setup();
    expect(screen.queryByText(/^Reset$/)).not.toBeInTheDocument();
  });

  it('Reset clears the filter state via onChange({})', async () => {
    const { onChange } = setup({ categories: ['Tech Talent'], scoredOnly: true });
    await userEvent.click(screen.getByText(/^Reset$/));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
