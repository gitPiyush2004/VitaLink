/**
 * Per-source request spacing.
 *
 * The model is deliberately the simplest one that satisfies the strictest policy
 * we have to obey: keep at least `minIntervalMs` between two requests to the
 * same source. Nominatim's usage policy is an absolute one request per second,
 * and a token bucket that allows a burst would violate it on the first burst.
 *
 * Requests to the same source are serialised through a promise chain, so two
 * concurrent callers queue rather than race. Requests to *different* sources do
 * not block each other, which matters because the ingestion worker fans out
 * across a dozen sources at once.
 *
 * Known limitation, and it is a real one: this is in-process. Two worker
 * containers would each get their own allowance. That is acceptable today
 * because ingestion runs as a single worker per queue, and the honest fix is
 * recorded in ADR-0007 — move the last-request timestamp into Redis, which is
 * already a dependency.
 */

import type { Clock, Sleeper } from './ports';

export type RateLimiter = {
  /** Resolves when it is this caller's turn to hit `sourceId`. */
  acquire(sourceId: string, minIntervalMs: number): Promise<void>;
};

export function createRateLimiter(clock: Clock, sleeper: Sleeper): RateLimiter {
  /** The tail of the promise chain per source. Awaiting it means "wait your turn". */
  const queues = new Map<string, Promise<void>>();
  const lastRequestAtMs = new Map<string, number>();

  async function waitTurn(sourceId: string, minIntervalMs: number): Promise<void> {
    const last = lastRequestAtMs.get(sourceId);
    const nowMs = clock.now().getTime();

    if (last !== undefined) {
      const elapsed = nowMs - last;
      if (elapsed < minIntervalMs) {
        await sleeper.sleep(minIntervalMs - elapsed);
      }
    }

    lastRequestAtMs.set(sourceId, clock.now().getTime());
  }

  return {
    acquire(sourceId: string, minIntervalMs: number): Promise<void> {
      // Chain onto whatever is already queued for this source. `.then` rather
      // than `await` so the map is updated synchronously and a second caller
      // arriving in the same tick chains behind this one rather than beside it.
      const previous = queues.get(sourceId) ?? Promise.resolve();
      const next = previous.then(() => waitTurn(sourceId, minIntervalMs));

      // A rejected link must not poison the chain for every later caller.
      queues.set(
        sourceId,
        next.catch(() => undefined),
      );

      return next;
    },
  };
}
