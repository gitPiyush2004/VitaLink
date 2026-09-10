# `modules/scenarios` — SIMULATE and DECIDE

## What this module does

Builds the joint (sourcing × logistics) matrix from spec 6.11, ranks it, and
stores the ranking with the arithmetic that produced it.

```
cascade + drug + the operator's sourcing options
  -> eligible carrier quotes from a prior logistics recommendation
  -> the cross product, capped at 50 rows and reported when truncated
  -> outcome vectors, each field DERIVED / MODELLED / or declared unavailable
  -> Pareto front        (objective: no weights, no opinion)
  -> weighted objective  (subjective: the weights travel with the answer)
```

Run it end to end:

```
npm run cascade   --workspace @vitalink/api -- ingredient:heparin-sodium 30
npm run recommend --workspace @vitalink/api -- <cascade-id> <drug-id> 120
npm run decide    --workspace @vitalink/api -- <cascade-id> <drug-id> <recommendation-id>
```

## Two answers, and only one of them is an opinion

This is the whole design.

The **Pareto front** is a fact about the options. A dominated scenario is no
better on any axis and worse on at least one, so nobody's preferences make it
worth choosing — it can be discarded with no judgement at all. What survives is
the set of genuine trade-offs. On a live run, four of seven rows were dominated
and three were real choices.

The **weighted objective** picks one point off that front, and doing so requires
saying how many rupees a day of shortage is worth. Nobody can derive that; it is
policy. So the weights are configuration, they are stored with the answer, and
every scenario's objective value is stored with its per-term breakdown.

An operator who disagrees with the weighting can look at the front and pick a
different point. A system that showed one "optimal" option would have hidden the
trade-off it made on their behalf.

## What is computed, what is assumed, and what is refused

The honest accounting, because a scenario engine can produce any number at all.

| field                       | tag                 | source                                                                                            |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `expected_shortage`         | MODELLED            | cascade exposure (from openFDA listings) × the operator's assumed reduction                       |
| `fragility_index`           | DERIVED             | expected shortage × 100                                                                           |
| `days_of_cover_band`        | MODELLED            | the cascade's cover band, scaled by the same assumption                                           |
| `recovery_days`             | DERIVED or SCENARIO | the reliability model's mean uptime, or the intervention's lead time, labelled as whichever it is |
| `logistics_cost_inr`        | DERIVED             | a real carrier quote                                                                              |
| `transit_hours`             | DERIVED             | a real carrier quote                                                                              |
| `co2_kg`                    | DERIVED             | published tonne-km emission factors, when the lane's distance is known                            |
| `facilities_at_risk`        | **refused**         | needs the physical layer                                                                          |
| `population_band`           | **refused**         | needs district populations joined to facility catchments                                          |
| `loss_inr_band`             | **refused**         | needs NPPA ceiling prices joined to demand                                                        |
| `cold_chain_excursion_prob` | **refused**         | needs per-lane temperature history and carrier excursion rates                                    |

The four refusals are the most important rows in that table, and they are
reported as a per-scenario `unavailable` list — field plus reason — rather than
as nulls a reader has to interpret or, worse, as zeros. "Zero facilities at
risk" and "we do not know how many facilities are at risk" are opposite claims,
and a table of zeros reads as the reassuring one.

## Three things that were wrong, and what they taught

### Doing nothing does not recover instantly

`recovery_days` fell back to the intervention's lead time when the reliability
model had no figure — and `DO_NOTHING` has a lead time of zero. So the baseline
was reported as recovering in **zero days**, which made doing nothing look like
instant recovery on the one axis where it is worst.

Doing nothing recovers when the disruption ends. The baseline now uses the
cascade's own `duration_days`, and the value says so.

### Min-max normalisation amplifies a trivial spread into a decisive one

On a live run the exposures were `0.0184` and `0.0028` — one and a half
percentage points apart — and min-max normalisation turned them into `1.000` and
`0.000`. The shortage term then decided the entire objective on a spread that
small.

That behaviour is _correct_ for "which of these options is best" and misleading
for "how much does this matter". Which is why the raw value sits next to the
normalised one in every stored breakdown, and why the Pareto front — which
normalises nothing — is shown beside the ranking rather than instead of it.

### An `as` cast is not a mapping

The repository first read `doc.scenarios as Scenario[]` and `doc.pareto_front as
ParetoPoint[]`. Both compiled. Both were wrong: the writer stores those in
snake_case, so every read produced objects whose fields were all `undefined` and
whose type claimed otherwise. It surfaced as `Cannot read properties of
undefined (reading 'toFixed')` in the CLI, three layers from the cause.

The `as` was doing the opposite of its job — asserting a shape instead of
checking one. There are explicit mappers now, and the module follows the same
both-directions rule as everywhere else.

## The solver

`EXHAUSTIVE_ENUMERATION`, and that is not a placeholder for CP-SAT.
`MAX_SCENARIOS_PER_MATRIX` caps the matrix at fifty rows; enumerating fifty rows
and taking the minimum is _exact_, is faster than constructing a solver model,
and produces a ranking readable off the stored record. `solver` and
`solver_status` record which method ran and why it has no optimality gap, so an
eventual switch to CP-SAT — once the physical layer adds routing choices the cap
cannot hold — is visible in the data rather than silent.

## The layers

| Layer      | File                           | Notes                                                               |
| ---------- | ------------------------------ | ------------------------------------------------------------------- |
| router     | `scenarios.routes.ts`          | reads need `scenarios:read`; running a matrix needs `scenarios:run` |
| controller | `scenarios.controller.ts`      | renames request fields; applies no defaults                         |
| service    | `scenarios.service.ts`         | gathers the cascade, the drug and the quotes; ranks; stores         |
| repository | `scenarios.repository.ts`      | queries and explicit mapping in both directions                     |
| models     | `models/scenario-run.model.ts` | one document per run — see below                                    |
| domain     | `domain/*.ts`                  | pure; `now` is always injected                                      |

`domain/pareto.ts` and `domain/enumerate.ts` are pure functions, which is what
makes the spec's demands testable directly: "the front discards a dominated
option", "the objective reverses when the operator reweights it".

## One document per run, not one per scenario

A scenario has no meaning outside the matrix it was compared in. Every objective
contribution is min-max normalised against its siblings, so a row lifted out of
its matrix would carry a number that means nothing.

The whole matrix is stored, dominated rows included, because "why was that
option discarded" is a question an operator will ask and the answer — "this
other option was cheaper _and_ left less shortage" — is only available if the
discarded row survived.

## Required inputs, and why each one has no default

- **The sourcing options.** Lead time, intervention cost, and the fraction of the
  shortfall the intervention closes. No public source states any of the three
  for a specific plant, and a default would be the most consequential invisible
  number in the system. The schema rejects a list without exactly one
  `DO_NOTHING`, and rejects a `DO_NOTHING` that closes more than 0%.
- **A prior logistics recommendation.** The matrix pairs sourcing against _real
  quotes_; inventing a freight cost would make every row's total cost fictional.
  A recommendation with no eligible carrier raises `InsufficientDataError`
  rather than producing an intervention-only matrix that reads as shippable.
- **The lane distance,** for the CO2 term. Null is accepted and the term is then
  reported unavailable with the reason, because the physical layer is not
  ingested and no lane has a routed distance.

## Related

- `apps/api/src/modules/logistics/README.md` — where the carrier quotes come from
- `docs/adr/0012-weight-profiles.md` — the carrier weight profiles, which are a
  different set of weights answering a different question
- `docs/BUILD_LOG.md` — the phase gate and what it cost
