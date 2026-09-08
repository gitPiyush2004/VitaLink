/**
 * packages/connectors — the only egress point in the entire system (Rule 3).
 *
 * Everything that leaves the process goes through the cached client here, which
 * attaches provenance, enforces the per-source rate limit, retries with
 * exponential backoff on 429 and 5xx, and caches to Redis with a per-source TTL.
 *
 * CI gate 3 fails the build on a `fetch` anywhere outside this package.
 */

export {};
