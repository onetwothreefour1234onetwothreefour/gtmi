import { describe, expect, it } from 'vitest';
import { renderDigestBody } from '../utils/resend-alerts';

// Phase 3.10c.6 — render-only tests for the Resend digest. Network +
// DB-coupled paths (sendDailyDigest, loadDigestEvents) are exercised
// in dev via the `policy-digest` Trigger.dev task with a stub
// RESEND_API_KEY.

describe('renderDigestBody', () => {
  it('reports a quiet day when there are no events', () => {
    const out = renderDigestBody([]);
    expect(out).toContain('No Material or Breaking');
  });

  it('groups by severity with Breaking first then Material', () => {
    const out = renderDigestBody([
      {
        programName: 'Skilled Worker Visa',
        countryIso: 'GBR',
        fieldKey: 'A.1.1',
        severity: 'breaking',
        paqDelta: '7.20',
        summaryText: 'Salary threshold raised £5k',
      },
      {
        programName: 'Tech.Pass',
        countryIso: 'SGP',
        fieldKey: 'B.2.1',
        severity: 'material',
        paqDelta: '2.10',
        summaryText: null,
      },
    ]);
    const breakingIdx = out.indexOf('BREAKING');
    const materialIdx = out.indexOf('MATERIAL');
    expect(breakingIdx).toBeGreaterThan(-1);
    expect(materialIdx).toBeGreaterThan(breakingIdx);
  });

  it('renders the ΔPAQ when present', () => {
    const out = renderDigestBody([
      {
        programName: 'Express Entry',
        countryIso: 'CAN',
        fieldKey: 'D.1.2',
        severity: 'material',
        paqDelta: '3.40',
        summaryText: 'Years to PR shortened',
      },
    ]);
    expect(out).toContain('ΔPAQ 3.40');
    expect(out).toContain('Years to PR shortened');
  });

  it('omits ΔPAQ line when null but still renders the row', () => {
    const out = renderDigestBody([
      {
        programName: 'NLD HSM',
        countryIso: 'NLD',
        fieldKey: 'D.3.3',
        severity: 'material',
        paqDelta: null,
        summaryText: null,
      },
    ]);
    expect(out).toContain('NLD');
    expect(out).toContain('D.3.3');
    expect(out).not.toContain('ΔPAQ');
  });

  it('counts events in the summary header', () => {
    const out = renderDigestBody([
      {
        programName: 'A',
        countryIso: 'AUS',
        fieldKey: 'A.1.1',
        severity: 'breaking',
        paqDelta: null,
        summaryText: null,
      },
      {
        programName: 'B',
        countryIso: 'AUS',
        fieldKey: 'A.2.1',
        severity: 'breaking',
        paqDelta: null,
        summaryText: null,
      },
      {
        programName: 'C',
        countryIso: 'AUS',
        fieldKey: 'B.1.1',
        severity: 'material',
        paqDelta: null,
        summaryText: null,
      },
    ]);
    expect(out).toContain('BREAKING (2)');
    expect(out).toContain('MATERIAL (1)');
  });
});
