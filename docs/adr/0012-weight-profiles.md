# ADR-0012: The scoring weight profiles are transcribed as published, including the zero `risk` weight

- Status: accepted, with the oddity reproduced rather than corrected
- Date: 2026-09-09

## Context

Spec 6.8 publishes a table of scoring weights, one column per urgency level. The
six sub-scores are weighted and summed to a final score out of 100.

| sub-score   |  LOW | NORMAL | HIGH | CRITICAL |
| ----------- | ---: | -----: | ---: | -------: |
| cost        | 0.45 |    0.4 |  0.2 |      0.1 |
| transit     | 0.15 |    0.2 |  0.3 |     0.45 |
| reliability | 0.15 |    0.2 |  0.2 |     0.25 |
| cold_chain  |  0.2 |    0.2 |  0.2 |      0.2 |
| risk        | 0.05 |    0.0 |  0.1 |      0.0 |
| service     |  0.0 |    0.0 |  0.0 |      0.0 |

## The problem, as found

The `risk` row is not monotonic and not obviously intentional. It rises from 0.05
at LOW to 0.1 at HIGH — which is the direction you would expect, since a shock
that threatens the shipment's own lane matters more when there is less slack —
but it is **zero** at both NORMAL and CRITICAL.

That reads like a transcription slip in the source table. It is also the sub-score
that only Vitalink can compute: `risk` is "how exposed is this carrier's own route
to the same shock", built from the graph and the cascade rather than from a second
risk engine. Zeroing it at CRITICAL means that in the one situation where the
shipment matters most, the system ignores the possibility that the truck is
driving into the same flood.

## Options considered

**Smooth the row** to something monotonic — 0.05 / 0.05 / 0.1 / 0.1 — and
rebalance `cost` to keep each column summing to 1. This is almost certainly what
the table meant.

Rejected. The weights are the most consequential configuration in the system:
they decide which carrier a hospital's shipment goes on. Silently substituting
our own judgement for the specified table would mean that a reviewer comparing
the code against the spec would find a mismatch and have no way to tell whether
it was a considered decision or a bug. "The code does not do what the document
says" is a much worse property than "the document has an odd row in it".

**Reproduce the table verbatim and record the oddity.** Accepted.

## Decision

`apps/api/src/config/weights.ts` transcribes the table exactly as published. The
`risk` zeroes stand. This ADR is the record of the discrepancy, and the file
points at it.

Two invariants are added on top, and both are unit-tested:

- **The weights sum to 1.** Not for neatness. A sub-score is 0-100 and the final
  score is a weighted sum, so a column summing to 1.2 would produce a "score" of
  120 and quietly break every comparison against a threshold. `validateProfile`
  is exported and asserted by a test rather than run at import time, because a
  malformed profile should fail the build and not take down a process that never
  scores anything.
- **Cold chain never drops below 20%.** This is a pharmaceutical system. A
  profile that let cold-chain capability fall away under time pressure would be
  optimising exactly the wrong thing at exactly the wrong moment. The published
  table already satisfies this at 0.2 in every column; the floor exists so that a
  future edit cannot violate it without a test failing.

## Consequences

In the MVP the `risk` weight is moot in practice: `riskSubScore` has no lane
exposure to work from — a quote does not say which hubs it transits, and the
physical layer is not ingested — so it contributes at the documented neutral
value with the reason on the row, under every profile. The weight only begins to
matter once hubs and lanes exist, which is when this ADR should be revisited with
the question stated plainly to whoever owns the spec: _did the NORMAL and
CRITICAL zeroes mean anything?_

Until then, an operator who disagrees with a weighting can override the profile
and re-run, and the profile in force is displayed with the derivation that
selected it. A weighting is a business judgement, and one the system should
surface rather than embed.
