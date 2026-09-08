/**
 * Retry policy: exponential backoff on 429 and 5xx, and nothing else.
 *
 * Two decisions worth defending.
 *
 * **No jitter.** The conventional advice is to add randomness so that many
 * clients recovering from an outage do not synchronise. Two reasons it is absent
 * here: the data covenant forbids a random number generator in runtime code
 * (spec appendix), and there is nothing to de-correlate — ingestion runs as a
 * single worker per queue, behind a per-source rate limiter that already spaces
 * requests. Jitter would buy nothing and cost the reproducibility that makes a
 * retry test deterministic. If Vitalink ever ran many ingestion replicas, the
 * honest fix is a seeded PRNG whose seed is stored, not `Math.random()`.
 * Recorded as ADR-0008.
 *
 * **4xx is not retried.** A 400 or a 404 will fail identically on the second
 * attempt; retrying it only turns one wasted request into four. The exception is
 * 429, which is the server explicitly asking us to wait.
 */

import type { ConnectorLogger, Sleeper } from './ports';

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_FLOOR = 500;
const MS_PER_SECOND = 1000;

export const DEFAULT_MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;
const BACKOFF_FACTOR = 2;
/** Thirty seconds. Caps a long Retry-After so it cannot stall a worker. */
const MAX_DELAY_MS = 30_000;

export function isRetryableStatus(status: number): boolean {
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_FLOOR;
}

/** 500ms, 1s, 2s, 4s ... capped. Deterministic, so a test can assert the schedule. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * BACKOFF_FACTOR ** (attempt - 1), MAX_DELAY_MS);
}

/**
 * Honours `Retry-After` when the server sends one, because the server knows
 * better than our schedule does. Accepts both the seconds and the HTTP-date
 * forms, and falls back to our own backoff if the header is unparseable.
 */
export function retryAfterMs(headerValue: string | null, attempt: number): number {
  if (headerValue === null) return backoffDelayMs(attempt);

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * MS_PER_SECOND, MAX_DELAY_MS);
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 0), MAX_DELAY_MS);
  }

  return backoffDelayMs(attempt);
}

export type RetryContext = {
  sleeper: Sleeper;
  logger: ConnectorLogger;
  maxAttempts: number;
};

/**
 * Waits before the next attempt, or returns false when the attempts are spent.
 *
 * Written as "should I try again, and if so wait first" rather than as a wrapper
 * that takes a callback, because the caller needs to distinguish a retryable
 * HTTP status from a thrown network error and handle each differently.
 */
export async function waitBeforeRetry(
  context: RetryContext,
  attempt: number,
  reason: { sourceId: string; detail: string; retryAfter?: string | null },
): Promise<boolean> {
  if (attempt >= context.maxAttempts) return false;

  const delayMs =
    reason.retryAfter === undefined
      ? backoffDelayMs(attempt)
      : retryAfterMs(reason.retryAfter, attempt);

  context.logger.warn(
    { source: reason.sourceId, attempt, delayMs, detail: reason.detail },
    'upstream request failed; retrying',
  );

  await context.sleeper.sleep(delayMs);
  return true;
}
