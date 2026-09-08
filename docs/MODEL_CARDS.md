# Model cards

One card per model: purpose, inputs, outputs, baseline, metrics, limitations,
version. Written as the models are built, not at the end.

The spec's PART 10 lists twelve models. Three are implemented in the MVP; the
rest are listed at the bottom with what they will need, so the gap is visible
rather than implied.

---

## Model 11 — Tucker–Daskin series-parallel reliability

**Not machine learning.** A closed-form availability model, implemented exactly.
It is listed as model 11 in the spec and is the quantification engine the whole
system rests on.

|                    |                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**        | Expected shortage `s`, mean uptime, mean downtime and the Fragility Index for one drug                                                                                |
| **Implementation** | `apps/brain/app/domain/reliability.py`                                                                                                                                |
| **Source**         | Tucker, E. L. and Daskin, M. S. (2021), _Pharmaceutical Supply Chain Reliability and Effects on Drug Shortages_, [arXiv:2107.09167](https://arxiv.org/abs/2107.09167) |
| **Version**        | 0.1.0                                                                                                                                                                 |

### Inputs

| Input                                          | Meaning                   | Provenance                                                                               |
| ---------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `z_api`                                        | API suppliers in parallel | `DERIVED` from openFDA NDC distinct labelers, excluding repackaging categories           |
| `z_plant`                                      | plants in parallel        | `DERIVED` from DailyMed SPL registered establishments _(deferred past MVP; currently 1)_ |
| `z_line`                                       | lines per plant           | `SCENARIO`, default 1, flagged on screen as an assumption                                |
| `lam_api`                                      | supplier failure rate / y | `DERIVED` from openFDA enforcement history, else paper baseline                          |
| `mu_api`                                       | supplier repair rate / y  | `DERIVED` from resolved openFDA shortage durations, else paper baseline                  |
| `lam_plant`, `mu_plant`, `lam_line`, `mu_line` | plant and line rates      | **Always** paper baseline. No public series exists.                                      |

### Outputs

All `MODELLED`, all as low–high bands with assumptions and a confidence attached:
`r_api`, `r_pl`, `r`, `expected_shortage_s`, `mean_time_to_failure_years`,
`mean_time_to_recovery_years`, `fragility_index_0_100`.

### Baseline it must beat

An ad-hoc weighted risk score of the kind a spreadsheet would produce — "single
source = 3 points, foreign supplier = 2 points, add them up".

### Metric: reproduces the paper's published table

CI GATE 4, `apps/brain/tests/test_reliability.py`.

| `(z_api, z_plant, z_line)` | Computed `s` | Paper publishes | Absolute gap |
| -------------------------- | ------------ | --------------- | ------------ |
| (1, 1, 1)                  | 0.09914038   | 0.10            | 0.09 pp      |
| (2, 1, 1)                  | 0.04070624   | 0.04            | 0.07 pp      |
| (2, 2, 1)                  | 0.00554524   | 0.01            | 0.45 pp      |

Tolerance is 0.5 pp, the rounding interval of a figure quoted to the nearest
whole percent. Exact values are additionally pinned at 1e-7.

Supporting figures at the baseline parametrisation, for the report:

| Config  | `r_api`    | `r_pl`     | `r`        | `U` (years) | `D` (years) | `nu` (/y) |
| ------- | ---------- | ---------- | ---------- | ----------- | ----------- | --------- |
| (1,1,1) | 0.93513514 | 0.96334700 | 0.90085963 | 4.741       | 0.522       | 0.1900    |
| (2,1,1) | 0.99579255 | 0.96334700 | 0.95929376 | 6.244       | 0.265       | 0.1536    |
| (2,2,1) | 0.99579255 | 0.99865656 | 0.99445476 | 55.963      | 0.312       | 0.0178    |

### Why it beats the baseline, substantively

The model reproduces the paper's central finding, which an additive risk score
structurally cannot: **a second API supplier is worth far more than a second
production line.** Suppliers fail less often (17.3 y vs 8.5 y MTBF) but take 1.2
years to recover against the line's 29 days, so supplier redundancy buys far more
availability per unit of investment. A score that treats "add redundancy" as one
undifferentiated lever gets this backwards. Asserted in
`test_supplier_redundancy_helps_more_than_line_redundancy`.

### Limitations

1. **Echelons assumed independent.** The strongest assumption in the model. One
   shock can hit a supplier and a plant together; that correlated case is what the
   cascade engine models separately, and the two should be read together.
2. **Exponential lifetimes.** Constant hazard rate, no wear-out and no
   infant-mortality behaviour.
3. **`z_api` counts the observable market, not API manufacturers.** Heparin
   sodium returns 47 distinct openFDA labelers, including repackagers such as
   "McKesson Corporation dba SKY Packaging", several of which may be repackaging
   the same upstream API. Feeding 47 into `1 - p^z` gives a Fragility Index of
   essentially zero for a drug that has been in recorded shortage. The
   implementation excludes repackaging marketing categories and reports the raw
   count separately as an explicit upper bound. Even after that, this is a
   market-structure proxy, not a count of API plants.
4. **`mu` is optimistic by construction.** Only resolved shortages have a
   duration, and unresolved ones are by definition the long ones. Survivorship
   bias raises the fitted repair rate and lowers the Fragility Index.
5. **Plant and line rates are never this drug's.** They always fall back to the
   paper's baseline, and every response says so per rate in `rate_origins`.
6. **Mean uptime is derived, not transcribed.** The paper's full text was not
   accessible during the build. `U = r / nu` is computed by the frequency–duration
   method of classical reliability theory rather than guessed at from the paper's
   closed form. The paper's `D = U/r - U` then holds as an identity and is
   asserted in both directions, which is a genuine consistency check — but the
   derivation is ours and is labelled as such on every number.

### What this model must never be described as

Not a prediction of whether a specific drug will be short next quarter. It is a
**long-run availability** figure: "expect this drug to be unavailable about this
fraction of the time, under these assumptions, given this observable market
structure".

---

## Rate estimation (supporting model 11)

|                    |                                                                   |
| ------------------ | ----------------------------------------------------------------- |
| **Purpose**        | Fit `lambda` and `mu` from openFDA history, or fall back honestly |
| **Implementation** | `apps/brain/app/domain/rate_estimation.py`                        |
| **Version**        | 0.1.0                                                             |

**Estimators.** `lambda = event_count / observation_window_years`, the
homogeneous-Poisson MLE — chosen over `1 / mean interval` because it is defined
for unevenly-spaced events and does not need the interval before the first
observed event, which openFDA does not provide. `mu = 1 / mean resolved shortage
duration`, the exponential MLE, matching the distribution the reliability model
assumes.

**Fallback rule.** Below `MIN_EVENTS_TO_FIT_RATE = 3`, the paper's baseline is
used and the rate is tagged `PAPER_BASELINE_FALLBACK`. Three is the smallest count
from which a mean has any stability; the choice is stated rather than tuned.

**The case that matters most:** a drug with **zero** recalls. Fitting would give
`lambda = 0`, a perfectly reliable drug and a Fragility Index of zero — a
confident claim built on no evidence. It falls back instead. Asserted in
`test_a_drug_with_no_recalls_falls_back_rather_than_being_called_perfect`.

**Confidence is a reported honesty signal, not a statistical interval.** It grows
linearly with event count and saturates at 20 events; a fallback gets 0.3. A
bootstrap interval on three events would imply precision that is not there.
Labelled as such everywhere it appears.

**Limitations.** Survivorship bias in `mu` (above). Recall counts are a proxy for
_failures_, not identical to them: a recall is a detected quality failure, so
undetected failures and non-recall disruptions are invisible. openFDA is a US
registry, so a drug's Indian-market history is not in it.

---

## Provenance envelope enforcement (not a model, but evaluated like one)

|                    |                                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| **Purpose**        | Make "every number carries its source" a validation error                       |
| **Implementation** | `packages/contracts/src/provenance.ts`, mirrored in `apps/brain/app/schemas.py` |

**Metric.** 12 tests in `provenance.test.ts` and 3 in `test_reliability_api.py`
assert that a source-less number, a `DERIVED` value with no formula, and a
`MODELLED` value rendered as a point all fail to parse — on both sides.

---

## Not yet implemented

Listed with what each needs, so the gap is explicit.

| #   | Model                                    | Blocked on                                                                                                                                                                             |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Embeddings + MinHash/LSH dedupe          | Deterministic simhash dedupe is implemented; the embedding refinement needs sentence-transformers                                                                                      |
| 2   | Schema-constrained LLM extraction        | Implemented with a deterministic rule-based fallback; the LLM arm needs `ANTHROPIC_API_KEY`                                                                                            |
| 3   | TF-IDF relevance gate                    | Needs a hand-labelled corpus, which needs GDELT (blocked; see BUILD_LOG)                                                                                                               |
| 4   | XGBoost disruption forecasting           | Needs a labelled onset series from openFDA shortages, and a time-based split                                                                                                           |
| 5   | SARIMAX trade forecasting                | Needs UN Comtrade (blocked on a free key)                                                                                                                                              |
| 6   | Isolation Forest anomalies               | Needs the trade and news-volume series from 4 and 5                                                                                                                                    |
| 7   | Cold-chain excursion logistic regression | Open-Meteo is live; needs observed excursion labels, which need tracking data                                                                                                          |
| 8   | Carrier rate model                       | **Off by default, deliberately.** Its output is always `ESTIMATED` with a published confidence. This is the model that could quietly destroy the project's integrity, so it is opt-in. |
| 9   | Carrier reliability estimator            | Needs accumulated tracking history, which needs Phase 13                                                                                                                               |
| 10  | SHAP explanations                        | Needs 4, 7 or 8 to exist first                                                                                                                                                         |
| 12  | OR-Tools CP-SAT joint optimisation       | MVP uses exhaustive enumeration over ≤50 candidates, which the spec names as an honest fallback at this scale                                                                          |
