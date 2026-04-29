// Currency detection for numeric LLM extractions.
//
// Pattern table is ordered most-specific first so prefixed forms ("A$",
// "S$", "HK$", etc.) win before the bare "$" fallback. Bare "$" is
// ambiguous across multiple "dollar" jurisdictions (AUS, CAD, NZD, SGD,
// HKD, USD all use it); when the prefix is bare we fall back to the
// program's `country_iso` to disambiguate.
//
// Phase 3.6.4 / FIX 1 — bare-$ inference. Without this, A.1.1 raw
// values like "$3,300" (S Pass) leave provenance.valueCurrency null,
// which causes deriveA12 to skip with "A.1.1 has no valueCurrency".

const CURRENCY_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: 'AUD', re: /^(?:AUD|A\$)\s*/i },
  { code: 'SGD', re: /^(?:SGD|S\$)\s*/i },
  { code: 'HKD', re: /^(?:HKD|HK\$)\s*/i },
  { code: 'NZD', re: /^(?:NZD|NZ\$)\s*/i },
  { code: 'CAD', re: /^(?:CAD|C\$)\s*/i },
  { code: 'USD', re: /^(?:USD|US\$)\s*/i },
  { code: 'EUR', re: /^(?:EUR|€)\s*/i },
  { code: 'GBP', re: /^(?:GBP|£)\s*/i },
  { code: 'JPY', re: /^(?:JPY|¥)\s*/i },
  { code: 'INR', re: /^(?:INR|₹)\s*/i },
  { code: 'AED', re: /^AED\s*/i },
  { code: 'SAR', re: /^SAR\s*/i },
  { code: 'QAR', re: /^QAR\s*/i },
  { code: 'MYR', re: /^(?:MYR|RM)\s*/i },
  { code: 'THB', re: /^(?:THB|฿)\s*/i },
  { code: 'CHF', re: /^CHF\s*/i },
  { code: 'SEK', re: /^SEK\s*/i },
  { code: 'DKK', re: /^DKK\s*/i },
  { code: 'NOK', re: /^NOK\s*/i },
];

const BARE_DOLLAR_RE = /^\$\s*/;

/**
 * ISO 4217 fallback for bare-`$` extractions, keyed on the program's
 * `country_iso`. Only $-using cohort countries are mapped. For any
 * country not in this map, bare-`$` resolves to `null` (safer than
 * guessing); the analyst can correct at /review.
 */
export const BARE_DOLLAR_COUNTRY_FALLBACK: Record<string, string> = {
  AUS: 'AUD',
  CAN: 'CAD',
  NZL: 'NZD',
  SGP: 'SGD',
  HKG: 'HKD',
  USA: 'USD',
};

export function detectCurrency(
  valueRaw: string,
  countryIso?: string
): { code: string; stripped: string } | null {
  for (const { code, re } of CURRENCY_PATTERNS) {
    if (re.test(valueRaw)) {
      return { code, stripped: valueRaw.replace(re, '') };
    }
  }
  // Phase 3.6.4 / FIX 1 — bare-$ infers currency from country_iso.
  // Unknown country (or country not in the $-fallback map) → null.
  if (BARE_DOLLAR_RE.test(valueRaw) && countryIso) {
    const fallback = BARE_DOLLAR_COUNTRY_FALLBACK[countryIso];
    if (fallback) {
      return { code: fallback, stripped: valueRaw.replace(BARE_DOLLAR_RE, '') };
    }
  }
  return null;
}
