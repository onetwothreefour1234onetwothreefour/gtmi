// Ordered most-specific first so "A$" matches before bare "$".
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

export function detectCurrency(valueRaw: string): { code: string; stripped: string } | null {
  for (const { code, re } of CURRENCY_PATTERNS) {
    if (re.test(valueRaw)) {
      return { code, stripped: valueRaw.replace(re, '') };
    }
  }
  return null;
}
