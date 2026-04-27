import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBar } from './score-bar';
import { scoreBucket, scoreColor, SCORE_SCALE } from '@/lib/theme';

describe('ScoreBar', () => {
  describe('sequential color thresholds', () => {
    it('maps 0..19 to bucket 0 (lightest band)', () => {
      expect(scoreBucket(0)).toBe(0);
      expect(scoreBucket(19.99)).toBe(0);
      expect(scoreColor(0)).toBe(SCORE_SCALE[0]);
    });

    it('maps 20..39 to bucket 1', () => {
      expect(scoreBucket(20)).toBe(1);
      expect(scoreBucket(39.99)).toBe(1);
    });

    it('maps 40..59 to bucket 2', () => {
      expect(scoreBucket(40)).toBe(2);
      expect(scoreBucket(59.99)).toBe(2);
    });

    it('maps 60..79 to bucket 3', () => {
      expect(scoreBucket(60)).toBe(3);
      expect(scoreBucket(79.99)).toBe(3);
    });

    it('maps 80..100 to bucket 4 (darkest band)', () => {
      expect(scoreBucket(80)).toBe(4);
      expect(scoreBucket(100)).toBe(4);
      expect(scoreColor(100)).toBe(SCORE_SCALE[4]);
    });
  });

  describe('rendering', () => {
    it('renders the numeric label with two decimal places', () => {
      render(<ScoreBar value={16.36} />);
      expect(screen.getByTestId('score-bar-label')).toHaveTextContent('16.36');
    });

    it('clamps fill width to 0-100', () => {
      const { rerender } = render(<ScoreBar value={150} />);
      let fill = screen.getByTestId('score-bar-fill');
      expect(fill.style.width).toBe('100%');

      rerender(<ScoreBar value={-25} />);
      fill = screen.getByTestId('score-bar-fill');
      expect(fill.style.width).toBe('0%');
    });

    it('exposes a numeric aria-label so color is never the sole carrier', () => {
      render(<ScoreBar value={42} />);
      expect(screen.getByTestId('score-bar-track')).toHaveAttribute(
        'aria-label',
        'Score: 42.00 out of 100'
      );
    });
  });

  describe('phase2Placeholder rendering', () => {
    it('renders the pre-calibration chip when flag is true and value is scored', () => {
      render(<ScoreBar value={18.11} phase2Placeholder />);
      expect(screen.getByTestId('pre-calibration-chip')).toBeInTheDocument();
    });

    it('does NOT render the chip when flag is false', () => {
      render(<ScoreBar value={18.11} />);
      expect(screen.queryByTestId('pre-calibration-chip')).not.toBeInTheDocument();
    });

    it('does NOT render the chip on an unscored row, even when flag is true', () => {
      render(<ScoreBar value={null} phase2Placeholder />);
      expect(screen.queryByTestId('pre-calibration-chip')).not.toBeInTheDocument();
    });
  });

  describe('null value handling', () => {
    it('marks the track as unscored', () => {
      render(<ScoreBar value={null} />);
      expect(screen.getByTestId('score-bar')).toHaveAttribute('data-unscored', 'true');
      expect(screen.getByTestId('score-bar-label')).toHaveTextContent('Not yet scored');
    });

    it('uses italic muted styling on the unscored label, never a 0', () => {
      render(<ScoreBar value={null} />);
      const label = screen.getByTestId('score-bar-label');
      expect(label).toHaveTextContent(/^Not yet scored$/);
      expect(label.className).toMatch(/italic/);
    });

    it('uses the unscored aria-label so screen readers do not say "0"', () => {
      render(<ScoreBar value={undefined} />);
      expect(screen.getByTestId('score-bar-track')).toHaveAttribute('aria-label', 'Not yet scored');
    });

    it('renders a transparent fill (greyed track only) when unscored', () => {
      render(<ScoreBar value={null} />);
      const fill = screen.getByTestId('score-bar-fill');
      expect(fill.style.backgroundColor).toBe('transparent');
    });
  });
});
