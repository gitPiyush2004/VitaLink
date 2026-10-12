# Candidate audit and forecasting feasibility

Observed on 12 October 2026. This is the first implementation package toward a public-data healthcare decision studio inspired by ZS Canary. It establishes candidate-screening behavior and the next data work; it does not introduce a validated shortage predictor.

## Completed behavior changes

- A multi-product incident no longer silently uses its first NDC as the baseline for every selected medicine. An exact generic-name match must identify one retrieved incident listing. Multiple presentations, missing matches or incomplete reference retrieval preserve unknown attributes and explain why.
- FDA dates are parsed as strict calendar dates: NDC `YYYYMMDD`, ISO `YYYY-MM-DD`, and shortage `MM/DD/YYYY`. Impossible dates remain unknown. A listing is valid through its stated expiry day in UTC; a supplied unreadable expiry is disclosed.
- NDC mass per dose-unit strengths such as `500 mg/1` can be compared with `0.5 g/1`; dose-unit amounts are not assumed comparable with a liquid concentration.
- Combination-product strength and approval equivalence remain unknown until every ingredient and approved presentation can be aligned. A single-product approval with a clearly contradictory strength is withheld.
- Candidate coverage reports the FDA total separately from the retrieved count; a missing total stays null. Exactly 100 returned out of 100 is complete for that query, while 100 out of 101 is incomplete. Capped shortage joins are disclosed.
- The shortage schema retains `discontinued_date`, which previously disappeared at parsing. Source comments no longer describe current shortage records as verified recovery-rate labels.

## Live source freeze

`npm run eval:public-data -- /path/to/empty-audit-directory` archives real source responses, URLs, fetch timestamps and raw-response hashes. It queries four deliberately selected groups, not a representative medicine sample. An audit must use a fresh directory; rerunning against the same folder can mix source freezes.

| Selected group          | Baseline NDC | Retrieved / source total | Excluded listings |
| ----------------------- | ------------ | ------------------------ | ----------------- |
| Heparin sodium          | 71288-406    | 100 / 166                | 20                |
| Amoxicillin             | 50090-6349   | 100 / 515                | 7                 |
| Human insulin           | 0002-8824    | 100 / 103                | 89                |
| Amlodipine + benazepril | 63629-7535   | 100 / 593                | 6                 |

These are dated coverage counts. Exclusions are rule outcomes, not false positives, clinical unsuitability judgements or stock observations. Every group is truncated. Different ingredients, strengths and dosage forms can appear in an ingredient query; the app must preserve those differences.

Twelve purposively selected real-listing pairs were labelled by the same Codex assistant implementing the fixes. Offline replay found **zero disagreements with those technical annotations**. This is a small engineering check, not an independent, blinded, representative or clinical accuracy estimate. It replays attributes and exclusions from raw FDA listings and frozen decision times. It does not independently validate approval-product resolution or shortage joins. A pharmacist-reviewed, larger matching set remains outstanding.

```sh
npm run eval:replay-public -- /path/to/frozen-audit-directory
```

The directory must contain archived source responses, candidate sets and `candidate-review.json`. Input checksums prevent using annotations against a different candidate freeze. Public evaluation inputs live in ignored `data/evaluation`, never the runtime product.

## Current shortage data: useful, insufficient for a backtest

The `_exists_:generic_name` query returned **1,582 rows**, matching the total on every retrieved page: 1,141 Current, 19 Resolved, and 422 To Be Discontinued, spanning 236 printed generic names. Posting and update dates were parseable on all rows; 23 carried change dates and 422 carried discontinued dates. One exact raw row appeared twice. Paging is not an atomic database snapshot or proof of unique episodes.

