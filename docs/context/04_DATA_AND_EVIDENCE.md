# Data, provenance and observability

The main constraint is **what the evidence can establish**, not whether an API can return a plausible number. VitaLink distinguishes REAL source observations, DERIVED calculations from identified inputs, MODELLED outputs with sensitivity bands, and SCENARIO assumptions. A derived value is only as meaningful as the semantics of its inputs.

| Evidence                | Used now                                                    | What it establishes                                                               | What it does not establish                                                    |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| openFDA enforcement     | Regulatory monitor, signal ingestion, recall proxy counts   | Reported recalling firm, identified product/lot and report scope                  | A whole company's production shutdown or every linked medicine recalled       |
| openFDA shortages       | Presentation monitor and signals                            | Published national shortage status and reported presentation availability         | Stock at a supplier, hospital or Indian pharmacy                              |
| openFDA NDC/labels      | Catalogue analysis, storage extraction, candidate discovery | Listed product, labeler, ingredient, strength, form, route and label instructions | API manufacturer, physical plant location or guaranteed commercial supply     |
| openFDA Drugs@FDA       | Candidate approval evidence                                 | Approved application, sponsor, therapeutic-equivalence code and marketing status  | Substitutability; an absent TE code is no published code, not non-equivalence |
| GDELT                   | News ingestion and targeted corroboration                   | Retrieved articles and reporting relationships                                    | Independent truth merely because several URLs repeat one story                |
| Nominatim/OSM           | Bounded recalling-firm city geocoding and map               | A city-level geographic reference                                                 | A verified factory or connected delivery route                                |
| Comtrade client         | Existing connector/catalogue tooling                        | Aggregate trade context where returned                                            | Company-specific shipments or supplier-to-factory edges                       |
| OSRM and hazard clients | Connector primitives exist                                  | Potential basis for future endpoint routing and public hazard inspection          | A completed route-comparison workflow, closure proof or delay forecast        |
| Operator inputs         | Optional trace, shipment and response forms                 | The analyst's stated scenario or documented organisation input                    | A public-source observation unless explicitly supplied with evidence          |

## Scope preservation

The FDA's national shortage status and a presentation's availability are separate fields. A Current shortage can include Available presentations. Unknown information stays unknown. Recall matching by product NDC still requires the reported lot scope; generic or company matching is an association for investigation, not direct recall applicability.

The feed caps are 300 recent recall reports and 1,000 current shortage presentations. Deduplication retains stable identities and the newest version. Partial retrieval or errors must remain visible in source health. Catalogue and model inputs have their own coverage limits; a capped recall window cannot be called a complete failure history.

Two FDA endpoints are one originating authority. News verification checks independence by agency/domain instead of counting URLs. A corroboration request that fails or is rate limited is **not attempted**, which is different from a successful search with no support. Official regulatory evidence appears separately from corroborated news alerts.

## Reliability interpretation

The Python implementation reproduces Tucker & Daskin's published equations and configuration table. Catalogue labeler concentration supplies a plant-redundancy proxy. The upstream API tier is unobserved, so `z_api=1` is an explicit SCENARIO assumption, not a derived supplier count. Recovery rates use the paper baseline; recall events are a failure-rate proxy.

Sensitivity bands are not empirically calibrated confidence intervals. A high calculated availability is not a prediction that a current incident will cause no shortage. Tests establish arithmetic and contracts; historical prediction validation requires time-stamped inputs and independently defined outcomes.

## Candidate screening

Implemented against live openFDA. Candidates are retrieved by active ingredient and compared on ingredients, strength, dosage form, administration route and marketing category, each with its own `match`/`differs`/`unknown` verdict and no aggregate score.

Strength is compared as a normalised concentration rather than as text or as a bare number: `5000 [USP'U]/mL` and `5,000 UNITS/100mL` print the same figure and differ by a hundredfold. Unreadable or incommensurable strengths return `unknown`, never `match`. USP Units and International Units are held in separate families; unqualified "UNITS" is read as a USP unit only because comparison happens within one active ingredient.

Approval and therapeutic-equivalence evidence comes from Drugs@FDA rather than the Orange Book, whose equivalent codes are published only as a downloadable archive that gate 2 would reject. Where an application covers several approved products the code is resolved only when the products matching the listing's strength agree. A matching ingredient alone is insufficient for a substitution claim, and the absence of a TE code is never displayed as non-equivalence.

DailyMed remains a possible addition for release characteristics, which no current source supplies.

CMS NADAC could supply dated acquisition-cost benchmarks for covered products; it would not supply a personalised offer or landed cost. Public road routing with explicit endpoints and covered hazard alerts could support route-exposure comparison. It would not prove capacity, closure, cold-chain feasibility or international freight availability. These are [roadmap items](06_REVIEW_AND_ROADMAP.md), with source links in [research](10_COMPETITOR_RESEARCH.md).

## Coverage evaluation

`eval/audit.ts` calculates coverage and source fingerprints from frozen public snapshots without network calls. The dated local snapshot contained 1,298 unique incidents. Store snapshot dates and hashes alongside any results. Coverage metrics count populated identifiers, lots, dates and geography; they do not measure prediction accuracy.

Secrets, accounts and private cases do not belong in a public snapshot. Runtime databases and generated local login files are outside the versioned repository. For reproducibility commands, see [setup and validation](07_LOCAL_SETUP_AND_VALIDATION.md).
