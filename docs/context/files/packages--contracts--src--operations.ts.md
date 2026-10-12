---
source: 'packages/contracts/src/operations.ts'
component: contracts
generated: true
---

# packages/contracts/src/operations.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Defines incidents, coverage/worker health, matching, analysis, cases, watches, response inputs and history shared by API and browser.

**Component:** Defines shared runtime-validated domain contracts and provenance envelopes for observations, derived values, models and assumptions.

## Source structure

- `incidentSchema` — binding, [line 9](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L9).
- `Incident` — TypeAliasDeclaration, [line 40](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L40).
- `incidentVersionSchema` — binding, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L42).
- `IncidentVersion` — TypeAliasDeclaration, [line 51](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L51).
- `incidentHistorySchema` — binding, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L52).
- `IncidentHistory` — TypeAliasDeclaration, [line 59](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L59).
- `feedStatusSchema` — binding, [line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L61).
- `FeedStatus` — TypeAliasDeclaration, [line 72](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L72).
- `matchSchema` — binding, [line 74](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L74).
- `IncidentMatch` — TypeAliasDeclaration, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L81).
- `analysisSchema` — binding, [line 83](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L83).
- `InvestigationAnalysis` — TypeAliasDeclaration, [line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L99).
- `attributeVerdictSchema` — binding, [line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L111).
- `AttributeVerdict` — TypeAliasDeclaration, [line 112](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L112).
- `candidateAttributeSchema` — binding, [line 114](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L114).
- `CandidateAttribute` — TypeAliasDeclaration, [line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L122).
- `equivalenceSchema` — binding, [line 129](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L129).
- `CandidateEquivalence` — TypeAliasDeclaration, [line 137](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L137).
- `productCandidateSchema` — binding, [line 139](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L139).
- `ProductCandidate` — TypeAliasDeclaration, [line 159](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L159).
- `candidateSetSchema` — binding, [line 161](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L161).
- `CandidateSet` — TypeAliasDeclaration, [line 177](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L177).
- `MAX_LABEL_LENGTH` — binding, [line 179](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L179).
- `MAX_EVIDENCE_LENGTH` — binding, [line 180](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L180).
- `MIN_BASIS_LENGTH` — binding, [line 181](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L181).
- `MAX_OPTIONS` — binding, [line 182](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L182).
- `MAX_WATCH_LENGTH` — binding, [line 183](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L183).
- `MIN_WATCH_LENGTH` — binding, [line 184](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L184).
- `MAX_DAYS` — binding, [line 185](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L185).
- `MAX_RATIONALE_LENGTH` — binding, [line 186](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L186).
- `MAX_COST` — binding, [line 187](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L187).
- `responseOptionSchema` — binding, [line 188](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L188).
- `responsePlanInputSchema` — binding, [line 211](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L211).
- `ResponsePlanInput` — TypeAliasDeclaration, [line 229](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L229).
- `responsePlanSchema` — binding, [line 230](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L230).
- `ResponsePlan` — TypeAliasDeclaration, [line 245](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L245).
- `investigationDecisionInputSchema` — binding, [line 247](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L247).
- `InvestigationDecisionInput` — TypeAliasDeclaration, [line 262](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L262).
- `investigationDecisionSchema` — binding, [line 263](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L263).
- `investigationSchema` — binding, [line 268](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L268).
- `Investigation` — TypeAliasDeclaration, [line 287](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L287).
- `investigationReportSchema` — binding, [line 289](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L289).
- `InvestigationReport` — TypeAliasDeclaration, [line 296](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L296).
- `watchSchema` — binding, [line 298](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L298).
- `Watch` — TypeAliasDeclaration, [line 304](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L304).

## Static dependencies

- [packages/contracts/src/graph.ts](./packages--contracts--src--graph.ts.md)
- [packages/contracts/src/operational-archive.ts](./packages--contracts--src--operational-archive.ts.md)
- [packages/contracts/src/provenance.ts](./packages--contracts--src--provenance.ts.md)
- [packages/contracts/src/reliability.ts](./packages--contracts--src--reliability.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `3e78d70d82b82206ddd2d4809c90abeb2a6a18d3b65ac713c7a9221b26f43bf0`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
