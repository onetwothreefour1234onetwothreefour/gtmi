import { describe, it, expect } from 'vitest';
import {
  isBulkApproveCandidate,
  matchesReviewTab,
  readProvenanceConfidence,
  relativeAge,
  reviewIdTag,
  sourceDomain,
} from './review-queue-helpers';

describe('readProvenanceConfidence', () => {
  it('returns null fields for non-object input', () => {
    expect(readProvenanceConfidence(null)).toEqual({
      extractionConfidence: null,
      validationConfidence: null,
      isValid: null,
    });
    expect(readProvenanceConfidence('nope')).toEqual({
      extractionConfidence: null,
      validationConfidence: null,
      isValid: null,
    });
  });

  it('reads numeric confidence fields', () => {
    expect(
      readProvenanceConfidence({
        extractionConfidence: 0.92,
        validationConfidence: 0.88,
        isValid: true,
      })
    ).toEqual({ extractionConfidence: 0.92, validationConfidence: 0.88, isValid: true });
  });

  it('coerces string-typed confidence values that postgres-js may return', () => {
    expect(
      readProvenanceConfidence({
        extractionConfidence: '0.9',
        validationConfidence: '0.85',
        isValid: false,
      })
    ).toEqual({ extractionConfidence: 0.9, validationConfidence: 0.85, isValid: false });
  });

  it('isValid stays null when not boolean (no silent coercion)', () => {
    expect(readProvenanceConfidence({ isValid: 'true' as unknown as boolean })).toEqual({
      extractionConfidence: null,
      validationConfidence: null,
      isValid: null,
    });
  });
});

describe('isBulkApproveCandidate', () => {
  it('passes when both confidences ≥ 0.85 and isValid is true', () => {
    expect(
      isBulkApproveCandidate({
        extractionConfidence: 0.86,
        validationConfidence: 0.85,
        isValid: true,
      })
    ).toBe(true);
  });

  it('passes when isValid is null (validation pending) but confidences clear the gate', () => {
    expect(
      isBulkApproveCandidate({
        extractionConfidence: 0.92,
        validationConfidence: 0.9,
        isValid: null,
      })
    ).toBe(true);
  });

  it('fails when extractionConfidence is below 0.85', () => {
    expect(
      isBulkApproveCandidate({
        extractionConfidence: 0.84,
        validationConfidence: 0.95,
        isValid: true,
      })
    ).toBe(false);
  });

  it('fails when validationConfidence is below 0.85', () => {
    expect(
      isBulkApproveCandidate({
        extractionConfidence: 0.99,
        validationConfidence: 0.7,
        isValid: true,
      })
    ).toBe(false);
  });

  it('fails when isValid is explicitly false', () => {
    expect(
      isBulkApproveCandidate({
        extractionConfidence: 0.99,
        validationConfidence: 0.99,
        isValid: false,
      })
    ).toBe(false);
  });

  it('fails closed when confidences are missing', () => {
    expect(
      isBulkApproveCandidate({
        extractionConfidence: null,
        validationConfidence: null,
        isValid: null,
      })
    ).toBe(false);
  });
});

describe('matchesReviewTab', () => {
  const HIGH = { extractionConfidence: 0.9, validationConfidence: 0.9, isValid: true };
  const MID = { extractionConfidence: 0.78, validationConfidence: 0.78, isValid: null };
  const LOW = { extractionConfidence: 0.6, validationConfidence: 0.6, isValid: null };

  it('"all" matches every status', () => {
    expect(matchesReviewTab('all', 'pending_review', LOW)).toBe(true);
    expect(matchesReviewTab('all', 'approved', HIGH)).toBe(true);
  });

  it('"pending" matches pending_review only', () => {
    expect(matchesReviewTab('pending', 'pending_review', LOW)).toBe(true);
    expect(matchesReviewTab('pending', 'approved', HIGH)).toBe(false);
  });

  it('"high-confidence" requires bulk-approve gate', () => {
    expect(matchesReviewTab('high-confidence', 'pending_review', HIGH)).toBe(true);
    expect(matchesReviewTab('high-confidence', 'pending_review', MID)).toBe(false);
    expect(matchesReviewTab('high-confidence', 'approved', HIGH)).toBe(false);
  });

  it('"flagged" matches pending rows with extractionConfidence < 0.7', () => {
    expect(matchesReviewTab('flagged', 'pending_review', LOW)).toBe(true);
    expect(matchesReviewTab('flagged', 'pending_review', MID)).toBe(false);
  });

  it('"in-review" matches the residual: pending, not high-confidence, not flagged', () => {
    expect(matchesReviewTab('in-review', 'pending_review', MID)).toBe(true);
    expect(matchesReviewTab('in-review', 'pending_review', HIGH)).toBe(false);
    expect(matchesReviewTab('in-review', 'pending_review', LOW)).toBe(false);
  });
});

describe('reviewIdTag', () => {
  it('produces the RV-XXXXXX shape', () => {
    expect(reviewIdTag('e1687f65-5959-469a-8615-d99ed20bac1b')).toMatch(/^RV-[0-9A-F]{6}$/);
  });

  it('is stable per id', () => {
    const id = 'b72e8153-6c3f-4c11-9a90-72cd7cc3c81d';
    expect(reviewIdTag(id)).toBe(reviewIdTag(id));
  });

  it('different ids produce different tags', () => {
    const a = reviewIdTag('e1687f65-5959-469a-8615-d99ed20bac1b');
    const b = reviewIdTag('b72e8153-6c3f-4c11-9a90-72cd7cc3c81d');
    expect(a).not.toBe(b);
  });

  it('fallbacks to RV-000000 for empty id', () => {
    expect(reviewIdTag('')).toBe('RV-000000');
  });
});

describe('sourceDomain', () => {
  it('strips protocol and www. prefix', () => {
    expect(sourceDomain('https://www.example.gov.au/visa-listing')).toBe('example.gov.au');
  });

  it('handles non-www domains', () => {
    expect(sourceDomain('https://immi.homeaffairs.gov.au/visas')).toBe('immi.homeaffairs.gov.au');
  });

  it('truncates long hosts', () => {
    expect(sourceDomain('https://very-long-subdomain-name.governmental-portal.example/x')).toMatch(
      /…$/
    );
  });

  it('returns dash for null / undefined / malformed input', () => {
    expect(sourceDomain(null)).toBe('—');
    expect(sourceDomain(undefined)).toBe('—');
    expect(sourceDomain('not a url')).toBe('—');
  });
});

describe('relativeAge', () => {
  const FROZEN = new Date('2026-04-29T12:00:00Z');

  it('renders minutes for sub-hour ages', () => {
    expect(relativeAge(new Date('2026-04-29T11:35:00Z'), FROZEN)).toBe('25m');
  });

  it('renders hours for ages between 1h and 48h', () => {
    expect(relativeAge(new Date('2026-04-29T07:00:00Z'), FROZEN)).toBe('5h');
    expect(relativeAge(new Date('2026-04-28T12:00:00Z'), FROZEN)).toBe('24h');
  });

  it('renders days for ages > 48h', () => {
    expect(relativeAge(new Date('2026-04-26T12:00:00Z'), FROZEN)).toBe('3d');
  });

  it('returns dash for null', () => {
    expect(relativeAge(null, FROZEN)).toBe('—');
  });

  it('returns dash for unparseable string', () => {
    expect(relativeAge('not a date', FROZEN)).toBe('—');
  });
});