The earliest printed posting date is 1 January 2012. That does not establish complete historical coverage or what earlier analysts knew. These are mutable retained presentation rows. A change date is not automatically a resolution date, and an absent historical medicine is not a negative outcome. [FDA endpoint documentation](https://open.fda.gov/apis/drug/drugshortages/) describes the public source; the row counts above are our actual fetched observations.

A retrospective forecast needs historical source versions, independently specified onset/continuation outcomes, an eligible medicine universe and time-separated evaluation. The gate remains **NOT_READY_FOR_RETROSPECTIVE_FORECASTING** for this current snapshot alone.

## Historical source investigation

| Source inspected                                                                                                                                                                                                                                                                                                 | Actual result                                                                                                                                                                                                                                                                                    | Appropriate next use                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Internet Archive FDA CSV capture, October 2019](https://web.archive.org/web/20191020223457id_/https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm) and [December 2019](https://web.archive.org/web/20191229133343id_/https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm) | Original archived CSV bodies downloaded and hashed; 2,106 and 2,232 presentation rows after removing leading blank lines. Preserve padded header names during normalization.                                                                                                                     | Reconstruct dated observations from original captures; quantify gaps and changes before assigning event labels. Two captures do not establish usable temporal coverage.           |
| [Johns Hopkins API documentation](https://github.com/jhu-pharma-supplychain/api-docs)                                                                                                                                                                                                                            | Documents historical shortage episodes and curated manufacturer/regulatory data. Requires a research API key; public health and unauthenticated search probes timed out in this session. No authenticated data obtained.                                                                         | Optional research-access request, then audit episode definitions, source dates, terms and predictor history. Documentation examples are not observed records.                     |
| [Drug-Shortage-Radar source](https://github.com/mangofillet/Drug-Shortage-Radar/blob/master/src/ingest/shortages.py)                                                                                                                                                                                             | Inspected its public processed parquet: 11,218 rows, including 10,588 CSV-derived and 630 HTML-derived rows. HTML onset uses first observed snapshot; 2,164 resolution dates are approximated as last observation plus two months. Per-capture records are not retained in that processed table. | A discovery aid for archive coverage. Reconstruct from original FDA captures rather than adopting its approximate dates as exact labels or its model metrics as VitaLink results. |
| [ShortageSim](https://github.com/Lemutisme/ShortageSim)                                                                                                                                                                                                                                                          | Public ground-truth CSVs inspected contain simulation parameters such as manufacturer counts, periods and disruption magnitudes, without identifiable medicines and dated episodes.                                                                                                              | Simulation research reference, not an observed shortage-onset training table.                                                                                                     |

No third-party model, processed dataset or synthetic simulation data was wired into VitaLink. Raw research files were inspected separately. No outreach was sent.

## Next build order

1. A bounded archive connector and immutable snapshot store: preserve original body, capture timestamp, fetch timestamp and hash; report coverage gaps. Do not convert first observed appearance into an exact onset without qualification.
2. Define one forecast task, likely new national shortage publication within a fixed horizon. Separate onset, continuation, resolution and planned discontinuation; choose ingredient/form or presentation as the unit consistently.
3. Construct a historical eligible product cohort with only contemporaneously available predictors. Split by time, handle censoring and recurrence, compare simple baselines, report precision-recall, false alarms, calibration and lead time. Add a model only after these checks pass.
4. Compare dated news/regulatory features with the same baseline and time split. A news signal helps only if it improves measured warning performance.
5. Bring evidence, candidate reasoning and qualified risk into a readable investigation report and decision workspace.

See [current state](02_CURRENT_STATE.md), [data boundaries](04_DATA_AND_EVIDENCE.md), [roadmap](06_REVIEW_AND_ROADMAP.md) and [evaluation commands](../../eval/README.md).

## Validation for this package

The full repository verification passed: 386 TypeScript tests across 28 files, formatting, lint, type checks, source/secret gates and generated-context checks. The Python checks passed: ruff format/lint, mypy and 118 tests. The production web build passed with the existing large-bundle warning; Python retained the existing Starlette deprecation warning. Offline technical replay passed twelve reviewed cases. These checks do not establish forecast or clinical accuracy.
