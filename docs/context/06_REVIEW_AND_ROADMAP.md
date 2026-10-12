# Review framing and next work

This is the final review of academic Phase 1 of a two-phase capstone. No official rubric or deadline has been supplied; the priorities below are project recommendations, not an institutional requirement.

## What can be presented now

**VitaLink turns real public pharmaceutical disruption records into traceable investigations.** Show one source record, its precise scope, identity matching, observed relationships, transparent model assumptions and an exported case record. Explain why a national shortage does not imply every presentation is unavailable and why a company link does not imply every medicine is recalled.

Substantial implementation work connects the earlier engines into persistent cases and adds refresh scheduling, source-health/coverage, watches, evidence export, input consistency and the spatial workspace. See [current state](02_CURRENT_STATE.md) and [validation](07_LOCAL_SETUP_AND_VALIDATION.md).

A convincing public-data review does not require a fictional supplier or hospital. It can demonstrate a real investigation end to end. Conditional stock/offer forms should be described as optional operational extensions; without organisational inputs they are not a live procurement outcome.

## Completed since this list was written

**Priority 1, product candidate comparison.** Implemented against live openFDA and exercised end to end. Candidates are retrieved by active ingredient and compared against the investigated listing on ingredients, strength, dosage form, administration route and marketing category, each with its own `match`/`differs`/`unknown` verdict and no aggregate score. Drugs@FDA supplies approval, therapeutic-equivalence and marketing status; FDA's own reported shortage status is attached per listing; hard exclusions are stored apart from attribute differences; coverage and retrieval limits are reported. See [ADR 0014](../adr/0014-candidate-discovery-from-public-listings.md) and the [operations module README](../../apps/api/src/modules/operations/README.md).

Two parts of the original criterion are **not** met and should not be claimed. _Release characteristics_ are not compared, because no integrated source supplies them — DailyMed would be the addition. _General matching quality is unmeasured_: a 30-case purposive assistant technical review now exists, but it is not independent or representative. A independently reviewed set remains prepared human work.

## Completed Phase 1 additions

Source-change history, verified archive association, readable reports, public-evidence next actions, a 30-case technical comparison audit and end-to-end local acceptance are complete. See [the readiness note](14_PHASE1_REVIEW_READINESS.md) for dated figures and limitations. The blank independent review packet is prepared; no human answers or general matching accuracy are claimed.

The historical-data layer and conditional persistence evaluation are also implemented. Near-majority accuracy and zero resolution recall do not justify a deployed prediction. Identity alignment, eligible cohorts and useful contemporaneous features remain research work.

## Proposed Phase 2 scope

Public cost benchmarks, verified-endpoint road exposure, release-characteristic evidence, independent relevance/usability evaluation and improved shortage forecasting cohorts remain proposals. None is necessary to fabricate a supplier or hospital for the completed Phase 1 public-evidence investigation. Real operational imports require a partner and verified input coverage.

## Later operational mode

When a partner can supply real inventory, consumption, contracts and supplier offers, add validated imports/integrations around the current forms. Then verify supplier-to-facility dependencies and carrier adapters before introducing stockout forecasts, live landed-cost comparisons or execution integrations. Outcomes could support calibrated learning once sufficient observed history exists.

Production readiness also needs container execution, hosting/operations review, source licensing/usage checks, authentication deployment configuration, durable evidence retention and performance work on the large map bundle. Do not call the local implementation production deployed.

## Evaluation targets

Measure identifier and geographic coverage, freshness, deduplication, manually audited product/entity matching, alert relevance and investigation completion time. Test route geometry and hazard intersections separately from actual delay prediction. For early-warning claims, evaluate only information available at the historical decision time and report false positives, missed events and lead time.

Passing tests, ingesting many records or reproducing a paper's equation does not establish real-world predictive accuracy or patent novelty. The contribution is a coherent evidence workflow with transparent uncertainty, inspired by existing industrial systems.
