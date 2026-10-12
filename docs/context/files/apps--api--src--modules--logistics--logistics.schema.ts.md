---
source: 'apps/api/src/modules/logistics/logistics.schema.ts'
component: logistics
generated: true
---

# apps/api/src/modules/logistics/logistics.schema.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Validates boundary inputs and rejects malformed domain requests before service work.

**Component:** Derives shipment constraints, excludes infeasible/unknown-critical-capability carriers and scores available evidence; no live quote has been established.

## Source structure

- `MAX_WEIGHT_KG` — binding, [line 16](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L16).
- `MAX_PACKAGES` — binding, [line 17](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L17).
- `MAX_DIMENSION_CM` — binding, [line 18](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L18).
- `MAX_BUDGET_INR` — binding, [line 19](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L19).
- `MAX_POPULATION` — binding, [line 20](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L20).
- `ISO_COUNTRY_CODE_LENGTH` — binding, [line 22](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L22).
- `LONGITUDE_LIMIT` — binding, [line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L23).
- `LATITUDE_LIMIT` — binding, [line 24](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L24).
- `MAX_PREFERENCE_BONUS` — binding, [line 32](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L32).
- `placeBodySchema` — binding, [line 34](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L34).
- `PlaceBody` — TypeAliasDeclaration, [line 47](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L47).
- `consignmentSchema` — binding, [line 49](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L49).
- `preferenceSchema` — binding, [line 76](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L76).
- `recommendFromCascadeBodySchema` — binding, [line 80](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L80).
- `RecommendFromCascadeBody` — TypeAliasDeclaration, [line 87](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L87).
- `rerunBodySchema` — binding, [line 89](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L89).
- `RerunBody` — TypeAliasDeclaration, [line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L95).
- `shipmentParamsSchema` — binding, [line 97](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L97).
- `ShipmentParams` — TypeAliasDeclaration, [line 98](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L98).
- `urgencyPreviewQuerySchema` — binding, [line 100](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L100).
- `UrgencyPreviewQuery` — TypeAliasDeclaration, [line 104](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L104).
- `listLogisticsQuerySchema` — binding, [line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L106).
- `ListLogisticsQuery` — TypeAliasDeclaration, [line 107](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/logistics.schema.ts#L107).

## Static dependencies

- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [apps/api/src/modules/logistics/logistics.controller.ts](./apps--api--src--modules--logistics--logistics.controller.ts.md)
- [apps/api/src/modules/logistics/logistics.routes.ts](./apps--api--src--modules--logistics--logistics.routes.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `db7d1410815e385280403d614b2888101f1ce1ac6ba7d5aace6314ab4acea5bf`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
