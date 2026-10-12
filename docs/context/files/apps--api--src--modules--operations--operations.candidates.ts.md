---
source: 'apps/api/src/modules/operations/operations.candidates.ts'
component: operations
generated: true
---

# apps/api/src/modules/operations/operations.candidates.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Supports this component through the configuration or source declarations identified below; consult the linked source for full behavior.

**Component:** Connects public regulatory incidents to organisation-scoped investigations, analysis, conditional response inputs and decision history.

## Source structure

- `CANDIDATE_LIMIT` — binding, [line 37](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L37).
- `APPROVAL_BATCH` — binding, [line 39](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L39).
- `MAX_APPROVAL_BATCHES` — binding, [line 41](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L41).
- `SHORTAGE_LIMIT` — binding, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L42).
- `quote` — FunctionDeclaration, [line 44](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L44).
- `Source` — TypeAliasDeclaration, [line 48](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L48).
- `toIngredients` — FunctionDeclaration, [line 50](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L50).
- `toIdentity` — FunctionDeclaration, [line 57](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L57).
- `toSource` — FunctionDeclaration, [line 68](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L68).
- `CandidateDiscovery` — ClassDeclaration, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L81).
- `CandidateDiscovery.reference` — method, [line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L92).
- `CandidateDiscovery.discover` — method, [line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L118).
- `CandidateDiscovery.approvals` — method, [line 177](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L177).
- `CandidateDiscovery.shortages` — method, [line 203](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L203).
- `toApproval` — FunctionDeclaration, [line 226](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L226).
- `limitsFor` — FunctionDeclaration, [line 252](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L252).
- `candidateCoverage` — FunctionDeclaration, [line 290](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L290).
- `discoveryLimits` — FunctionDeclaration, [line 305](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.candidates.ts#L305).

## Static dependencies

- [apps/api/src/modules/operations/domain/candidate-identity.ts](./apps--api--src--modules--operations--domain--candidate-identity.ts.md)
- [apps/api/src/modules/operations/domain/candidate-reference.ts](./apps--api--src--modules--operations--domain--candidate-reference.ts.md)
- [apps/api/src/modules/operations/domain/candidates.ts](./apps--api--src--modules--operations--domain--candidates.ts.md)
- [apps/api/src/modules/operations/domain/equivalence.ts](./apps--api--src--modules--operations--domain--equivalence.ts.md)
- [apps/api/src/modules/operations/domain/shortage-evidence.ts](./apps--api--src--modules--operations--domain--shortage-evidence.ts.md)
- [packages/connectors/src/index.ts](./packages--connectors--src--index.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: none.

## Static consumers

- [apps/api/src/modules/operations/**tests**/candidate-discovery.test.ts](./apps--api--src--modules--operations--__tests__--candidate-discovery.test.ts.md)
- [apps/api/src/modules/operations/**tests**/review-workflow.test.ts](./apps--api--src--modules--operations--__tests__--review-workflow.test.ts.md)
- [apps/api/src/modules/operations/index.ts](./apps--api--src--modules--operations--index.ts.md)
- [apps/api/src/modules/operations/operations.service.ts](./apps--api--src--modules--operations--operations.service.ts.md)
- [eval/public-data.ts](./eval--public-data.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `7ceb667ebf85c918944663978924497d278afe74748758de79313d4a92c31e6c`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
