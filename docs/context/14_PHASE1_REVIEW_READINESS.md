# Phase 1 final review readiness

Reviewed on 13 October 2026 (Asia/Kolkata). The agreed engineering scope is complete: a working public-evidence investigation, source history, readable report, technical audit and review handoff. No official institutional rubric has been supplied. Independent human/clinical validation and production deployment are not completed claims.

## Explain the use case in one sentence

VitaLink helps a medicine supply analyst investigate a real FDA shortage or recall, identify what the evidence actually covers, compare listed product candidates, and record a justified next action with its sources.

A student team can perform that investigation using public evidence. Supplier accounts are not required for this scope. Public records cannot tell us a hospital's stock or whether a seller has a candidate available. The saved action is to monitor, investigate a listing, or request professional review; it is not an executed order or a clinical substitution.

## Finished review scope

| Requirement                      | Implemented evidence                                                                                        | Practical boundary                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Real external data               | Live FDA shortage, enforcement, NDC, label and approval requests                                            | FDA/US coverage, source caps and timestamps disclosed                                       |
| One connected use case           | Preserved event → medicine identification → candidates → next action → report                               | No invented supplier or hospital is required                                                |
| Product identity and comparisons | NDC priority, conservative ambiguous baselines, five attribute verdicts, exclusions, approval evidence      | No aggregate suitability score; release characteristics are unassessed                      |
| Source history                   | Immutable live fact versions, field changes and source fingerprints                                         | Tracking starts locally; first legacy comparison can include date-normalization corrections |
| Archived observations            | 47 verified original CSV snapshots explicitly imported; exact printed-name view                             | Association across companies/presentations is not a verified history of the selected NDC    |
| Decision support                 | Monitor, investigate candidate, professional review or a separately saved response option                   | Records intent, not procurement or prescribing execution                                    |
| Readable artifact                | Script-free HTML report and full evidence JSON                                                              | Selected candidate expanded; other comparisons can be expanded before printing              |
| Persistence and isolation        | Mongo repositories, organisation scope and optimistic writes                                                | Locally exercised, not a penetration test or hosted service                                 |
| Technical evaluation             | Frozen 400-listing audit; 30 explicit source-backed comparison annotations; blank independent review packet | Same-assistant purposive annotations are not independent accuracy                           |
| Forecasting research             | Versioned historical cohort and frozen temporal persistence baselines                                       | Baselines do not establish useful resolution discrimination; no prediction is deployed      |

The spatial workspace follows the earlier God's Eye View inspiration. Source status filtering distinguishes Current, Resolved and planned discontinuation. Optional scenario and logistics forms are nested away from the evidence-first workflow.

## Dated acceptance results

A real refresh retrieved 1,582 shortage rows, reduced to 1,555 stable identities, plus 300 recent recall reports: 1,855 monitor records. Shortage statuses included 1,134 Current, 402 To Be Discontinued and 19 Resolved identities. These are dated presentation/identity counts, not independent shortage episodes. The shortage query exhausted its reported total; recall coverage remained partial against 18,002 FDA reports. Paged retrieval is not atomic.

A heparin case associated product NDC 63323-519 directly, saved 100 candidate listings (37 excluded in this run), retained its opening evidence, loaded two live versions and 28 printed-name archive captures, then saved an investigate-candidate action with no inventory/price scenario. A sodium-chloride recall case preserved its lot scope and recorded professional-review intent without requiring medicine analysis. Both are engineering acceptance on real public evidence, not hospital transactions.

API checks passed: login, bodyless refresh, unauthenticated rejection, cross-organisation case/report/archive rejection, saved notes, watch add/read/remove and a competing case update rejected with HTTP 409. Separate-database repository checks passed for unchanged-refresh idempotence, immutable version payloads, older-cache rejection, pruning that preserves history, optimistic writes and exact printed-name archive association. Reimporting all 47 original snapshots retained zero new copies; changed interpretations are refused.

