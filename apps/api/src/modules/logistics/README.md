# `modules/logistics` — the pharmaceutical carrier recommender

## What this module does

Turns an exposed drug in a cascade into a ranked, explained carrier choice. It is
stage 8 of the loop (EXECUTE), and it is the part of Vitalink a supply chain
manager would actually click.

```
cascade + drug id + consignment size
  -> shipment request       (constraints DERIVED from the label and the cover band)
  -> fan out to 7 carriers  (parallel, per-carrier timeout, circuit breaker)
  -> eligibility gate       (9 hard constraints; eliminates, does not down-score)
  -> six sub-scores         (each stored with the inputs that produced it)
  -> weighted sum           (profile selected from the derived urgency)
  -> recommendation         (with a counterfactual and a coverage note)
```

Run it end to end against live data:

```
npm run cascade   --workspace @vitalink/api -- ingredient:heparin-sodium 30
npm run recommend --workspace @vitalink/api -- <cascade-id> drug:heparin-sodium 120
```

## The four claims this module makes, and where each one is enforced

### 1. The pharmaceutical constraints are derived, never asked

`domain/shipment-derivation.ts`. The temperature requirement comes from the
drug's own openFDA label; the ranges the label _forbids_ come from the same parse;
the deadline comes from the cascade's cover band minus a receiving margin; the
urgency comes from the cover band, alert severity and affected population.

If the label yielded no temperature, `deriveShipment` **throws** rather than
defaulting. A shipment with a guessed temperature would run the gate against a
fiction, and the gate is the part of this system that is meant to be trustworthy.

What it does _not_ derive, and why, is at the top of that file: geography (the
physical layer is not ingested) and consignment mass (no public source states how
much of a drug a facility needs). Both are required inputs with no defaults.

### 2. A hard constraint eliminates a carrier; it does not reduce its score

`domain/eligibility-gate.ts`, nine rules, each with a passing and a failing test.
An ineligible carrier appears in the comparison table marked `NOT ELIGIBLE`, with
its reasons and **with no score at all** — because a low score would imply it was
considered on the merits and merely lost.

Two rules inside the gate carry most of its value:

- **`'unknown'` fails a constraint that requires the capability.** If a carrier's
  documentation does not state GDP compliance, requiring GDP eliminates them. The
  whole reason capabilities are a tri-state is so a guess cannot pass as a fact.
- **An unproven deadline is treated as unmet.** A carrier that returns neither an
  arrival date nor a transit time has not shown it will arrive on time.

The gate reports every failure rather than the first, with one exception: an
`UNAVAILABLE` quote reports rule 7 alone. Running the other eight rules against
an empty payload produced verdicts that looked like findings and were not —
"DSV misses the deadline" is a claim we cannot support about a carrier that
returned nothing.

### 3. Every number is stored with the arithmetic that produced it

`domain/sub-scores.ts` and `domain/score.ts`. Each sub-score carries its `inputs`
map and its formula, so the UI shows the arithmetic rather than the result and a
reviewer can recompute a rank from the stored record alone.

Where an input does not exist, the sub-score contributes at
`NEUTRAL_SUB_SCORE` with `neutralFallbackReason` set, and the reason is printed
**on the row**. Today that is true of two of the six:

| sub-score     | state in the MVP                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `reliability` | always neutral — no carrier publishes a machine-readable on-time figure, and tracking history is a later phase |
| `risk`        | always neutral — a quote does not say which hubs it transits, and the physical layer is not ingested           |

Scoring those zero would punish a carrier for our ignorance; scoring them 100
would reward them for it. Inventing a plausible on-time percentage would be a
fabricated number driving a real decision.

### 4. A preference you cannot see is a bug

Spec 6.2 asks for DSV to be preferred where possible, and there are two ways to
do that. The legitimate one is already in the cost sub-score: it is weighted by
quote confidence, so a carrier that can return a real quote against real
credentials wins **on merit** and the explanation can point at the term that made
it win.

