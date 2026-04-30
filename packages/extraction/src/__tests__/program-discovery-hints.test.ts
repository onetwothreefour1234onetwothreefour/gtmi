import { describe, expect, it } from 'vitest';
import {
  PROGRAM_DISCOVERY_HINTS,
  getProgramDiscoveryHint,
  renderProgramDiscoveryHint,
} from '../data/program-discovery-hints';
import { buildUserMessage } from '../stages/discover';

const NLD_HSM_ID = '668cec08-4b78-4cd2-b215-3047c551ce6e';
const JPN_HSP_ID = 'a9f779f7-4384-420d-affe-ba269c87108e';
const UNKNOWN_PROGRAM_ID = '00000000-0000-0000-0000-000000000000';

describe('program-discovery-hints lookup', () => {
  it('seeded entries are well-formed', () => {
    for (const [id, entry] of Object.entries(PROGRAM_DISCOVERY_HINTS)) {
      expect(entry.programId, `${id} missing programId`).toBe(id);
      expect(entry.programName, `${id} missing programName`).toBeTruthy();
      expect(entry.hint, `${id} missing hint`).toBeTruthy();
      expect(entry.hint.length, `${id} hint too short`).toBeGreaterThan(80);
    }
  });

  it('NLD HSM hint references IND + Belastingdienst', () => {
    const e = getProgramDiscoveryHint(NLD_HSM_ID);
    expect(e).not.toBeNull();
    expect(e!.hint).toContain('ind.nl');
    expect(e!.hint).toContain('belastingdienst.nl');
  });

  it('JPN HSP hint references ISA + NTA + MOJ', () => {
    const e = getProgramDiscoveryHint(JPN_HSP_ID);
    expect(e).not.toBeNull();
    expect(e!.hint).toContain('isa.go.jp');
    expect(e!.hint).toContain('nta.go.jp');
    expect(e!.hint).toContain('moj.go.jp');
  });

  it('returns null for unknown programIds', () => {
    expect(getProgramDiscoveryHint(UNKNOWN_PROGRAM_ID)).toBeNull();
  });
});

describe('renderProgramDiscoveryHint', () => {
  it('renders a PROGRAMME-SPECIFIC HINT block for known programs', () => {
    const block = renderProgramDiscoveryHint(NLD_HSM_ID);
    expect(block).toContain('PROGRAMME-SPECIFIC HINT');
    expect(block).toContain('Highly Skilled Migrant');
    expect(block).toContain('ind.nl');
  });

  it('returns the empty string for unknown programs', () => {
    expect(renderProgramDiscoveryHint(UNKNOWN_PROGRAM_ID)).toBe('');
  });
});

describe('buildUserMessage W5 hint integration', () => {
  it('inlines the per-program hint when programId is supplied', () => {
    const msg = buildUserMessage('HSM Permit', 'NLD', [], { programId: NLD_HSM_ID });
    expect(msg).toContain('PROGRAMME-SPECIFIC HINT');
    expect(msg).toContain('belastingdienst.nl');
  });

  it('skips the hint block when programId is omitted', () => {
    const msg = buildUserMessage('HSM Permit', 'NLD');
    expect(msg).not.toContain('PROGRAMME-SPECIFIC HINT');
  });

  it('skips the hint block when programId is unknown', () => {
    const msg = buildUserMessage('Unknown Visa', 'NLD', [], { programId: UNKNOWN_PROGRAM_ID });
    expect(msg).not.toContain('PROGRAMME-SPECIFIC HINT');
    // The W3 country-department block still renders (NLD is mapped).
    expect(msg).toContain('belastingdienst.nl');
  });

  it('renders alongside W3 + W4 blocks without conflict', () => {
    const msg = buildUserMessage('HSP Visa', 'JPN', [], { programId: JPN_HSP_ID });
    expect(msg).toContain('COUNTRY-SPECIFIC AUTHORITY HOSTNAMES'); // W3
    expect(msg).toContain('NATIVE-LANGUAGE ACCEPTANCE'); // W4
    expect(msg).toContain('PROGRAMME-SPECIFIC HINT'); // W5
  });
});
