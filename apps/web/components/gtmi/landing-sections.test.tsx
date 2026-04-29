import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroLanding } from './hero-landing';
import { ThisEdition } from './this-edition';
import { TopNav } from './top-nav';
import { GtmiFooter } from './gtmi-footer';
import { PreviewBanner } from './preview-banner';
import type { PolicyChangeRow } from '@/lib/queries/policy-changes';

const STATS = {
  programmesActive: 91,
  programmesTotal: 95,
  indicatorsTotal: 48,
  sourcesTotal: 312,
  coverageAvg: 0.628,
  lastVerifiedAt: '2026-04-29T11:30:00.000Z',
};

describe('HeroLanding', () => {
  it('renders the editorial headline with the oxblood "actually" emphasis', () => {
    render(<HeroLanding stats={STATS} cmePaqSplit={{ cme: 0.3, paq: 0.7 }} />);
    expect(screen.getByTestId('hero-actually')).toBeInTheDocument();
    expect(screen.getByTestId('hero-actually').tagName).toBe('EM');
  });

  it('renders five live-computed stat cells (no fabricated numbers)', () => {
    render(<HeroLanding stats={STATS} cmePaqSplit={{ cme: 0.3, paq: 0.7 }} />);
    const strip = screen.getByTestId('stats-strip');
    expect(strip).toHaveTextContent('91'); // programmesActive
    expect(strip).toHaveTextContent('48'); // indicatorsTotal
    expect(strip).toHaveTextContent('312'); // sourcesTotal
    expect(strip).toHaveTextContent('63%'); // coverageAvg rounded
    // Last updated formatted DD MMM YYYY.
    expect(strip).toHaveTextContent('29 APR 2026');
  });

  it('handles the empty cohort cleanly (zero programmes, zero coverage)', () => {
    render(
      <HeroLanding
        stats={{
          programmesActive: 0,
          programmesTotal: 0,
          indicatorsTotal: 48,
          sourcesTotal: 0,
          coverageAvg: 0,
          lastVerifiedAt: null,
        }}
        cmePaqSplit={{ cme: 0.3, paq: 0.7 }}
      />
    );
    const strip = screen.getByTestId('stats-strip');
    expect(strip).toHaveTextContent('0%');
    expect(strip).toHaveTextContent('—');
  });

  it('surfaces the methodology-driven CME/PAQ split (not hardcoded)', () => {
    render(<HeroLanding stats={STATS} cmePaqSplit={{ cme: 0.4, paq: 0.6 }} />);
    expect(screen.getByLabelText(/CME 40%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/PAQ 60%/)).toBeInTheDocument();
  });
});

describe('ThisEdition', () => {
  it('renders the empty-state copy when no policy changes exist (Phase 4 reality)', () => {
    render(<ThisEdition events={[]} />);
    expect(screen.getByTestId('this-edition')).toHaveTextContent('Awaiting Phase 5');
  });

  it('shows up to 3 most-recent policy changes when populated', () => {
    const sample: PolicyChangeRow = {
      id: 'pc-1',
      detectedAt: '2026-04-15T00:00:00.000Z',
      severity: 'material',
      programId: 'prog-1',
      programName: 'Tech.Pass',
      countryIso: 'SGP',
      countryName: 'Singapore',
      fieldKey: 'A.04',
      fieldLabel: 'Quota',
      pillar: 'A',
      summary: 'Quota raised from 1,200 to 1,800.',
      paqDelta: 1.4,
      waybackUrl: null,
    };
    const events = Array.from({ length: 5 }, (_, i) => ({ ...sample, id: `pc-${i}` }));
    render(<ThisEdition events={events} />);
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);
  });

  it('does NOT render mock entries when events array is empty', () => {
    render(<ThisEdition events={[]} />);
    // No mocked programmes (CHE, SGP Tech.Pass etc) appear.
    expect(screen.queryByText(/Tech\.Pass/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quota raised/)).not.toBeInTheDocument();
  });
});

describe('TopNav', () => {
  it('renders all primary nav items', () => {
    render(<TopNav />);
    expect(screen.getByText('Rankings')).toBeInTheDocument();
    expect(screen.getByText('Programmes')).toBeInTheDocument();
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('marks the active route with aria-current=page', () => {
    render(<TopNav active="methodology" />);
    expect(screen.getByText('Methodology')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Rankings')).not.toHaveAttribute('aria-current');
  });
});

describe('GtmiFooter', () => {
  it('renders the four nav columns and the primary-source strip', () => {
    render(<GtmiFooter lastVerifiedAt={STATS.lastVerifiedAt} />);
    const footer = screen.getByTestId('gtmi-footer');
    for (const title of ['The Index', 'Methodology', 'Transparency', 'TTR Group']) {
      expect(footer).toHaveTextContent(title);
    }
    expect(footer).toHaveTextContent('Primary data sources');
    expect(footer).toHaveTextContent('29 APR 2026');
  });

  it('falls back to "Continuously updated" when no last-verified is supplied', () => {
    render(<GtmiFooter lastVerifiedAt={null} />);
    expect(screen.getByTestId('gtmi-footer')).toHaveTextContent('Continuously updated');
  });
});

describe('PreviewBanner', () => {
  it('renders the canonical body when no override is passed', () => {
    render(<PreviewBanner />);
    const banner = screen.getByTestId('preview-banner');
    expect(banner).toHaveTextContent('Preview release');
    expect(banner).toHaveTextContent('engineer-chosen normalization ranges');
  });

  it('renders an HTML override when bodyHtml is supplied', () => {
    render(<PreviewBanner bodyHtml="<span>custom</span>" />);
    expect(screen.getByTestId('preview-banner')).toHaveTextContent('custom');
  });
});
