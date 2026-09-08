/**
 * The dependencies the cached client needs from outside.
 *
 * They are interfaces rather than concrete imports so that this package does not
 * depend on Redis, on pino, or on the system clock. Three consequences:
 *
 *   - `packages/connectors` can be unit tested with an in-memory cache and a
 *     frozen clock, so a test of the retry logic takes microseconds and is
 *     deterministic
 *   - the API and the workers wire in the real Redis client, which they already
 *     have, without this package importing their modules
 *   - the clock is injected, so `fetched_at` in provenance is reproducible in
 *     tests. A source-of-truth timestamp read from `new Date()` deep inside a
 *     client is untestable
 */

/** The Redis-backed response cache, reduced to the two operations we use. */
export type ResponseCache = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

const MS_PER_SECOND = 1000;

/** An in-memory cache. Used by tests, and as the fallback when Redis is absent. */
export function createMemoryCache(): ResponseCache {
  const store = new Map<string, { value: string; expiresAtMs: number }>();

  return {
    get(key: string): Promise<string | null> {
      const hit = store.get(key);
      if (hit === undefined) return Promise.resolve(null);
      if (hit.expiresAtMs <= Date.now()) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(hit.value);
    },
    set(key: string, value: string, ttlSeconds: number): Promise<void> {
      store.set(key, { value, expiresAtMs: Date.now() + ttlSeconds * MS_PER_SECOND });
      return Promise.resolve();
    },
  };
}

/** Injected so provenance timestamps are deterministic under test. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

/** Injected so a rate-limit or backoff test does not actually wait. */
export type Sleeper = { sleep(ms: number): Promise<void> };

export const realSleeper: Sleeper = {
  sleep: (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

/**
 * The subset of a logger this package uses. Structural, so pino satisfies it
 * without this package importing pino.
 */
export type ConnectorLogger = {
  debug(context: Record<string, unknown>, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

/** Used when no logger is supplied. Silent rather than console, so tests stay quiet. */
export const silentLogger: ConnectorLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
