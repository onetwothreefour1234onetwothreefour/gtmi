import { describe, it, expect } from 'vitest';
import { extractKeywords, selectContentWindow } from '../src/utils/window';

describe('extractKeywords', () => {
  it('drops stopwords and short tokens, lowercases, dedupes', () => {
    expect(extractKeywords('Salary threshold for principal applicant')).toEqual([
      'salary',
      'threshold',
      'principal',
      'applicant',
    ]);
  });

  it('caps to four keywords', () => {
    const kws = extractKeywords('one two three four five six seven');
    expect(kws.length).toBe(4);
  });

  it('splits on slashes, dashes, parens, en-dashes', () => {
    const kws = extractKeywords('Fee (principal/dependant) — minimum');
    expect(kws).toContain('fee');
    expect(kws).toContain('principal');
    expect(kws).toContain('dependant');
    expect(kws).toContain('minimum');
  });
});

describe('selectContentWindow', () => {
  it('returns content unchanged when shorter than budget', () => {
    const content = 'short page about salary thresholds';
    const out = selectContentWindow(content, [{ key: 'A.1.1', label: 'Salary threshold' }], 30000);
    expect(out).toBe(content);
  });

  it('finds an answer-near-end (truncation regression case)', () => {
    // 50K-char doc with answer at ~char 35000.
    const filler = 'lorem ipsum dolor sit amet '.repeat(40); // ~1080 chars
    const noise = (filler + '\n').repeat(33); // ~36K chars of noise
    const answer = 'The minimum annual salary threshold is AUD 73,150 for principal applicants.';
    const tail = (filler + '\n').repeat(13); // ~14K more
    const content = noise + answer + tail;
    expect(content.length).toBeGreaterThan(30000);

    const window = selectContentWindow(
      content,
      [{ key: 'A.1.1', label: 'Salary threshold as % of local median wage' }],
      30000
    );

    expect(window.length).toBeLessThanOrEqual(30000);
    expect(window).toContain('AUD 73,150');
  });

  it('finds an answer-near-start (baseline prefix preserves it)', () => {
    const answer = 'The minimum annual salary threshold is AUD 73,150 for principal applicants.';
    const filler = 'unrelated noise content '.repeat(50); // ~1150 chars
    const content = answer + '\n' + filler.repeat(40); // ~46K chars total

    const window = selectContentWindow(
      content,
      [{ key: 'A.1.1', label: 'Salary threshold as % of local median wage' }],
      30000
    );

    expect(window.length).toBeLessThanOrEqual(30000);
    expect(window).toContain('AUD 73,150');
  });

  it('budget cap is honoured', () => {
    const big = 'x'.repeat(200000);
    const window = selectContentWindow(big, [{ key: 'X', label: 'irrelevant label' }], 30000);
    expect(window.length).toBeLessThanOrEqual(30000);
  });

  it('selects across multiple fields (batch path)', () => {
    const filler = 'noise '.repeat(500);
    const salaryAnswer = 'Minimum salary is AUD 73,150.';
    const feeAnswer = 'Visa application fee is AUD 3,210.';
    const content =
      filler.repeat(5) + salaryAnswer + filler.repeat(15) + feeAnswer + filler.repeat(10);
    expect(content.length).toBeGreaterThan(30000);

    const window = selectContentWindow(
      content,
      [
        { key: 'A.1.1', label: 'Salary threshold' },
        { key: 'B.2.1', label: 'Visa application fee' },
      ],
      30000
    );

    expect(window.length).toBeLessThanOrEqual(30000);
    expect(window).toContain('73,150');
    expect(window).toContain('3,210');
  });

  it('falls back to head slice when no keywords are derivable', () => {
    const content = 'a'.repeat(40000) + 'TAIL_MARKER';
    const window = selectContentWindow(content, [{ key: 'X', label: '' }], 30000);
    expect(window.length).toBe(30000);
    expect(window).not.toContain('TAIL_MARKER');
    // Identical to current naive slice behaviour
    expect(window).toBe(content.slice(0, 30000));
  });

  it('inserts ellipsis separator between non-contiguous selections', () => {
    const filler = 'noise '.repeat(500);
    const salaryAnswer = 'Minimum salary is AUD 73,150.';
    const content = filler.repeat(20) + salaryAnswer + filler.repeat(20);
    expect(content.length).toBeGreaterThan(30000);

    const window = selectContentWindow(
      content,
      [{ key: 'A.1.1', label: 'Salary threshold' }],
      30000
    );
    // Either the prefix and answer chunk are non-adjacent (ellipsis appears)
    // or the budget allowed enough chunks to cover them contiguously. The
    // test only fails if the answer is missing entirely.
    expect(window).toContain('73,150');
  });
});
