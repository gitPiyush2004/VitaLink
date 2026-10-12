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

- `incidentSchema` — binding, [line 8](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L8).
- `Incident` — TypeAliasDeclaration, [line 39](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L39).
- `feedStatusSchema` — binding, [line 41](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L41).
- `FeedStatus` — TypeAliasDeclaration, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L52).
- `matchSchema` — binding, [line 54](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L54).
- `IncidentMatch` — TypeAliasDeclaration, [line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L61).
- `analysisSchema` — binding, [line 63](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L63).
- `InvestigationAnalysis` — TypeAliasDeclaration, [line 79](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L79).
- `attributeVerdictSchema` — binding, [line 91](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L91).
- `AttributeVerdict` — TypeAliasDeclaration, [line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L92).
- `candidateAttributeSchema` — binding, [line 94](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L94).
- `CandidateAttribute` — TypeAliasDeclaration, [line 102](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L102).
- `equivalenceSchema` — binding, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L109).
- `CandidateEquivalence` — TypeAliasDeclaration, [line 117](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L117).
- `productCandidateSchema` — binding, [line 119](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L119).
- `ProductCandidate` — TypeAliasDeclaration, [line 139](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L139).
- `candidateSetSchema` — binding, [line 141](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L141).
- `CandidateSet` — TypeAliasDeclaration, [line 157](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L157).
- `MAX_LABEL_LENGTH` — binding, [line 159](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L159).
- `MAX_EVIDENCE_LENGTH` — binding, [line 160](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L160).
- `MIN_BASIS_LENGTH` — binding, [line 161](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L161).
- `MAX_OPTIONS` — binding, [line 162](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L162).
- `MAX_WATCH_LENGTH` — binding, [line 163](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L163).
- `MIN_WATCH_LENGTH` — binding, [line 164](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L164).
- `MAX_DAYS` — binding, [line 165](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L165).
- `MAX_COST` — binding, [line 166](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L166).
- `responseOptionSchema` — binding, [line 167](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L167).
- `responsePlanInputSchema` — binding, [line 190](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L190).
- `ResponsePlanInput` — TypeAliasDeclaration, [line 208](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L208).
- `responsePlanSchema` — binding, [line 209](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L209).
- `ResponsePlan` — TypeAliasDeclaration, [line 224](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L224).
- `investigationSchema` — binding, [line 226](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L226).
- `Investigation` — TypeAliasDeclaration, [line 244](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L244).
- `watchSchema` — binding, [line 246](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L246).
- `Watch` — TypeAliasDeclaration, [line 252](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L252).

## Static dependencies

- [packages/contracts/src/graph.ts](./packages--contracts--src--graph.ts.md)
- [packages/contracts/src/provenance.ts](./packages--contracts--src--provenance.ts.md)
- [packages/contracts/src/reliability.ts](./packages--contracts--src--reliability.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `10161b2f80069d95a2ed08807fafb2f360751bdc03fd8f54869d1a46f264b85e`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
