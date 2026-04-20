export interface CountryLevelSource {
  url: string;
  tier: 1 | 2;
  geographicLevel: 'global' | 'continental' | 'national';
  reason: string;
  fieldKeys: string[];
}

export const COUNTRY_LEVEL_SOURCES: CountryLevelSource[] = [
  {
    url: 'https://info.worldbank.org/governance/wgi/',
    tier: 1,
    geographicLevel: 'global',
    reason: 'Government effectiveness, rule of law scores by country',
    fieldKeys: ['E.3.2'],
  },
  {
    url: 'https://www.oecd.org/en/topics/policy-issues/international-migration.html',
    tier: 1,
    geographicLevel: 'global',
    reason: 'Policy stability, immigration trend data by country',
    fieldKeys: ['E.1.1'],
  },
  {
    url: 'https://www.imd.org/centers/wcc/world-competitiveness-center/rankings/world-talent-ranking/',
    tier: 1,
    geographicLevel: 'global',
    reason: 'Country-level talent competitiveness and appeal scores',
    fieldKeys: ['E.1.1', 'E.3.2'],
  },
  {
    url: 'https://www.migrationpolicy.org/programs/migration-data-hub',
    tier: 2,
    geographicLevel: 'global',
    reason: 'Cross-country immigration policy tracking and changes',
    fieldKeys: ['E.1.1'],
  },
];

export function getCountryLevelSources(fieldKey: string): CountryLevelSource[] {
  return COUNTRY_LEVEL_SOURCES.filter((s) => s.fieldKeys.includes(fieldKey));
}
