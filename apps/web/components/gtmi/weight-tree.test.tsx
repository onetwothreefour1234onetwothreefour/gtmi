import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeightTree } from './weight-tree';
import type { MethodologyPillar } from '@/lib/queries/methodology-current-types';
import type { PillarKey } from '@/lib/theme';

function makeIndicator(
  key: string,
  label: string,
  weight: number,
  pillar: PillarKey,
  subFactor: string
) {
  return {
    key,
    label,
    pillar,
    subFactor,
    weightWithinSubFactor: weight,
    dataType: 'numeric' as const,
    normalizationFn: 'min_max',
    direction: 'higher_is_better',
    sourceTierRequired: 1,
  };
}

const PILLARS_V1: MethodologyPillar[] = [
  {
    key: 'A',
    weightWithinPaq: 0.28,
    indicatorCount: 9,
    subFactors: [
      {
        code: 'A.1',
        weightWithinPillar: 0.5,
        indicators: [
          makeIndicator('A.1.1', 'Salary as % of median', 0.25, 'A', 'A.1'),
          makeIndicator('A.1.2', 'Education floor', 0.2, 'A', 'A.1'),
          makeIndicator('A.1.3', 'Experience floor', 0.2, 'A', 'A.1'),
          makeIndicator('A.1.4', 'Language test', 0.2, 'A', 'A.1'),
          makeIndicator('A.1.5', 'Age cap', 0.15, 'A', 'A.1'),
        ],
      },
      {
        code: 'A.2',
        weightWithinPillar: 0.3,
        indicators: [
          makeIndicator('A.2.1', 'Mandatory criteria count', 0.35, 'A', 'A.2'),
          makeIndicator('A.2.2', 'System type', 0.4, 'A', 'A.2'),
          makeIndicator('A.2.3', 'Track count', 0.25, 'A', 'A.2'),
        ],
      },
      {
        code: 'A.3',
        weightWithinPillar: 0.2,
        indicators: [makeIndicator('A.3.1', 'Quota', 1.0, 'A', 'A.3')],
      },
    ],
  },
  {
    key: 'B',
    weightWithinPaq: 0.15,
    indicatorCount: 7,
    subFactors: [
      { code: 'B.1', weightWithinPillar: 0.3, indicators: [] },
      { code: 'B.2', weightWithinPillar: 0.2, indicators: [] },
      { code: 'B.3', weightWithinPillar: 0.3, indicators: [] },
      { code: 'B.4', weightWithinPillar: 0.2, indicators: [] },
    ],
  },
  {
    key: 'C',
    weightWithinPaq: 0.2,
    indicatorCount: 10,
    subFactors: [{ code: 'C.1', weightWithinPillar: 1, indicators: [] }],
  },
  {
    key: 'D',
    weightWithinPaq: 0.22,
    indicatorCount: 11,
    subFactors: [{ code: 'D.1', weightWithinPillar: 1, indicators: [] }],
  },
  {
    key: 'E',
    weightWithinPaq: 0.15,
    indicatorCount: 8,
    subFactors: [{ code: 'E.1', weightWithinPillar: 1, indicators: [] }],
  },
];

describe('WeightTree', () => {
  it('exposes role="tree" with an aria-label', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    const tree = screen.getByTestId('weight-tree');
    expect(tree).toHaveAttribute('role', 'tree');
    expect(tree).toHaveAttribute('aria-label', 'Methodology weight tree');
  });

  it('renders all five pillar nodes', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    for (const k of ['A', 'B', 'C', 'D', 'E'] as const) {
      expect(screen.getByTestId(`weight-tree-pillar-${k}`)).toBeInTheDocument();
    }
  });

  it('renders the CME and PAQ branches at the correct percentages', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    const cme = screen.getByTestId('weight-tree-cme');
    const paq = screen.getByTestId('weight-tree-paq');
    expect(cme).toHaveAttribute('aria-label', expect.stringContaining('30.0%'));
    expect(paq).toHaveAttribute('aria-label', expect.stringContaining('70.0%'));
  });

  it('respects custom CME / PAQ split', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.4, paq: 0.6 }} pillars={PILLARS_V1} />);
    expect(screen.getByTestId('weight-tree-cme')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('40.0%')
    );
    expect(screen.getByTestId('weight-tree-paq')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('60.0%')
    );
  });

  it('pillar weights sum (with CME) to 100% of the composite', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    const paqPct = 70;
    const total = PILLARS_V1.reduce((s, p) => s + p.weightWithinPaq * paqPct, 0) + 30; // CME share
    expect(total).toBeCloseTo(100, 5);
  });

  it('renders the indicator count per pillar in the aria-label', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    const a = screen
      .getByTestId('weight-tree-pillar-A')
      .querySelector('[role="treeitem"]') as HTMLElement;
    expect(a).toHaveAttribute('aria-label', expect.stringContaining('9 indicators'));
    const b = screen
      .getByTestId('weight-tree-pillar-B')
      .querySelector('[role="treeitem"]') as HTMLElement;
    expect(b).toHaveAttribute('aria-label', expect.stringContaining('7 indicators'));
  });

  it('renders sub-factor nodes for each pillar', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    for (const code of ['A.1', 'A.2', 'A.3', 'B.1', 'B.2', 'B.3', 'C.1', 'D.1', 'E.1']) {
      expect(screen.getByTestId(`weight-tree-subfactor-${code}`)).toBeInTheDocument();
    }
  });

  it('does NOT render indicator leaves by default', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    expect(screen.queryByTestId('weight-tree-indicator-A.1.1')).not.toBeInTheDocument();
  });

  it('renders indicator leaves when showIndicators=true', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} showIndicators />);
    expect(screen.getByTestId('weight-tree-indicator-A.1.1')).toBeInTheDocument();
    expect(screen.getByTestId('weight-tree-indicator-A.3.1')).toBeInTheDocument();
  });

  it('emits a treeitem with aria-level for each level (root=1, branch=2, pillar=3, subfactor=4)', () => {
    render(<WeightTree cmePaqSplit={{ cme: 0.3, paq: 0.7 }} pillars={PILLARS_V1} />);
    const treeItems = screen.getAllByRole('treeitem');
    const levels = new Set(treeItems.map((el) => el.getAttribute('aria-level')));
    expect(levels.has('1')).toBe(true);
    expect(levels.has('2')).toBe(true);
    expect(levels.has('3')).toBe(true);
    expect(levels.has('4')).toBe(true);
  });
});
