# Connected workflows

## 1. Refresh and inspect real regulatory records

`apps/workers/src/main.ts` registers the BullMQ worker. `operations.queue.ts` schedules/coalesces refreshes. `operations.ingestion.ts` requests typed FDA data through connectors, maps source rows with `domain/incidents.ts`, writes stable incident identities and records source health. Bounded geocoding adds recalling-firm city points without withholding unlocated list records.

The browser's `Workspace.tsx`, `MonitorRail.tsx`, `Globe.tsx` and `SourcePanel.tsx` show the events, filters, coverage, source timestamps, worker state and watches. Open the source and inspect product, presentation availability, NDC and lot restrictions before making an impact claim.

## 2. Open a persistent investigation

Operations routes/controllers validate and authorise creation. `operations.service.ts` saves the source snapshot through the repository. Investigations and watches belong to the authenticated organisation. A case begins with evidence rather than invented inventory.

`InvestigationPanel.tsx` connects Evidence, Analysis, Trace, Logistics, Response and Record. Notes, selected response and status updates preserve history; stale `updatedAt` writes are rejected instead of silently overwriting another edit. Export downloads the case's evidence record.

## 3. Analyse the related medicine

`operations.analysis.ts` refreshes the catalogue, uses `domain/matching.ts` to explain the relationship, builds the selected graph and requests reliability through `ReliabilityClient`. Matching priority is product NDC → generic → ingredient → company. The result distinguishes direct identity from association.

`catalog.service.ts` and its domain functions assemble label data, storage limits and concentration proxies. `graph/domain/build-graph.ts` uses the selected medicine's provenance and coherent entity identities. `apps/brain` calculates model results and assumptions. `Analysis.tsx` shows the network and model interpretation. If source coverage is insufficient, preserve the reason instead of substituting a fabricated input.

Reanalysis invalidates the prior trace, recommendations and response plan because they referred to the old medicine context.

## 4. Trace a stated upstream disruption

The analyst selects a related upstream node and supplies disruption duration and days of cover with their basis. The service rebuilds a coherent trace context and calls `cascade.service.ts`. Traversal follows supply-flow direction and accumulates bounded exposure across paths; supply cover is conditional on the supplied input.

`TracePanel.tsx` shows the scenario and impact. It does not declare all graph-linked products recalled, establish an observed plant shutdown or infer actual hospital stock.

## 5. Compare a shipment when real shipment details exist

Logistics derives storage/urgency constraints, applies hard eligibility gates and scores eligible results. Unknown critical carrier capabilities fail eligibility. Every registered carrier remains visible, including unavailable ones. Attaching a recommendation to a case requires organisation and shipment-context validation.

In the exercised configuration all six actual carriers returned unavailable. [Current state](02_CURRENT_STATE.md) explains the adapter gaps. Mock quotes are explicitly development scenarios and are disabled by default in the public environment template.

## 6. Compare documented response inputs

`domain/response-plan.ts` compares operator-supplied options against a do-nothing baseline. Arrival timing matters: a late shipment cannot erase a gap before it arrives. Cost and uncovered-day comparisons preserve the underlying input provenance and identify Pareto trade-offs.

An analyst can select a response and record why. Marking a case ACTIONED requires a selected response; it records a decision, not a dispatched shipment or purchase. Real offers can be entered when available. Student acceptance assumptions must remain labelled SCENARIO.

## 7. Review news separately

`NewsPanel.tsx` exposes the existing signals pipeline: ingest → cluster → entity resolution → independence/corroboration → veracity → publish or quarantine. A conditional trace and an official FDA record are not relabelled as independently corroborated news alerts. No LLM narrative service is wired into this flow.

Use the [file index](FILE_INDEX.md) to follow each named file and its static dependencies. See [data and evidence](04_DATA_AND_EVIDENCE.md) for source-specific interpretation.
