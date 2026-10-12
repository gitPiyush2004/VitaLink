# Evaluation evidence

Freeze **actual fetched records** as `{ "incidents": [...], "feeds": [...] }`, preserving each record’s provenance. Do not include private investigation records or authentication material. This file is an input artifact, never a runtime fixture.

```sh
npm run eval:audit -- /path/to/snapshot.json /path/to/report.json
```

The audit validates the shared contracts and unique event identities, records the input SHA-256, and measures identifier, lot, date and geographic coverage. Outputs retain the original source fetch timestamps and explain the denominator. Running the same snapshot produces the same report. No network connection is needed for replaying the audit.

This is a Phase 1 **data-quality evaluation**, not a shortage prediction backtest. A valid prediction evaluation still needs dated source versions, an independently defined outcome series, a time split, and comparison with a baseline. Current-status snapshots cannot reconstruct what was knowable before a historical event. Fetch caps and missing FDA harmonisation must not become “no disruption” labels.

Operational acceptance is tested separately: actual FDA record → product match → medicine analysis → conditional impact trace → labelled response inputs → persisted decision and audit history. Unit tests cover late arrivals, Pareto dominance, stable source identities, compressed upstream responses, and Python/TypeScript wire compatibility.
