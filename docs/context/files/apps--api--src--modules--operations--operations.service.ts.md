---
source: 'apps/api/src/modules/operations/operations.service.ts'
component: operations
generated: true
---

# apps/api/src/modules/operations/operations.service.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Orchestrates case lifecycle, analysis invalidation, conditional trace/response, context-validated recommendation links and decision history.

**Component:** Connects public regulatory incidents to organisation-scoped investigations, analysis, conditional response inputs and decision history.

## Source structure

- `updateDescription` — FunctionDeclaration, [line 21](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L21).
- `OperationsService` — ClassDeclaration, [line 34](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L34).
- `OperationsService.dashboard` — method, [line 41](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L41).
- `OperationsService.get` — method, [line 51](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L51).
- `OperationsService.create` — method, [line 57](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L57).
- `OperationsService.save` — method, [line 82](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L82).
- `OperationsService.analyse` — method, [line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L99).
- `OperationsService.discoverCandidates` — method, [line 126](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L126).
- `OperationsService.trace` — method, [line 145](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L145).
- `OperationsService.linkRecommendation` — method, [line 177](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L177).
- `OperationsService.plan` — method, [line 204](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L204).
- `OperationsService.update` — method, [line 227](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L227).
- `OperationsService.sourceHistory` — method, [line 259](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L259).
- `OperationsService.archive` — method, [line 273](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L273).
- `OperationsService.report` — method, [line 278](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L278).
- `OperationsService.decide` — method, [line 288](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L288).
- `OperationsService.watch` — method, [line 308](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L308).
- `OperationsService.removeWatch` — method, [line 314](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/operations.service.ts#L314).

## Static dependencies

- [apps/api/src/modules/cascade/index.ts](./apps--api--src--modules--cascade--index.ts.md)
- [apps/api/src/modules/graph/index.ts](./apps--api--src--modules--graph--index.ts.md)
- [apps/api/src/modules/logistics/index.ts](./apps--api--src--modules--logistics--index.ts.md)
- [apps/api/src/modules/operations/domain/decision.ts](./apps--api--src--modules--operations--domain--decision.ts.md)
- [apps/api/src/modules/operations/domain/response-plan.ts](./apps--api--src--modules--operations--domain--response-plan.ts.md)
- [apps/api/src/modules/operations/operations.analysis.ts](./apps--api--src--modules--operations--operations.analysis.ts.md)
- [apps/api/src/modules/operations/operations.candidates.ts](./apps--api--src--modules--operations--operations.candidates.ts.md)
- [apps/api/src/modules/operations/operations.repository.ts](./apps--api--src--modules--operations--operations.repository.ts.md)
- [apps/api/src/shared/errors/index.ts](./apps--api--src--shared--errors--index.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: `node:crypto`.

## Static consumers

- [apps/api/src/modules/operations/**tests**/review-workflow.test.ts](./apps--api--src--modules--operations--__tests__--review-workflow.test.ts.md)
- [apps/api/src/modules/operations/index.ts](./apps--api--src--modules--operations--index.ts.md)
- [apps/api/src/modules/operations/operations.controller.ts](./apps--api--src--modules--operations--operations.controller.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `e0cd74c6c1acbacbbb05fd7313383ba4e5f5ddc0065640205987d1ac5950110b`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
