---
source: 'apps/api/src/modules/logistics/logistics.service.ts'
component: logistics
generated: true
---

# apps/api/src/modules/logistics/logistics.service.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Orchestrates module domain calculations, dependencies and repository calls; follow imports and public methods below.

**Component:** Derives shipment constraints, excludes infeasible/unknown-critical-capability carriers and scores available evidence; no live quote has been established.

## Source structure

- `RecommendFromCascadeInput` — TypeAliasDeclaration, [line 50](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L50).
- `RecommendationWithShipment` — TypeAliasDeclaration, [line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L61).
- `LogisticsDeps` — TypeAliasDeclaration, [line 73](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L73).
- `LogisticsService` — ClassDeclaration, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L81).
- `LogisticsService.recommendFromCascade` — method, [line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L106).
- `LogisticsService.loadContext` — method, [line 169](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L169).
- `LogisticsService.rerun` — method, [line 203](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L203).
- `LogisticsService.quoteAndScore` — method, [line 272](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L272).
- `LogisticsService.loadCapabilities` — method, [line 337](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L337).
- `LogisticsService.buildChangeLog` — method, [line 365](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L365).
- `LogisticsService.getShipment` — method, [line 392](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L392).
- `LogisticsService.listShipments` — method, [line 396](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L396).
- `LogisticsService.getRecommendation` — method, [line 400](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L400).
- `LogisticsService.listRecommendations` — method, [line 404](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L404).
- `LogisticsService.listCarriers` — method, [line 415](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L415).
- `LogisticsService.previewUrgency` — method, [line 426](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.service.ts#L426).

## Static dependencies

- [apps/api/src/config/constants.ts](./apps--api--src--config--constants.ts.md)
- [apps/api/src/config/weights.ts](./apps--api--src--config--weights.ts.md)
- [apps/api/src/modules/cascade/index.ts](./apps--api--src--modules--cascade--index.ts.md)
- [apps/api/src/modules/catalog/index.ts](./apps--api--src--modules--catalog--index.ts.md)
- [apps/api/src/modules/logistics/domain/carrier-fallbacks.ts](./apps--api--src--modules--logistics--domain--carrier-fallbacks.ts.md)
- [apps/api/src/modules/logistics/domain/recommend.ts](./apps--api--src--modules--logistics--domain--recommend.ts.md)
- [apps/api/src/modules/logistics/domain/shipment-derivation.ts](./apps--api--src--modules--logistics--domain--shipment-derivation.ts.md)
- [apps/api/src/modules/logistics/domain/urgency.ts](./apps--api--src--modules--logistics--domain--urgency.ts.md)
- [apps/api/src/modules/logistics/logistics.repository.ts](./apps--api--src--modules--logistics--logistics.repository.ts.md)
- [apps/api/src/shared/connectors/carriers.ts](./apps--api--src--shared--connectors--carriers.ts.md)
- [apps/api/src/shared/errors/index.ts](./apps--api--src--shared--errors--index.ts.md)
- [apps/api/src/shared/logger/index.ts](./apps--api--src--shared--logger--index.ts.md)
- [packages/connectors/src/index.ts](./packages--connectors--src--index.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: none.

## Static consumers

- [apps/api/src/modules/logistics/index.ts](./apps--api--src--modules--logistics--index.ts.md)
- [apps/api/src/modules/logistics/logistics.controller.ts](./apps--api--src--modules--logistics--logistics.controller.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `0ada6364ccc89ec2b2f6e9faddbb66395b541176b9b93d7efcfa5d1116c61b06`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
