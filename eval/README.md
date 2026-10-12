# Evaluation evidence

Freeze **actual fetched records** as `{ "incidents": [...], "feeds": [...] }`, preserving each record’s provenance. Do not include private investigation records or authentication material. This file is an input artifact, never a runtime fixture.

```sh
npm run eval:audit -- /path/to/snapshot.json /path/to/report.json
```

The audit validates the shared contracts and unique event identities, records the input SHA-256, and measures identifier, lot, date and geographic coverage. Outputs retain the original source fetch timestamps and explain the denominator. Running the same snapshot produces the same report. No network connection is needed for replaying the audit.

This is a Phase 1 **data-quality evaluation**, not a shortage prediction backtest. A valid prediction evaluation still needs dated source versions, an independently defined outcome series, a time split, and comparison with a baseline. Current-status snapshots cannot reconstruct what was knowable before a historical event. Fetch caps and missing FDA harmonisation must not become “no disruption” labels.

Operational acceptance is tested separately: actual FDA record → product match → medicine analysis → conditional impact trace → labelled response inputs → persisted decision and audit history. Unit tests cover late arrivals, Pareto dominance, stable source identities, compressed upstream responses, and Python/TypeScript wire compatibility.

## Candidate and forecasting feasibility audit

```sh
npm run eval:public-data -- /path/to/empty-audit-directory
npm run eval:replay-public -- /path/to/frozen-audit-directory
```

The live audit archives real FDA responses through the connector, including candidate, approval and shortage queries. Four declared ingredient cohorts each retrieve at most 100 candidate listings; query totals and truncation remain explicit. The shortage query pages until its stated total or the safety ceiling. Matching the page count to metadata does not establish unique episodes, a complete historical series or an atomic snapshot. Use a fresh empty directory per run. Data is an evaluation artifact, never a runtime fallback.

Replay verifies raw shortage-response hashes, validates shared candidate contracts and rebuilds reviewed attributes/exclusions from original NDC listings from each exact retrieval query at the stored decision time. Its `candidate-review.json` records literal expected verdicts, rationale and candidate-file hashes. The supplied twelve-case review is a purposive same-assistant technical check, not an independent accuracy estimate. Approval resolution and shortage joins are outside that review. Forecast feasibility summaries retain source observation time, distinguish planned discontinuation from resolution, and report readiness limits without fitting a model.

Preserve the complete frozen directory and an external file hash manifest. The dated input bundle is supplied separately; it is not committed to Git. [The audit note](../docs/context/11_CANDIDATE_AND_FORECAST_AUDIT.md) records observations, research sources and the next data work.

## Historical source collection

```sh
npm run history:collect -- data/history/my-run 2019-01 2026-10 96
npm run history:replay -- data/history/my-run
```

This pipeline preserves exact original FDA CSV archive observations and derived history separately. The dated collection retrieved 47 usable monthly-selected snapshots, with one malformed selected snapshot and substantial missing periods. It does not assign new-shortage labels, fill negative outcomes or train a model. See [commands, exit codes and artifact layout](../scripts/history/README.md) and [the dated history-layer assessment](../docs/context/12_HISTORICAL_DATA_LAYER.md).

## Frozen temporal baseline experiment

`npm run history:evaluate -- /path/to/collection /path/to/evaluation` builds a source-linked conditional next-observed persistence cohort and fits baselines only before the declared training cutoff. Missing/ambiguous outcomes are excluded with explicit reasons, never relabelled as negatives. The later holdout metrics expose class imbalance, near-zero incremental baseline value and zero resolution recall at the standard threshold. This is a separate retrospective research experiment, not operational forecast validation. See [task, outputs and commands](../scripts/history/README.md) and [dated findings](../docs/context/13_PERSISTENCE_EVALUATION.md).

## Phase 1 expanded technical audit

```sh
npm run eval:replay-public -- data/evaluation/2026-10-13-phase1-review
```

The dated expanded freeze retains 31 hashed raw-source envelopes, four candidate sets and 30 explicit attribute/exclusion annotations. Replay uses exact baseline/discovery source URLs rather than a global last-write-wins NDC map; ambiguous raw identities reject replay. One initial annotation used a competing unfinished listing from a different query; the initial disagreement and correction rationale remain preserved. The final 30 annotations replay without disagreements, which is agreement with same-assistant labels, not an independent accuracy estimate. Frozen approval/shortage joins are reused and not independently labelled.

A separate blind packet contains only raw source-backed cases, provenance/hashes and blank answer sheets. Two teammates can review separately and adjudicate disagreements without seeing the coordinator key. Human answers have not been fabricated. Runtime duplicate-NDC selection and mixed shortage evidence have dedicated automated tests and live acceptance evidence. See [review readiness](../docs/context/14_PHASE1_REVIEW_READINESS.md).
