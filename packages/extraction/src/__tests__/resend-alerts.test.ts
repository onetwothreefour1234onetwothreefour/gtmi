import { describe, expect, it } from 'vitest';
import { filterEventsForRecipient, renderDigestBody } from '../utils/resend-alerts';
import type { DigestEvent } from '../utils/resend-alerts';

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

// Phase 3.10d / G.4 — per-recipient filtering.
describe('filterEventsForRecipient', () => {
  const SAMPLE: DigestEvent[] = [
    {
      programName: 'AUS-1',
      countryIso: 'AUS',
      fieldKey: 'A.1.1',
      severity: 'breaking',
      paqDelta: null,
      summaryText: null,
    },
    {
      programName: 'AUS-2',
      countryIso: 'AUS',
      fieldKey: 'B.1.1',
      severity: 'material',
      paqDelta: null,
      summaryText: null,
    },
    {
      programName: 'GBR-1',
      countryIso: 'GBR',
      fieldKey: 'D.1.1',
      severity: 'breaking',
      paqDelta: null,
      summaryText: null,
    },
    {
      programName: 'NLD-1',
      countryIso: 'NLD',
      fieldKey: 'A.2.1',
      severity: 'material',
      paqDelta: null,
      summaryText: null,
    },
  ];

  it('returns every event when both filters are null (env-fallback recipient)', () => {
    const out = filterEventsForRecipient(SAMPLE, {
      email: 'all@example.com',
      tenantId: null,
      severityFilter: null,
      countryIsoFilter: null,
      source: 'env',
    });
    expect(out).toHaveLength(SAMPLE.length);
  });

  it('honours severityFilter alone', () => {
    const out = filterEventsForRecipient(SAMPLE, {
      email: 'breaking@example.com',
      tenantId: null,
      severityFilter: ['breaking'],
      countryIsoFilter: null,
      source: 'table',
    });
    expect(out.map((e) => e.programName)).toEqual(['AUS-1', 'GBR-1']);
  });

  it('honours countryIsoFilter alone', () => {
    const out = filterEventsForRecipient(SAMPLE, {
      email: 'aus@example.com',
      tenantId: null,
      severityFilter: null,
      countryIsoFilter: ['AUS'],
      source: 'table',
    });
    expect(out.map((e) => e.programName)).toEqual(['AUS-1', 'AUS-2']);
  });

  it('combines both filters with AND', () => {
    const out = filterEventsForRecipient(SAMPLE, {
      email: 'aus-breaking@example.com',
      tenantId: 'tenant-1',
      severityFilter: ['breaking'],
      countryIsoFilter: ['AUS'],
      source: 'table',
    });
    expect(out.map((e) => e.programName)).toEqual(['AUS-1']);
  });

  it('returns [] when filters reject everything', () => {
    const out = filterEventsForRecipient(SAMPLE, {
      email: 'omn@example.com',
      tenantId: null,
      severityFilter: null,
      countryIsoFilter: ['OMN'],
      source: 'table',
    });
    expect(out).toEqual([]);
  });
});
