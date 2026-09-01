import { describe, expect, it } from 'vitest';
import { parseRetryAfterMs, waitMsForAttempt } from './catalogExtractionRetry';

describe('parseRetryAfterMs', () => {
  it('parses Gemini retryDelay seconds', () => {
    expect(parseRetryAfterMs('{"error":{"details":[{"retryDelay":"27s"}]}}')).toBe(27_000);
    expect(parseRetryAfterMs('"retryDelay": "12.5s"')).toBe(12_500);
  });

  it('parses numeric ms and Retry-After seconds', () => {
    expect(parseRetryAfterMs(45000)).toBe(45_000);
    expect(parseRetryAfterMs('retry-after: 30')).toBe(30_000);
  });

  it('returns null for empty/invalid', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('no delay here')).toBeNull();
    expect(parseRetryAfterMs(0)).toBeNull();
  });
});

describe('waitMsForAttempt', () => {
  it('uses exponential backoff without hint', () => {
    expect(waitMsForAttempt(1, null)).toBe(15_000);
    expect(waitMsForAttempt(2, null)).toBe(30_000);
    expect(waitMsForAttempt(10, null)).toBe(90_000);
  });

  it('respects hint within bounds', () => {
    expect(waitMsForAttempt(1, 27_000)).toBe(27_000);
    expect(waitMsForAttempt(1, 5_000)).toBe(15_000);
    expect(waitMsForAttempt(1, 120_000)).toBe(90_000);
  });
});
