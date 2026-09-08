/**
 * Retry policy tests.
 *
 * These are pure-function tests with no network and no timers, which is the
 * whole reason the backoff schedule is deterministic. With jitter these
 * assertions would have to be range checks, and a range check cannot catch an
 * off-by-one in the exponent.
 */

import { describe, expect, it } from 'vitest';

import { backoffDelayMs, isRetryableStatus, retryAfterMs } from '../http/retry';

describe('isRetryableStatus', () => {
  it('retries 429, because that is the server asking us to wait', () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it('retries 5xx, because the fault is upstream and may be transient', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('does not retry 4xx other than 429', () => {
    // openFDA answers "no matches" with a 404. Retrying it four times turns one
    // wasted request into four and delays ingestion for nothing.
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('does not retry a success', () => {
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe('backoffDelayMs', () => {
  it('doubles from 500ms', () => {
    expect(backoffDelayMs(1)).toBe(500);
    expect(backoffDelayMs(2)).toBe(1000);
    expect(backoffDelayMs(3)).toBe(2000);
    expect(backoffDelayMs(4)).toBe(4000);
  });

  it('caps so a long outage cannot stall a worker for minutes', () => {
    expect(backoffDelayMs(20)).toBe(30_000);
  });
});

describe('retryAfterMs', () => {
  it('falls back to our own schedule when the header is absent', () => {
    expect(retryAfterMs(null, 2)).toBe(1000);
  });

  it('honours a Retry-After given in seconds', () => {
    // The server knows its own recovery time better than our schedule does.
    expect(retryAfterMs('7', 1)).toBe(7000);
  });

  it('caps a very long Retry-After', () => {
    expect(retryAfterMs('600', 1)).toBe(30_000);
  });

  it('honours a Retry-After given as an HTTP date', () => {
    const fiveSecondsAhead = new Date(Date.now() + 5000).toUTCString();

    const delay = retryAfterMs(fiveSecondsAhead, 1);

    // HTTP dates have one-second resolution, so allow a second of slack.
    expect(delay).toBeGreaterThan(3500);
    expect(delay).toBeLessThanOrEqual(6000);
  });

  it('falls back to our schedule when the header is unparseable', () => {
    expect(retryAfterMs('soon-ish', 3)).toBe(2000);
  });

  it('treats a past HTTP date as "retry now"', () => {
    const inThePast = new Date(Date.now() - 60_000).toUTCString();

    expect(retryAfterMs(inThePast, 1)).toBe(0);
  });
});
