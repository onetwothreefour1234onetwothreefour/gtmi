// Phase 3.6.4 / FIX 1 — currency-detection tests.
//
// detectCurrency must:
//   - Recognise ISO-prefixed forms ("AUD 73,150", "SGD 3000") AND
//     symbol-prefixed forms ("A$", "S$", "HK$", "€", "£", …).
//   - Disambiguate bare "$" using the program's country_iso:
//       AUS → AUD, CAN → CAD, NZL → NZD, SGP → SGD, HKG → HKD, USA → USD.
//   - Return null for bare "$" with an unknown / unmapped country
//     (safer than guessing).
//   - Pass currencies whose symbol is unambiguous (€, £) without
//     country inference.

import { describe, expect, it } from 'vitest';
import { BARE_DOLLAR_COUNTRY_FALLBACK, detectCurrency } from '../utils/currency';

describe('detectCurrency — Phase 3.6.4 / FIX 1', () => {
  it('bare "$3,300" with country SGP → currency SGD, amount 3300', () => {
    const r = detectCurrency('$3,300', 'SGP');
    expect(r).not.toBeNull();
    expect(r!.code).toBe('SGD');
    expect(r!.stripped).toBe('3,300');
  });

  it('"AUD 73,150" → currency AUD, ISO path still works', () => {
    const r = detectCurrency('AUD 73,150');
    expect(r).not.toBeNull();
    expect(r!.code).toBe('AUD');
    expect(r!.stripped).toBe('73,150');
  });

  it('"€2,500" → currency EUR (unambiguous, no inference needed)', () => {
    const r = detectCurrency('€2,500');
    expect(r).not.toBeNull();
    expect(r!.code).toBe('EUR');
    expect(r!.stripped).toBe('2,500');
  });

  it('bare "$1,000" with unknown country → null (safe fallback)', () => {
    expect(detectCurrency('$1,000')).toBeNull();
    expect(detectCurrency('$1,000', 'XYZ')).toBeNull();
  });

  it('bare $ resolves correctly for every $-fallback country', () => {
    for (const [iso, expected] of Object.entries(BARE_DOLLAR_COUNTRY_FALLBACK)) {
      const r = detectCurrency('$100', iso);
      expect(r, `country ${iso}`).not.toBeNull();
      expect(r!.code, `country ${iso}`).toBe(expected);
      expect(r!.stripped).toBe('100');
    }
  });

  it('explicit ISO prefix wins over country inference', () => {
    // Even when the program is SGP, USD-prefixed value stays USD.
    const r = detectCurrency('USD 5,000', 'SGP');
    expect(r!.code).toBe('USD');
  });

  it('"A$73,150" with country GBR still resolves to AUD via the symbol', () => {
    const r = detectCurrency('A$73,150', 'GBR');
    expect(r!.code).toBe('AUD');
  });
});
