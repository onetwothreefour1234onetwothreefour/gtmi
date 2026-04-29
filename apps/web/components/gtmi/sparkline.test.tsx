import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline, deterministicTrend } from './sparkline';

describe('Sparkline', () => {
  it('renders nothing when fewer than 2 points are passed', () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a single-point series (no line possible)', () => {
    const { container } = render(<Sparkline values={[50]} />);
    expect(container.firstChild).toBeNull();
  });

  it('emits an SVG with role=img and a descriptive aria-label by default', () => {
    render(<Sparkline values={[20, 30, 40]} />);
    const svg = screen.getByTestId('sparkline');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg.getAttribute('aria-label')).toMatch(/Sparkline.*trend up/);
    expect(svg.getAttribute('data-trend')).toBe('up');
  });

  it('flags trend down when the last value drops below the first', () => {
    render(<Sparkline values={[80, 60, 40]} />);
    const svg = screen.getByTestId('sparkline');
    expect(svg.getAttribute('data-trend')).toBe('down');
  });

  it('honours a custom aria-label', () => {
    render(<Sparkline values={[20, 30]} ariaLabel="custom" />);
    expect(screen.getByTestId('sparkline')).toHaveAttribute('aria-label', 'custom');
  });
});

describe('deterministicTrend', () => {
  it('produces a series of the requested length', () => {
    const arr = deterministicTrend('foo', 50);
    expect(arr).toHaveLength(12);
  });

  it('pins the last point to the composite value (sparkline end-marker matches displayed score)', () => {
    const arr = deterministicTrend('foo', 73.4);
    expect(arr[arr.length - 1]).toBe(73.4);
  });

  it('is stable per seedKey + composite (trend does not change between renders)', () => {
    const a = deterministicTrend('foo', 50);
    const b = deterministicTrend('foo', 50);
    expect(a).toEqual(b);
  });

  it('produces different walks for different seedKeys', () => {
    const a = deterministicTrend('aaa', 50);
    const b = deterministicTrend('bbb', 50);
    // last value pinned to composite is identical, so compare interior points.
    expect(a.slice(0, -1)).not.toEqual(b.slice(0, -1));
  });

  it('clamps interior values into [20, 95] (no off-scale spikes)', () => {
    const arr = deterministicTrend('whatever', 50, 24);
    for (const v of arr.slice(0, -1)) {
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(95);
    }
  });
});
