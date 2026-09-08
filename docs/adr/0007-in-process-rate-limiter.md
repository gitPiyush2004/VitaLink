# ADR-0007: The connector rate limiter is in-process, and that is a known limit

- Status: accepted, with a stated migration path
- Date: 2026-09-08

## Context

Several public sources publish hard rate limits that are conditions of use, not
suggestions. Nominatim allows one request per second and blocks IPs that exceed
it. GDELT answers a faster caller with HTTP 429 and the message "Please limit
requests to one every 5 seconds" — which is how we learned its real limit.

## Options considered

**In-process spacing.** A promise chain per source plus a last-request timestamp
in a `Map`. Simple, synchronous, trivially testable with an injected clock.

**Redis-backed spacing.** A `SET key NX PX` or a small Lua script holding the
last-request instant, shared across processes. Correct under horizontal scaling.
Costs a Redis round-trip on every outbound request and a Lua script to explain.

## Decision

In-process, for now.

The justification is specific and checkable: ingestion runs as **one worker per
queue**. With a single consumer there is exactly one process making requests to a
given source, so an in-process limiter is not an approximation of the real limit —
it is the real limit.

## Consequences

- A rate-limiter test runs in microseconds, because the injected sleeper does not
  sleep and the injected clock only moves when told. That is why
  `rate-limiter.test.ts` can assert the exact sequence `[1000, 1000]` for three
  concurrent Nominatim callers.
- **The limitation is real and must not be glossed over:** running two ingestion
  replicas would give each its own allowance and double the effective request
  rate. For Nominatim that means an IP block.
- **The migration path is one file.** `createRateLimiter` already takes its clock
  and sleeper as injected ports; replacing the `Map` with a Redis key changes
  `rate-limiter.ts` and nothing else. Redis is already a dependency.
- **The trigger for doing it:** the moment a second replica of any ingestion
  worker is run. Until then this would be speculative complexity.