434 TypeScript tests across 35 files passed. API/worker/web and root tooling types passed. Python ruff formatting/lint, mypy and all 118 tests passed. The web production build passed with a 1.318 MB minified chunk warning. Python reported a Starlette/AnyIO deprecation warning. Final verification also runs the source/secret/fixture/provenance gates and generated-context check. These checks establish engineering behavior, not forecast accuracy or clinical suitability.

## What the audit found

One initial annotation used an unfinished listing under NDC 65862-585 from an exploratory query; the exact discovery query returned a finished listing. The original disagreement is retained. Replay now binds records to their exact source query rather than overwriting a global map by NDC. After raw-source inspection and correction, the 30 literal attribute/exclusion annotations replay without disagreements. Approval and shortage joins are reused from frozen candidate sets and are not independently labelled in this audit.

This prompted two additional runtime guards: competing retrieved listings under one NDC are retained but excluded from selection, and older saved ambiguous sets cannot be selected by NDC. Mixed presentation shortage statuses remain mixed; conflicting/missing availability stays unknown. Missing, unreadable or historically future source dates are not joined. Automated tests cover those guards.

## Why this is capstone work

The contribution is an implemented evidence workflow, conservative identity/attribute rules, durable source provenance, uncertainty handling and reproducible evaluation of a healthcare supply-chain question. Industry systems inspired the scope; we do not claim invention of disruption sensing, a validated commercial decision studio, clinical equivalence, prediction accuracy or patent novelty.

The historical experiment is a defensible negative finding: high always-Current accuracy largely reflects the class distribution, and the baselines miss Resolved outcomes at the standard threshold. Exposing that result is more useful than deploying an unsupported probability.

## Review sequence

1. State the analyst, problem, US source scope and the question the app answers.
2. Inspect an actual FDA event: status, presentation, identifiers, reason, lot restrictions, query and fetch time.
3. Open the investigation and identify the medicine. Explain direct NDC identity versus generic/company association.
4. Inspect one matching and one differing/excluded candidate, including concentration, route and approval limits.
5. Inspect live field changes and the separately labelled archive association. Explain missing periods and parser diagnostics.
6. Record an evidence-based next action. Open the report and download HTML plus JSON.
7. Present the technical audit and historical baseline results, including limitations and the initial corrected annotation.

An institution that does not require a live demonstration can review the exported real-source investigations, architecture, code context, technical audit and validation evidence. Do not present stored acceptance cases as actual procurement decisions.

## Human work and Phase 2

The independent review packet has 30 raw source-backed cases and blank answer sheets. Two teammates can complete separate sheets without seeing the same-assistant answer key, preserve disagreements, and adjudicate against the printed facts. That human evaluation is prepared, not fabricated or marked complete.

Phase 2 can improve eligible historical cohorts and identity alignment, evaluate contemporaneous availability/news features against frozen baselines, integrate release characteristics, and conduct usability/independent matching review. Real inventory, supplier offers, delivery endpoints and validated carrier contracts are prerequisites for operational stockout, cost and route decisions. Cost benchmarks, road exposure, live quotes and deployment remain later scope.

See [current implementation](02_CURRENT_STATE.md), [workflows](05_FEATURE_WORKFLOWS.md), [data boundaries](04_DATA_AND_EVIDENCE.md), [historical data](12_HISTORICAL_DATA_LAYER.md) and [persistence evaluation](13_PERSISTENCE_EVALUATION.md).

## Globe interaction update

The accepted globe-first redesign adds clustered city-record selection, camera context return, collapsible layers/record drawers, expanded investigations and selectable retained source observations. It improves presentation of the completed evidence workflow and preserves its scope. National shortages remain unpinned; city points remain firm-city context. See [the globe workspace](15_GLOBE_WORKSPACE.md) for source attribution, dated browser checks and new focused tests. Earlier dated acceptance and evaluation results above remain historical evidence.
