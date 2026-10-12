# Review framing and next work

This is the final review of academic Phase 1 of a two-phase capstone. No official rubric or deadline has been supplied; the priorities below are project recommendations, not an institutional requirement.

## What can be presented now

**VitaLink turns real public pharmaceutical disruption records into traceable investigations.** Show one source record, its precise scope, identity matching, observed relationships, transparent model assumptions and an exported case record. Explain why a national shortage does not imply every presentation is unavailable and why a company link does not imply every medicine is recalled.

Substantial implementation work connects the earlier engines into persistent cases and adds refresh scheduling, source-health/coverage, watches, evidence export, input consistency and the spatial workspace. See [current state](02_CURRENT_STATE.md) and [validation](07_LOCAL_SETUP_AND_VALIDATION.md).

A convincing public-data review does not require a fictional supplier or hospital. It can demonstrate a real investigation end to end. Conditional stock/offer forms should be described as optional operational extensions; without organisational inputs they are not a live procurement outcome.

## Recommended next build, not implemented yet

| Priority | Feature                                    | Completion evidence                                                                                                                                                |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Product candidate comparison               | Source-backed matching on ingredient, strength, form, route and release; explicit mismatches, reported availability and unknowns; no unsupported equivalence claim |
| 2        | Event/product change history               | Timestamped source versions and a readable change view; distinguish changed facts from refresh times                                                               |
| 3        | Investigation report suitable for review   | Evidence, sources, limits, candidate reasoning and decision record in one readable export; current export is JSON                                                  |
| 4        | Dated public cost benchmarks where covered | Verified product/unit alignment; displayed source date; benchmark clearly distinct from an offer                                                                   |
| 5        | Narrow US road-route exposure comparison   | User-specified verified endpoints, appropriate vehicle routing, actual returned alternatives, hazard overlap and missing coverage; no invented closure/delay       |
| 6        | Follow-up evaluation                       | Source-backed outcomes and a manually audited relevance/matching set; dated snapshots to prevent hindsight leakage                                                 |

These priorities follow [competitor research](10_COMPETITOR_RESEARCH.md). The route connector already exists, but a safe and useful route workflow still needs endpoint, profile, hazard, coverage and UI work. Product matching within a case is not yet an alternate-product discovery engine.

## Later operational mode

When a partner can supply real inventory, consumption, contracts and supplier offers, add validated imports/integrations around the current forms. Then verify supplier-to-facility dependencies and carrier adapters before introducing stockout forecasts, live landed-cost comparisons or execution integrations. Outcomes could support calibrated learning once sufficient observed history exists.

Production readiness also needs container execution, hosting/operations review, source licensing/usage checks, authentication deployment configuration, durable evidence retention and performance work on the large map bundle. Do not call the local implementation production deployed.

## Evaluation targets

Measure identifier and geographic coverage, freshness, deduplication, manually audited product/entity matching, alert relevance and investigation completion time. Test route geometry and hazard intersections separately from actual delay prediction. For early-warning claims, evaluate only information available at the historical decision time and report false positives, missed events and lead time.

Passing tests, ingesting many records or reproducing a paper's equation does not establish real-world predictive accuracy or patent novelty. The contribution is a coherent evidence workflow with transparent uncertainty, inspired by existing industrial systems.
