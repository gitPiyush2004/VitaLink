# Historical-data layer

Implemented and exercised on 12 October 2026. VitaLink can now collect a bounded set of original archived FDA CSVs, preserve their contents and observation times, reconstruct printed-presentation histories, and replay a coverage report offline. This is a research/data layer; it is not yet a forecast, worker backfill, case timeline API or user-interface feature.

## Dated collection

The exact legacy CSV URL's index returned 126 captures across 48 calendar months between January 2019 and October 2026. The collection selected the earliest indexed capture in each available month and successfully interpreted **47 snapshots, containing 98,396 presentation-row observations**. The first selected October 2022 snapshot was rejected for inconsistent CSV columns; its downloaded source body is preserved. Collection exit 2 correctly reports this partial result.

Across the 94 requested months, 46 had no capture in the retrieved index, 47 were collected and one failed. This describes the inspected URL/index, not the completeness of all historical FDA records. The largest gap between usable snapshots is approximately **409.7 days**. Neither missing periods nor disappearance of a presentation becomes a negative shortage label.

The reconstruction contains 10,915 normalized printed medicine/company/presentation keys and 1,874 observed status differences, including 342 conflicting within-snapshot observations. These are not independently identified medicines, unique episodes or exact event boundaries. A key can change when the source changes a company's or presentation's wording.

Eleven snapshots required disclosed embedded-quote repairs, with strict column-count validation. All supplied calendar dates parsed, but **19 row observations print an initial posting year of 2108**, after their capture times. The original value is retained and linked in `date-quality-issues.json`; do not silently rewrite it to a guessed year or use it as a historical feature/outcome.

For example, one Hydroxychloroquine Sulfate Tablets presentation from Zydus is observed Current on 12 June 2020 UTC and Resolved on 8 July 2020 UTC. That establishes different observed statuses at those two times, not a resolution exactly on 8 July. The raw snapshot rows and interval remain linked.

## Implemented components

- Shared history contracts distinguish archive capture time, source-printed dates and later retrieval time.
- `FdaArchiveClient` uses the existing cached/rate-limited HTTP boundary. CDX columns, original endpoint and calendar/clock values are validated. Exact replay refuses redirects and uses a separate cache identity from permissive retrieval.
- The CSV interpreter uses `csv-parse`; required columns, row lengths, dates, source-record positions and quote-repair diagnostics remain explicit.
- The filesystem snapshot store publishes content atomically, refuses replacement, validates hashes and capture provenance, and reinterprets bodies during replay to detect changes to normalized rows.
- Bounded CLI collection selects one capture per available month, preserves errors and supports verified original-body reuse without copying older derived rows.
- Offline reconstruction reports missing periods, budget omissions, failures, conflicts, observation gaps and semantic date anomalies. First appearance and disappearance are not relabelled as onset or resolution.

Commands, storage layout, exit codes and source links are documented in [the history pipeline README](../../scripts/history/README.md). Actual snapshots remain in ignored local `data/history`, separately packaged as public evaluation evidence. Original source files do not become runtime fixtures.

## Forecast readiness

The gate is **OUTCOME_AND_COHORT_DEFINITION_REQUIRED**. We now have dated historical observations, but coverage is irregular and the records supply only retained shortage presentations. A broad new-shortage forecast still needs a historical eligible product universe, identity alignment and labels that distinguish new publication, continued shortage, resolution and planned discontinuation.

A next feasibility analysis should compare new-shortage prediction with a narrower task for already observed shortages, such as persistence. Either task needs explicit observation intervals, unresolved/conflicting outcomes, time splits, simple baselines and honest false-alarm/missed-event reporting. No model or prediction accuracy was added in this package.

See [current state](02_CURRENT_STATE.md), [data boundaries](04_DATA_AND_EVIDENCE.md), [roadmap](06_REVIEW_AND_ROADMAP.md) and [the preceding audit](11_CANDIDATE_AND_FORECAST_AUDIT.md).

## Validation

The full repository verification passed: 405 TypeScript tests across 30 files, formatting, ESLint, app type checks, provenance/source/secret gates and 385 generated file notes. Root TypeScript checking also passed. Python formatting, lint, mypy and 118 tests passed. The production web build passed with its existing large-chunk warning; Python retained its Starlette deprecation warning. The frozen 47-snapshot collection replayed offline with identical derived reports. These checks do not establish forecast accuracy.

## Subsequent task evaluation

The original source/report artifacts above remain frozen. [Conditional persistence evaluation](13_PERSISTENCE_EVALUATION.md) is now implemented as a separate offline package with an explicit outcome/cohort, calendar cutoffs, training-only baselines and unknown-outcome ledger. This advances task definition without establishing a deployable shortage forecast.
