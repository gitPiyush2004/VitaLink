# Regulatory operations

A connected workspace for a procurement or medicine supply analyst: observe a regulatory event, inspect its scope, relate it to a medicine, trace a stated disruption scenario, compare response options, and preserve the decision.

The hourly BullMQ worker fetches up to 300 recent FDA enforcement reports and 1,000 current shortage presentations. Feed health discloses fetch caps and errors. Stable identities prevent availability changes from duplicating presentations; source fetch times are preserved through the connector cache. A presentation listed as Available is not relabelled Unavailable simply because its national shortage status is Current.

The public incident collection holds regulatory evidence. Investigations and watchlists are organisation scoped. Opening an investigation preserves the source snapshot. Writes use the preceding `updatedAt` for optimistic concurrency, so another analyst’s changes are not silently overwritten. Reanalysing a medicine clears decisions tied to the previous analysis.

Matching prioritises exact product NDC, generic name, substance, then company. Only product NDC matching is labelled directly identified; even then recall applicability remains limited to reported lots. Company association never declares an unrelated product recalled.

The network is built from the selected catalogue records. It describes labeler and ingredient relationships, with no invented production sites, country suppliers, hospital demand or delivery lanes. City points are explicitly recalling-firm geography. Conditional tracing rebuilds a coherent network for the chosen upstream entity and retains the original cascade engine’s traversal and provenance. The cascade cache includes input data, avoiding stale results after a catalogue refresh.

Reliability uses the existing Python engine. Recall counts are distinct events over a documented window; they are a product-level failure proxy. API redundancy is assumed to be one, plant redundancy uses the labeler-concentration proxy, and recovery rates use the paper baseline. Bands are sensitivity ranges, not statistical confidence intervals or incident-specific shortage probabilities.

The logistics panel derives constraints from medicine labels and the trace. A recommendation is attached only after checking its organisation and shipment context. Missing carrier credentials yield UNAVAILABLE, never a fabricated price. The response planner instead accepts documented supplier offers or clearly labelled operator estimates, computes uncovered days with late-arrival gaps intact, and compares cost/gap Pareto dominance. It does not execute a purchase.

The browser exposes the existing signal ingestion, independent corroboration, and quarantine workflow separately from official FDA evidence. Neither a conditional trace nor an official source record is relabelled as a independently corroborated news alert.

## API

All paths are under `/api/v1/operations`, authenticated with existing scopes.

- `GET /` — incidents, feed health, organisation investigations/watchlists and worker heartbeat.
- `POST /refresh` — coalesced worker refresh.
- `POST /investigations` — preserve a source snapshot.
- `GET /investigations/:id` — organisation-scoped record.
- `POST /investigations/:id/analyse` — live catalogue, matching, evidence network and reliability.
- `POST /investigations/:id/trace` — conditional cascade from a related upstream node.
- `POST /investigations/:id/link` — attach a shipment recommendation with matching context.
- `POST /investigations/:id/plan` — deterministic response comparison.
- `PATCH /investigations/:id` — notes, response selection and status, with audit history.
- `POST /watches`, `DELETE /watches/:id` — organisation watchlist.

The `eval:audit` command replays a frozen public snapshot to measure coverage, without accessing the network or private investigations. A forecasting benchmark remains Phase 2 work; current snapshots cannot reconstruct historical information availability.
