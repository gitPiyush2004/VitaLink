# Original FDA shortage history

This research pipeline retrieves original CSV bodies from the Internet Archive's exact index of the legacy FDA shortage download URL. It is separate from the live operational monitor. No historical source files are bundled as a runtime fallback, and no absence is converted into a negative outcome.

```sh
# Directory, first month, last month, capture budget (defaults to 12; max 96).
npm run history:collect -- data/history/my-run 2019-01 2026-10 96

# Optional final argument: reuse verified original bodies from an older collection.
# Derived rows are reparsed; the old collection is never overwritten.
npm run history:collect -- data/history/new-run 2019-01 2026-10 96 data/history/my-run

# Revalidate bodies, normalized interpretations and provenance; rebuild deterministic reports.
npm run history:replay -- data/history/my-run
```

Collection needs network access and an empty output directory. It selects the earliest indexed CSV capture per available month, then applies a chronological budget. It does not fetch every indexed capture. Index retrieval caps at 5,000 records and reports possible truncation. Courtesy spacing is two seconds, with two attempts per HTTP request. Three consecutive failed capture operations stop further attempts in that run. Exit 2 means the manifest preserves incomplete collection; exit 1 means a fatal setup/index/storage error.

Exact replay rejects redirects instead of following a nearby capture. A failed capture can be retried in a fresh run; no replacement body is fabricated. Original response text is stored before parsing, so successful HTTP responses rejected by the parser remain inspectable. Local reuse retains the original fetch timestamp and verifies the body and capture provenance before reparsing.

## Artifacts

- `index.json`: retrieved index, its original JSON body and retrieval provenance.
- `manifest.json`: request bounds, selected captures, successful snapshot IDs and failures; failed parsing retains the original body's hash.
- `bodies/<sha256>.csv`: decoded original response text, unchanged by CSV repair. The hash is SHA-256 of UTF-8 response text, distinct from the archive's CDX digest.
- `snapshots/<capture>-<sha256>.json`: original capture time, later retrieval time, source URL, schema/parser version, interpretation diagnostics and normalized presentation rows.
- `derived/v1/coverage.json`: month coverage, observation gaps, conflicts, date-quality counts and explicit forecasting gate.
- `derived/v1/history.json`: observed histories keyed by normalized printed medicine/company/presentation strings. These keys are not clinical identities or independent shortage episodes.
- `derived/v1/transitions.json`: observed status differences bounded by observation dates, with no inferred exact onset/resolution.
- `derived/v1/date-quality-issues.json`: printed historical dates after capture, linked to original snapshots and CSV record positions.

Store writes publish complete files atomically and refuse different content at an existing path. Replay rehashes bodies and reparses them to detect tampered normalized rows. Identical reruns are deterministic. A future changed interpretation needs a new parser/report version; never overwrite source evidence. Checksums detect changes, not independent authenticity.

## Interpretation boundaries

CSV parsing handles BOM, blank lines, padded headers, quoted commas and multiline fields. Some older FDA prose contains illegal embedded quotes. A narrow repair escapes only quotes that cannot terminate a quoted CSV field; diagnostics record the count and strict column counts remain mandatory. Ambiguous or inconsistent records reject the entire snapshot. Printed date values are preserved; a calendar-valid year such as 2108 can still be historically impossible and is separately flagged.

Missing months, rejected captures and budget omissions have separate states. Disappearance is not resolution. Planned discontinuation is not shortage onset. Conflicting rows for the same printed identity remain conflicting. The table contains retained shortage presentations and does not establish an eligible historical universe of non-shortage products.

Before training: define the forecast question and unit, handle identity changes and censoring, audit conflicts and suspicious dates, establish eligible cohorts and evaluate only contemporaneously available information. See [the history-layer note](../../docs/context/12_HISTORICAL_DATA_LAYER.md).

Source interfaces: [Internet Archive CDX documentation](https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server), [CSV parser documentation](https://csv.js.org/parse/), [FDA shortage source](https://www.accessdata.fda.gov/scripts/drugshortages/).

## Conditional persistence evaluation

```sh
npm run history:evaluate -- data/history/my-run data/history/my-evaluation
```

This is offline research, separate from runtime API/worker/UI. It validates original bodies and capture/manifest alignment, then publishes six immutable artifacts: `task.json`, `cohort.json`, `fit.json`, `predictions.json`, `audit.json` and `metrics.json`. Identical replay is allowed; incompatible content at the same output path is rejected. Use a new output directory for a changed experiment. No network or new dependency is needed.

The versioned question asks whether a currently Current printed presentation is still Current at the **next global capture**, 14–60 days later, conditional on usable observations at both ends. Current is 1 and Resolved is 0. Absence is not resolution; planned discontinuation, contradictory/unreadable status, unusable dates, outside-window gaps and the final capture remain unknown in the ledger. No later reappearance is substituted for the next capture. This is not a fixed 30-day or new-onset forecast; eligibility depends on future source coverage.

Training origins and label availability are strictly before 2021 UTC; validation is 2021–2022 with outcomes before 2023; test origins start in 2023. Labels crossing cutoffs are purged. Baselines remain frozen: always Current, Laplace-smoothed training rate and predeclared observed-age bands shrunk toward the training rate with weight 20. Age is a prefix-only observed Current-run lower bound, reset by absence/unusable observations or gaps over 60 days; printed initial-posting dates are not used as episode start dates. Holdout labels do not refit parameters.

Metrics include Brier probability error, calibration, equal-capture and equal-capture/printed-name-cell weighting, threshold accuracy/precision/resolution recall, per-year/per-origin results and training-key overlap. Null denominators remain null. Repeated associations are dependent, so no row-independent intervals or unique-episode counts are implied. The experiment's near-majority accuracy and zero resolution recall are not deployable prediction evidence. See [the dated results and next work](../../docs/context/13_PERSISTENCE_EVALUATION.md).

Task/cohort/model/prediction hashes and source URLs/observation/fetch times are preserved. Outputs are not runtime fixtures. The new package gate is `RETROSPECTIVE_CONDITIONAL_BASELINES_ONLY`; the older collection coverage gate remains the frozen status of the original data-layer report. Broader new-shortage prediction still lacks the eligible historical non-shortage universe.

## Explicit application import

```sh
npm run history:import -- data/history/my-run
```

This optional bridge revalidates original decoded bodies, normalized interpretations and manifest/capture provenance before connecting to the configured MongoDB. It explicitly stores immutable public normalized snapshots; it does not substitute a fixture when a live source fails. Raw bodies remain in the verified collection. Identical reimports retain zero new copies, and incompatible interpretations at an existing snapshot identity are refused.

The History and Report views associate only exact normalized printed medicine names across companies and presentations. They retain capture/fetch times, parser diagnostics and body hashes; the UI discloses unusable dates. This does not establish the selected product NDC's archive identity, fill missing periods or deploy forecasts.
