# Current implementation

Status reviewed on 12 October 2026. The repository contains a connected public regulatory investigation workflow, plus existing conditional graph, reliability, carrier and scenario tools. Proposed product-candidate and route-exposure comparisons are not yet complete features.

| Capability         | Current behavior                                                                                                                  | Limit                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Regulatory monitor | Fetches FDA recalls and current shortage presentations; hourly worker and manual refresh; stable identities and change timestamps | Recent recalls capped at 300 and shortages at 1,000; partial coverage                      |
| Evidence and map   | Source status, identifiers, lots, presentation availability and source snapshots; bounded geocoding                               | Recalling-firm city precision; no plant or hospital dependency map                         |
| Investigations     | Organisation-scoped cases, watches, medicine analysis, optimistic concurrency, notes, history and JSON export                     | Export is an evidence record, not a validated clinical recommendation                      |
| Product matching   | Product NDC first, then generic name, ingredient and company association                                                          | Only NDC directly identifies a product; recall lot restrictions still apply                |
| Evidence graph     | Ingredient/labeler links from the selected ingested catalogue; coherent graph per analysis/trace                                  | Labelers are not proven API suppliers or independent plants                                |
| Conditional trace  | Propagates a stated upstream shock and explicitly supplied days of cover                                                          | No automatic event-specific prediction of production loss                                  |
| Reliability        | Calls the Python Tucker–Daskin model with transparent proxy inputs, assumptions and sensitivity bands                             | Formula reproduction is not forecast validation                                            |
| News verification  | Ingests, clusters, resolves entities, checks independence, corroborates or quarantines                                            | A rate-limited corroboration request is recorded as not attempted, not absence of evidence |
| Logistics          | Constraint derivation, carrier eligibility and scoring; all registered carriers remain visible                                    | No live quote established; five adapters are stubs                                         |
| Response planning  | Compares operator-supplied alternatives by cost and uncovered days, preserves late-arrival gaps and Pareto trade-offs             | Requires documented inputs; does not discover supplier stock or place orders               |
| Deployment         | Local services were exercised; Dockerfiles and Compose supplied                                                                   | Container execution was not verified on the development host                               |
| Learning           | Decision history and case updates                                                                                                 | No calibration, drift detection or validated learning loop                                 |

## Material improvement over the earlier repository

The earlier tools were separate stage views. The operations workspace makes one source record the anchor of a saved case that connects catalogue analysis, observed relationships, conditional trace, logistics and a response record. It adds persistent investigations, source-health/coverage reporting, worker scheduling, watches, evidence export and a globe interface. Existing engines remain in use.

The connected work also fixes stale graph/cascade inputs, compressed HTTP response handling and invalid cache recovery, duplicate shortage updates, request/response contract mismatches, authentication refresh without a body, and response comparisons that previously erased gaps before late arrivals. Tests cover the affected behavior.

## Carrier implementation correction

`DsvAdapter` implements a documented OAuth flow, but the quote request/response fields are marked **UNVERIFIED_SCHEMA** and have not been exercised with an actual account. It must be validated before making any live quote claim.

FedEx, UPS, DHL, Kuehne+Nagel and CEVA use `UnavailableCarrierAdapter`, constructed with an empty API key. Their reserved environment fields do not activate rate integrations. They need adapters and provider contract validation as well as credentials. The optional mock adapter is development-only; real-data operation keeps `CARRIER_MOCK_MODE=false`.

## Dated local evidence

The initial public ingestion produced 1,298 unique incidents: 998 shortage presentations and 300 recall reports. A repeated refresh recorded zero changes. At the inspected snapshot, 46 recall records had city geocodes. These are dated observations, not permanent repository totals.

The signal verification run considered 76 clusters from 110 unique observations, published zero alerts and retained all 76 in quarantine. Targeted GDELT corroboration encountered HTTP 429. Zero published alerts is the actual outcome; the UI must not promote quarantined material to manufacture activity.

A heparin case was used for engineering acceptance with a real FDA presentation. Stock, cost and consignment inputs were explicit verification assumptions. It was not a real hospital transaction. Do not reuse that case as evidence of live procurement.

See [data and evidence](04_DATA_AND_EVIDENCE.md), [workflows](05_FEATURE_WORKFLOWS.md) and [validation](07_LOCAL_SETUP_AND_VALIDATION.md) for the interpretation of these observations.
