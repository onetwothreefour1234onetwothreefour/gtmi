import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureException, captureMessage } from '../utils/error-reporter';

// Phase 3.10d / K.2 — smoke tests for the structured-log fallback.
// The Sentry-loaded path is exercised at runtime when SENTRY_DSN is
// set; we don't set the DSN in tests so every call here goes through
// emitStructuredError → console.error, which we spy on.

describe('error-reporter (structured-log fallback)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captureException emits a structured JSON line on stderr', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureException(new Error('boom'), { tags: { stage: 'test' }, extra: { fieldKey: 'A.1.1' } });
    expect(errSpy).toHaveBeenCalledOnce();
    const line = errSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe('error.captured');
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('boom');
    expect(parsed.tags).toEqual({ stage: 'test' });
    expect(parsed.extra).toEqual({ fieldKey: 'A.1.1' });
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('captureMessage defaults to warning level', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureMessage('rate limit hit');
    const parsed = JSON.parse(errSpy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('warning');
    expect(parsed.message).toBe('rate limit hit');
  });

  it('captureMessage respects an explicit level', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureMessage('partial outage', 'error');
    const parsed = JSON.parse(errSpy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('error');
  });

  it('captureException tolerates non-Error inputs', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureException('just a string');
    const parsed = JSON.parse(errSpy.mock.calls[0]![0] as string);
    expect(parsed.message).toBe('just a string');
    expect(parsed.name).toBe('Error');
  });
});
