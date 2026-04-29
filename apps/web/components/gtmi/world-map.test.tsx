import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorldMap } from './world-map';
import {
  WORLD_MAP_DOTS,
  WORLD_MAP_GRID,
  compositeQuintile,
} from '@/lib/data/world-map-coordinates';

describe('compositeQuintile', () => {
  it('partitions composites into the design-spec quintile bands', () => {
    expect(compositeQuintile(0)).toBe(1);
    expect(compositeQuintile(39.99)).toBe(1);
    expect(compositeQuintile(40)).toBe(2);
    expect(compositeQuintile(49.99)).toBe(2);
    expect(compositeQuintile(50)).toBe(3);
    expect(compositeQuintile(59.99)).toBe(3);
    expect(compositeQuintile(60)).toBe(4);
    expect(compositeQuintile(69.99)).toBe(4);
    expect(compositeQuintile(70)).toBe(5);
    expect(compositeQuintile(100)).toBe(5);
  });
});

describe('WORLD_MAP_DOTS coordinate set', () => {
  it('includes every cohort country at least once', () => {
    const isos = new Set(WORLD_MAP_DOTS.map((d) => d.iso));
    // Spot-check the cohort that the design enumerates.
    for (const expected of [
      'CHE',
      'SGP',
      'NLD',
      'CAN',
      'DEU',
      'IRL',
      'GBR',
      'AUS',
      'SWE',
      'HKG',
      'LUX',
      'BEL',
      'AUT',
      'NZL',
      'JPN',
      'FRA',
      'ARE',
      'EST',
      'NOR',
      'USA',
      'FIN',
      'ISL',
    ]) {
      expect(isos.has(expected)).toBe(true);
    }
  });

  it('keeps every coordinate inside the declared grid', () => {
    for (const dot of WORLD_MAP_DOTS) {
      expect(dot.col).toBeGreaterThanOrEqual(0);
      expect(dot.col).toBeLessThan(WORLD_MAP_GRID.cols);
      expect(dot.row).toBeGreaterThanOrEqual(0);
      expect(dot.row).toBeLessThan(WORLD_MAP_GRID.rows);
    }
  });
});

describe('<WorldMap>', () => {
  it('renders one <circle> per coordinate dot', () => {
    render(<WorldMap scores={[]} />);
    const dots = screen.getAllByTestId('world-map-dot');
    expect(dots).toHaveLength(WORLD_MAP_DOTS.length);
  });

  it('marks dots as scored when an ISO has a composite, muted otherwise', () => {
    render(
      <WorldMap
        scores={[
          { iso: 'CHE', composite: 78.4 },
          { iso: 'SGP', composite: 19.92 },
        ]}
      />
    );
    const dots = screen.getAllByTestId('world-map-dot');
    const cheDots = dots.filter((d) => d.getAttribute('data-iso') === 'CHE');
    expect(cheDots.length).toBeGreaterThan(0);
    for (const d of cheDots) expect(d.getAttribute('data-scored')).toBe('true');
    const mexDots = dots.filter((d) => d.getAttribute('data-iso') === 'MEX');
    expect(mexDots.length).toBeGreaterThan(0);
    for (const d of mexDots) expect(d.getAttribute('data-scored')).toBe('false');
  });

  it('positions each dot at col*cellSize + cellSize/2 (matches design coordinates)', () => {
    render(<WorldMap scores={[]} />);
    const dots = screen.getAllByTestId('world-map-dot');
    const half = WORLD_MAP_GRID.cellSize / 2;
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const spec = WORLD_MAP_DOTS[i];
      const expectedCx = spec.col * WORLD_MAP_GRID.cellSize + half;
      const expectedCy = spec.row * WORLD_MAP_GRID.cellSize + half;
      expect(Number(dot.getAttribute('cx'))).toBeCloseTo(expectedCx, 5);
      expect(Number(dot.getAttribute('cy'))).toBeCloseTo(expectedCy, 5);
    }
  });

  it('renders the quintile legend with five tier labels', () => {
    render(<WorldMap scores={[]} />);
    expect(screen.getByText('Composite quintile')).toBeInTheDocument();
    for (let n = 1; n <= 5; n++) {
      expect(screen.getByText(`Tier ${n}`)).toBeInTheDocument();
    }
  });

  it('legend exposes accessible svg with aria-label', () => {
    render(<WorldMap scores={[]} />);
    const svg = screen.getByLabelText('The world by composite — dot matrix scoring map');
    expect(svg).toBeInTheDocument();
  });
});
