# Conditional persistence evaluation

Implemented and exercised on 12 October 2026 against the frozen 47-snapshot FDA archive collection. This is an offline, retrospective baseline experiment, separate from runtime API/worker/UI behavior. It does not establish a deployable forecasting feature.

## The question and why it is narrower

For a printed medicine/company/presentation association marked Current now, is it still Current at the **next global archive capture**, provided that capture is 14–60 days later and both observations have usable statuses and dates? Current is label 1; Resolved is label 0. This is conditional next-observed status, not a fixed 30-day forecast, shortage onset, exact recovery date or hospital stockout.

New-shortage prediction is not identifiable from this archive alone: retained shortage records do not supply the historical eligible non-shortage product universe. Absence is never a resolved/negative label. Eligibility depends on future source coverage; the experiment's conditional population cannot be known prospectively at the origin.

## Frozen design and evidence chain

The versioned task declares horizon bounds, age bands, a shrinkage weight of 20 and calendar cutoffs. Training uses origins and outcomes strictly before 1 January 2021 UTC. Validation uses 2021–2022 origins whose outcomes arrive before 2023; test origins start in 2023. Boundary-crossing labels are purged. The fitted baselines stay frozen; later labels never refit parameters. These dates/rules were fixed before examining holdout metrics. No parameter search was performed.

The comparator always predicts Current. A second estimator uses the Laplace-smoothed training persistence rate. A third estimates rates in predeclared bands of observed Current-run age, shrunk toward the training rate. Run age is a lower bound from observed captures, resets after absence/unusable observations or gaps over 60 days, and never uses future appearances or source initial-posting dates. No product catalogue fetched today or article published later is used as a historical feature.

The decision ledger retains origin/target source snapshot IDs, original CSV record positions, dates, intervals, feature values, labels and exclusion reasons. Source bodies are rehashed/reparsed before evaluation. Capture metadata must match the collection manifest. Hash-linked task, cohort, fit, prediction and audit artifacts refuse incompatible overwrite. Replaying the same inputs yields identical files. Checksums detect changes; they are not independent source authenticity certification.

## Dated results

| Partition             | Labelled presentation pairs | Origin captures | Current outcomes | Resolved outcomes |
| --------------------- | --------------------------- | --------------- | ---------------- | ----------------- |
| Training, before 2021 | 6,510                       | 5               | 6,484            | 26                |
| Validation, 2021–2022 | 3,091                       | 3               | 2,986            | 105               |
| Test, 2023–2026       | 30,503                      | 24              | 30,181           | 322               |

The test includes 4,413 printed presentation keys and 234 printed generic names. Counts are repeated associations, not independently verified episodes or medicines. Only 250 test rows reuse a training key; 30,253 are unseen printed keys. Historical string changes can break association; identity alignment remains unresolved.

| Frozen baseline           | Validation Brier score | Test Brier score |
| ------------------------- | ---------------------- | ---------------- |
| Always Current            | 0.033970               | 0.010556         |
| Training persistence rate | 0.033705               | 0.010486         |
| Observed Current-run age  | 0.033730               | 0.010494         |

Lower Brier score means smaller squared probability error. The duration baseline adds no compelling improvement over the global training rate. All baselines predict Current at the standard 0.5 threshold and recall **zero** Resolved outcomes. Always Current reaches 98.94% test accuracy solely because 98.94% of eligible labels are Current. That percentage is not a useful clinical or shortage-prediction success claim.

Capture-macro and capture/printed-name-cell-macro Brier scores, calibration bins, per-year/per-origin metrics and seen/unseen-key results are emitted too. For Always Current the test capture-macro Brier is 0.010204, whereas equal weighting of capture/name cells yields 0.023009. Presentation duplication changes denominators. No row-independent confidence intervals are claimed.

Of 61,393 Current-origin decision records, 40,104 are label-eligible and 21,289 remain excluded/unknown: 17,483 outside the horizon, 2,287 target absences, 1,126 with no later capture, 311 conflicting origins, 16 unusable origin-date rows, 21 conflicting targets and 45 planned-discontinuation targets. No boundary-labelled rows occurred in this collection. Every excluded decision remains inspectable.

## Commands and artifacts

```sh
npm run history:evaluate -- data/history/2026-10-12-final-history data/history/2026-10-12-final-persistence-v1
```

Evaluation uses no network. Output contains `task.json`, `cohort.json`, `fit.json`, `predictions.json`, `audit.json` and `metrics.json`. Raw historical source evidence stays in the separate collection. Neither archive data nor fitted research probabilities are bundled as runtime fixtures. The task gate is **RETROSPECTIVE_CONDITIONAL_BASELINES_ONLY** and deployment remains blocked by absent prospective validation/complete outcome coverage. The original history report's older task-definition gate remains frozen as the status of that earlier package.

Tests exercise absence versus resolution, horizon boundaries, contradictory/duplicate statuses, date exclusions, feature-prefix invariance, run resets, cutoff leakage, training-only fits, missing/imbalanced metrics and deterministic offline artifact replay. See [the pipeline README](../../scripts/history/README.md) for interpretation and reproducibility.

## Decision and next work

Keep this experiment as a reproducible baseline and a falsifiable result. Do not publish these probabilities as operational shortage forecasts. First audit historical identity alignment and a medicine-level outcome definition, improve source coverage without hindsight, and review missing outcomes against original evidence. Only then compare contemporaneous availability/news predictors against these frozen baselines. A readable timeline/report can expose real source changes in the product while forecasting research continues.

Method references: [chronological evaluation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html), [Brier score and probability evaluation](https://scikit-learn.org/stable/modules/model_evaluation.html). This implementation uses explicit calendar cutoffs and arithmetic, not scikit-learn or equally spaced row folds.

See [history collection](12_HISTORICAL_DATA_LAYER.md), [current state](02_CURRENT_STATE.md), [data boundaries](04_DATA_AND_EVIDENCE.md) and [roadmap](06_REVIEW_AND_ROADMAP.md).

## Completed validation

`npm run verify` passed: 416 TypeScript tests across 31 files, formatting, lint, API/worker/web type checks, provenance/source/secret gates and 392 generated file notes. Root TypeScript checking passed. The brain's ruff format/check, mypy and 118 pytest tests passed with the existing Starlette deprecation warning. The actual frozen collection evaluated and replayed offline into identical immutable artifacts. These are implementation/reproducibility checks, not evidence of operational prediction utility.