The other would be a hidden thumb on the scale. So the preference is implemented
as a declared, displayed tie-break bonus, defaulting to empty, and
`applyPreference` returns the disclosure note _alongside_ the number so a caller
cannot take one without the other. Ties break on the un-bonused score, so the
preference breaks ties rather than reversing them.

## The layers

| Layer      | File                      | Notes                                                                                                                                      |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| router     | `logistics.routes.ts`     | reads need `logistics:read`; producing a recommendation needs `logistics:recommend`, because it consumes real carrier rate-limit allowance |
| controller | `logistics.controller.ts` | maps the request body to domain shapes; applies no defaults                                                                                |
| service    | `logistics.service.ts`    | all the I/O and none of the judgement                                                                                                      |
| repository | `logistics.repository.ts` | queries only; mapping lives in `models/mappers.ts`                                                                                         |
| models     | `models/*.model.ts`       | two collections — see below                                                                                                                |
| domain     | `domain/*.ts`             | pure; `now` is always injected                                                                                                             |

`domain/recommend.ts` is the whole decision as one pure function, which is what
makes the spec's weighting sanity check a two-line assertion instead of an
integration test with mocked HTTP.

## Two collections, and why quotes are embedded

`shipment_requests` is stored because it is the record of what was asked: spec
6.12 requires a re-run to _supersede_ the previous recommendation with a change
log, and that is only possible if the earlier request survives to be diffed
against.

`logistics_recommendations` embeds its quotes. A carrier quote has no life of its
own — it is only read as part of the recommendation that scored it, it is never
updated, and its value is entirely as an audit record. Embedding makes it
impossible for the stored comparison table to drift out of step with the stored
scores. The cost is that quotes cannot be queried across recommendations ("every
DSV quote this month"), which is a reporting question the MVP does not have.

## Known limitations, stated rather than hidden

- **Superseding is two writes and not a transaction.** The order is deliberate:
  store the new recommendation, then flag the old one. A crash between them
  leaves a current recommendation with a stale flag, rather than a shipment with
  no current recommendation at all.
- **The raw-payload archive expires.** `raw_response_ref` points at a Redis key
  with a 30-day TTL. A quote older than that keeps its reference and loses the
  payload behind it. Object storage is the fix and is not in the MVP.
- **Six of seven providers cannot quote.** DSV is the one Tier A integration and
  has no credentials in this environment; the other five have no callable public
  quote API at all. `docs/CARRIER_STATUS.md` records what was checked and when.
  They are still registered, because a table showing one price reads as "there is
  one option" when the truth is "there is one option we can see" — which is what
  the coverage note says in words on every recommendation.
- **A stored weight profile could be missing a sub-score key.** The stored
  `weights` is a `Record<string, number>`, whose index signature satisfies the
  per-key record structurally. `weightSubScores` handles a missing key by
  weighting it zero and still showing the row, so the failure is visible.

## The mock carrier

`CARRIER_MOCK_MODE=true` registers `MockCarrierAdapter`, which is the one thing
in the system allowed to produce a price nobody quoted. It is hedged four ways —
env-gated, impossible under `NODE_ENV=production`, `SANDBOX_QUOTE` only with a
`SCENARIO` price, and a display name that reads "development only" so the
disclosure travels into the coverage note and into any screenshot. CI gate 5
greps the file for the live-quote status string and fails the build if it appears.

Its purpose is narrow: to exercise the gate's passing paths and the scoring
before any real carrier credential exists. The Tier C adapters exercise the
failing paths.

## Related

- `docs/adr/0012-weight-profiles.md` — why the spec's zero `risk` weight is
  reproduced as published rather than quietly corrected
- `docs/CARRIER_STATUS.md` — the per-carrier integration check
- `packages/connectors/src/carriers/` — the adapters, the registry and the
  circuit breaker
