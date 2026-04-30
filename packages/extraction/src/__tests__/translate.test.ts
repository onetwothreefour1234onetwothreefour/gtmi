import { describe, expect, it } from 'vitest';
import {
  TRANSLATION_VERSION,
  getCountryDefaultLanguage,
  looksLikeNonEnglish,
} from '../utils/translate';

describe('looksLikeNonEnglish', () => {
  it('returns false for empty / short strings', () => {
    expect(looksLikeNonEnglish('')).toBe(false);
    expect(looksLikeNonEnglish('Hello world')).toBe(false);
    expect(looksLikeNonEnglish('Lorem ipsum dolor sit amet'.repeat(2))).toBe(false);
  });

  it('returns false for English text above the size threshold', () => {
    const english =
      'The minimum salary for the Highly Skilled Migrant Permit is set at EUR 5,331 per month for applicants under 30, and EUR 7,300 for applicants 30 or older. The IND publishes thresholds annually.'.repeat(
        2
      );
    expect(looksLikeNonEnglish(english)).toBe(false);
  });

  it('returns true for predominantly Japanese text', () => {
    const ja =
      '高度専門職とは、日本の経済成長に貢献する高度な能力を有する外国人を、ポイント制によって認定する在留資格です。出入国在留管理庁が運営しており、年収・学歴・職歴などのポイントが一定以上に達した申請者に対して付与されます。'.repeat(
        2
      );
    expect(looksLikeNonEnglish(ja)).toBe(true);
  });

  it('returns true for predominantly Arabic text', () => {
    const ar =
      'الإقامة الذهبية هي تأشيرة طويلة الأمد تتيح للأجانب وعائلاتهم العيش والعمل والدراسة في الإمارات العربية المتحدة دون الحاجة إلى كفيل وطني. تم إطلاقها لجذب المستثمرين والعلماء والمواهب الاستثنائية.'.repeat(
        2
      );
    expect(looksLikeNonEnglish(ar)).toBe(true);
  });

  it('returns false for mixed-language with majority ASCII (English wrapper around foreign nouns)', () => {
    const mixed =
      'The Highly Skilled Migrant scheme — kennismigrant in Dutch — is administered by the Immigratie- en Naturalisatiedienst (IND). Salary thresholds are published in EUR. Applicants must have a recognised employer.'.repeat(
        2
      );
    expect(looksLikeNonEnglish(mixed)).toBe(false);
  });
});

describe('getCountryDefaultLanguage', () => {
  it('returns "ja" for JPN', () => {
    expect(getCountryDefaultLanguage('JPN')).toBe('ja');
  });

  it('returns "nl" for NLD', () => {
    expect(getCountryDefaultLanguage('NLD')).toBe('nl');
  });

  it('returns "ar" for SAU', () => {
    expect(getCountryDefaultLanguage('SAU')).toBe('ar');
  });

  it('returns null for English-canonical countries (AUS, GBR, USA, NZL, IRL, SGP, HKG)', () => {
    expect(getCountryDefaultLanguage('AUS')).toBeNull();
    expect(getCountryDefaultLanguage('GBR')).toBeNull();
    expect(getCountryDefaultLanguage('USA')).toBeNull();
    expect(getCountryDefaultLanguage('NZL')).toBeNull();
    expect(getCountryDefaultLanguage('IRL')).toBeNull();
    expect(getCountryDefaultLanguage('SGP')).toBeNull();
    expect(getCountryDefaultLanguage('HKG')).toBeNull();
  });

  it('returns null for unknown ISO codes', () => {
    expect(getCountryDefaultLanguage('XYZ')).toBeNull();
  });
});

describe('TRANSLATION_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof TRANSLATION_VERSION).toBe('string');
    expect(TRANSLATION_VERSION.length).toBeGreaterThan(0);
  });
});
