# ADR-0008: Deterministic backoff with no jitter

- Status: accepted
- Date: 2026-09-08

## Context

Standard retry advice is exponential backoff **with jitter**, so that many clients
recovering from a shared outage do not re-synchronise into a thundering herd.

Vitalink's data covenant, however, states that there is no random number generator
anywhere in runtime code. That rule exists to stop fabricated data values, and
retry jitter is not a data value — so the two are not in direct conflict, but the
rule's letter still applies and deserves an explicit decision rather than a quiet
exception.

## Options considered

**Full jitter with `Math.random()`.** Conventional. Violates the letter of the
covenant, and makes the retry schedule untestable — an assertion becomes a range
check, and a range check cannot catch an off-by-one in the exponent.

**Deterministic jitter from a hash of the request key and attempt number.**
Satisfies the covenant and de-correlates. Rejected as too clever: the spec says to
prefer the conventional solution over the clever one every single time, and this
would need a paragraph of explanation for a benefit we do not currently need.

**No jitter. Plain deterministic exponential backoff.**

## Decision

No jitter. `500ms, 1s, 2s, 4s`, capped at 30 seconds. `Retry-After` is honoured
when the server sends one, in both the seconds and the HTTP-date forms, because
the server knows its own recovery time better than our schedule does.

## Consequences

- There is nothing to de-correlate. Ingestion runs as one worker per queue, behind
  a per-source rate limiter that already spaces requests. Jitter would randomise a
  schedule that only one client is following.
- The schedule is assertable: `backoffDelayMs(3) === 2000` is a real test.
- **What would change this decision:** running many ingestion replicas against the
  same source. At that point the correct fix is a **seeded** PRNG whose seed is
  stored on the run, so the retry sequence stays reproducible — not
  `Math.random()`.
