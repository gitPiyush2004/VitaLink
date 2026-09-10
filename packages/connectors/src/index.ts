/**
 * packages/connectors — the only egress point in the entire system (Rule 3).
 *
 * Everything that leaves the process goes through `CachedHttpClient`, which
 * attaches provenance, enforces the per-source rate limit, retries with
 * exponential backoff on 429 and 5xx, and caches to Redis with a per-source TTL.
 *
 * CI gate 3 fails the build on a `fetch` anywhere outside this package.
 *
 * Read `http/cached-client.ts` first. The one idea to take from it: a caller
 * cannot obtain data without also obtaining the `Provenance` for it, because the
 * two are returned together in a `Fetched<T>`. That is what makes "every number
 * carries its source" a property of the types rather than a convention.
 */

export * from './http';
export * from './sources';
export * from './carriers';
