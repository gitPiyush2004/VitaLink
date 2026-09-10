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
 *
 * **The backoff never undercuts the source's own published rate limit.** This one
 * was found by running it: GDELT publishes one request every five seconds, and
 * the 500ms first retry meant a 429 was answered by another request 500ms later,
 * which 429'd, then 1s, then 2s — four requests in 3.5 seconds against a
 * five-second limit, all four guaranteed to fail. The backoff schedule now starts
 * at the source's own interval when one is known. See `floorMs` below.
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

/**
 * 500ms, 1s, 2s, 4s ... capped. Deterministic, so a test can assert the schedule.
 *
 * @param floorMs the source's own published minimum interval, when it has one.
 *   The schedule starts here instead of at 500ms, because a retry sooner than
 *   the server's stated limit is a request you have already been told will fail.
 */
export function backoffDelayMs(attempt: number, floorMs = 0): number {
  const base = Math.max(BASE_DELAY_MS, floorMs);
  return Math.min(base * BACKOFF_FACTOR ** (attempt - 1), MAX_DELAY_MS);
}

/**
 * Honours `Retry-After` when the server sends one, because the server knows
 * better than our schedule does. Accepts both the seconds and the HTTP-date
 * forms, and falls back to our own backoff if the header is unparseable.
 */
export function retryAfterMs(headerValue: string | null, attempt: number, floorMs = 0): number {
  if (headerValue === null) return backoffDelayMs(attempt, floorMs);

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    // Still floored: a server that sends `Retry-After: 0` while publishing a
    // five-second limit is contradicting itself, and the limit is the safer
    // reading of the two.
    return Math.min(Math.max(seconds * MS_PER_SECOND, floorMs), MAX_DELAY_MS);
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), floorMs), MAX_DELAY_MS);
  }

  return backoffDelayMs(attempt, floorMs);
}

export type RetryContext = {
  sleeper: Sleeper;
  logger: ConnectorLogger;
  maxAttempts: number;
  /** The source's published minimum interval. The backoff never goes below it. */
  minIntervalMs?: number;
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

  const floorMs = context.minIntervalMs ?? 0;
  const delayMs =
    reason.retryAfter === undefined
      ? backoffDelayMs(attempt, floorMs)
      : retryAfterMs(reason.retryAfter, attempt, floorMs);

  context.logger.warn(
    { source: reason.sourceId, attempt, delayMs, detail: reason.detail },
    'upstream request failed; retrying',
  );

  await context.sleeper.sleep(delayMs);
  return true;
}
