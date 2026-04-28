// Phase 3.6 / Fix D — annual-average FX rates (foreign currency → USD)
// for the cohort countries. Used by the derive stage to convert
// A.1.1 (salary threshold in local currency, preserved in
// `provenance.valueCurrency`) into USD before computing A.1.2 against
// `country-median-wage.ts`.
//
// Source: World Bank WDI series PA.NUS.FCRF (Official exchange rate, LCU
// per USD, period average). https://data.worldbank.org/indicator/PA.NUS.FCRF
//
// Each row gives the annual average rate for the year in which A.1.1 was
// extracted (typically the latest available year). For currencies pegged
// or quasi-pegged to USD the rate is the peg.
//
// Hand-curated; refresh annually alongside country-median-wage.ts.

export interface FxRate {
  /** ISO 4217 currency code. */
  code: string;
  /** Year the rate refers to (annual average). */
  year: number;
  /** Local currency units per 1 USD. */
  lcuPerUsd: number;
  sourceUrl: string;
}

export const FX_RATES: Record<string, FxRate> = {
  AUD: {
    code: 'AUD',
    year: 2024,
    lcuPerUsd: 1.518,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  CAD: {
    code: 'CAD',
    year: 2024,
    lcuPerUsd: 1.37,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  CHF: {
    code: 'CHF',
    year: 2024,
    lcuPerUsd: 0.88,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  CLP: {
    code: 'CLP',
    year: 2024,
    lcuPerUsd: 945.0,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  EUR: {
    code: 'EUR',
    year: 2024,
    lcuPerUsd: 0.924,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  GBP: {
    code: 'GBP',
    year: 2024,
    lcuPerUsd: 0.78,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  HKD: {
    code: 'HKD',
    year: 2024,
    lcuPerUsd: 7.8,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  ISK: {
    code: 'ISK',
    year: 2024,
    lcuPerUsd: 137.4,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  JPY: {
    code: 'JPY',
    year: 2024,
    lcuPerUsd: 151.0,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  MYR: {
    code: 'MYR',
    year: 2024,
    lcuPerUsd: 4.6,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  NAD: {
    code: 'NAD',
    year: 2024,
    lcuPerUsd: 18.5,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  NOK: {
    code: 'NOK',
    year: 2024,
    lcuPerUsd: 10.7,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  NZD: {
    code: 'NZD',
    year: 2024,
    lcuPerUsd: 1.65,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  OMR: {
    code: 'OMR',
    year: 2024,
    lcuPerUsd: 0.385,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  SEK: {
    code: 'SEK',
    year: 2024,
    lcuPerUsd: 10.6,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  SGD: {
    code: 'SGD',
    year: 2024,
    lcuPerUsd: 1.34,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  TWD: {
    code: 'TWD',
    year: 2024,
    lcuPerUsd: 32.2,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  USD: { code: 'USD', year: 2024, lcuPerUsd: 1.0, sourceUrl: 'self' },
  // Currencies pegged to USD or near-pegged.
  AED: {
    code: 'AED',
    year: 2024,
    lcuPerUsd: 3.6725,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  BHD: {
    code: 'BHD',
    year: 2024,
    lcuPerUsd: 0.376,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
  SAR: {
    code: 'SAR',
    year: 2024,
    lcuPerUsd: 3.75,
    sourceUrl: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
  },
};

export function getFxRate(code: string): FxRate | null {
  return FX_RATES[code.toUpperCase()] ?? null;
}

export function convertToUsd(amount: number, currencyCode: string): number | null {
  if (currencyCode === 'USD') return amount;
  const rate = getFxRate(currencyCode);
  if (!rate) return null;
  return amount / rate.lcuPerUsd;
}
