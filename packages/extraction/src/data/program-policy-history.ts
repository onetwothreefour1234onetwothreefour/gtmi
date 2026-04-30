// Phase 3.9 / W20 — per-program curated policy-change history.
//
// E.1.1 (material policy changes in last 5 years, severity-weighted) is
// inherently per-program, not per-country: each visa programme has its
// own change history. The methodology weights changes as:
//
//   Major (eligibility / pathway change, abolition / reintroduction): 3
//   Moderate (quota / fee restructure):                                2
//   Minor  (inflation-only fee adjustment, form / portal update):      1
//
// Five-year window means changes dated 2021 or later (current year =
// 2026). Only material changes are counted; vague forward-looking
// statements ("we are reviewing") do not qualify per the methodology.
//
// Curation workflow:
//   1. Run a canary, look at the set of E.1.1 LLM_MISS rows.
//   2. For each programme, gather the change events from official
//      government communications, OECD migration outlooks, MPI
//      country profiles, and the programme's own news / changelog
//      page where one exists.
//   3. Normalise each event to a year + severity bucket + 1-line
//      description. The total severity sum becomes valueRaw.
//   4. Add an entry below.
//
// Empty by default. Programmes without an entry route through normal
// LLM extraction (which can succeed for programmes with explicit
// changelog pages). Country-agnostic: the mechanism keys off programId,
// not country code; the data lookup is per-program.
//
// HEADER NOTE — analyst review required:
// Severity classification involves judgement; entries below should be
// re-checked annually and on every major reform announcement. The
// `summary` array is for /review audit only; it is NOT used in the
// derived output (the sum is what scores).

export interface PolicyChangeEvent {
  year: number;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
}

export interface ProgramPolicyHistory {
  programId: string;
  programName: string;
  windowStartYear: number;
  windowEndYear: number;
  events: PolicyChangeEvent[];
  sourceUrl: string;
  notes?: string;
}

export const PROGRAM_POLICY_HISTORY: Record<string, ProgramPolicyHistory> = {
  // NLD — Highly Skilled Migrant (HSM) Permit
  '668cec08-4b78-4cd2-b215-3047c551ce6e': {
    programId: '668cec08-4b78-4cd2-b215-3047c551ce6e',
    programName: 'Highly Skilled Migrant (HSM) Permit',
    windowStartYear: 2021,
    windowEndYear: 2026,
    events: [
      {
        year: 2024,
        severity: 'major',
        description:
          'Salary thresholds significantly increased; recognised-sponsor monitoring tightened with stricter audit framework.',
      },
      {
        year: 2023,
        severity: 'minor',
        description: 'Annual indexation of normbedragen (salary thresholds) per Article 1d Wav.',
      },
      {
        year: 2022,
        severity: 'minor',
        description: 'Annual fee schedule update by IND.',
      },
    ],
    sourceUrl: 'https://ind.nl/en/residence-permits/work/highly-skilled-migrant',
    notes: 'Severity sum = 3+1+1 = 5. Re-check after IND fee schedule publication each January.',
  },
};

export function getProgramPolicyHistory(programId: string): ProgramPolicyHistory | null {
  return PROGRAM_POLICY_HISTORY[programId] ?? null;
}

export function severityWeight(s: 'major' | 'moderate' | 'minor'): number {
  switch (s) {
    case 'major':
      return 3;
    case 'moderate':
      return 2;
    case 'minor':
      return 1;
  }
}

/**
 * Sum the severity-weighted score across all events in the window.
 * Country-agnostic by construction: the function treats `events` as
 * opaque data; severity buckets and weights are methodology-defined.
 */
export function severitySum(history: ProgramPolicyHistory): number {
  return history.events.reduce((acc, e) => acc + severityWeight(e.severity), 0);
}
