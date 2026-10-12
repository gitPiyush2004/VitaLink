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
- `MAX_LABEL_LENGTH` — binding, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L81).
- `MAX_EVIDENCE_LENGTH` — binding, [line 82](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L82).
- `MIN_BASIS_LENGTH` — binding, [line 83](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L83).
- `MAX_OPTIONS` — binding, [line 84](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L84).
- `MAX_WATCH_LENGTH` — binding, [line 85](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L85).
- `MIN_WATCH_LENGTH` — binding, [line 86](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L86).
- `MAX_DAYS` — binding, [line 87](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L87).
- `MAX_COST` — binding, [line 88](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L88).
- `responseOptionSchema` — binding, [line 89](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L89).
- `responsePlanInputSchema` — binding, [line 112](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L112).
- `ResponsePlanInput` — TypeAliasDeclaration, [line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L130).
- `responsePlanSchema` — binding, [line 131](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L131).
- `ResponsePlan` — TypeAliasDeclaration, [line 146](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L146).
- `investigationSchema` — binding, [line 148](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L148).
- `Investigation` — TypeAliasDeclaration, [line 165](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L165).
- `watchSchema` — binding, [line 167](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L167).
- `Watch` — TypeAliasDeclaration, [line 173](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/operations.ts#L173).

## Static dependencies

- [packages/contracts/src/graph.ts](./packages--contracts--src--graph.ts.md)
- [packages/contracts/src/provenance.ts](./packages--contracts--src--provenance.ts.md)
- [packages/contracts/src/reliability.ts](./packages--contracts--src--reliability.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `7d19e8c5a1666690890bcf008e8c17f59aad4d6cb64baf7347d15263671cd900`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
