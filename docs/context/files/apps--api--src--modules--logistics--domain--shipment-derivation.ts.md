---
source: 'apps/api/src/modules/logistics/domain/shipment-derivation.ts'
component: logistics
generated: true
---

# apps/api/src/modules/logistics/domain/shipment-derivation.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Derives medicine handling requirements and urgency from the chosen label/trace and explicitly supplied consignment.

**Component:** Derives shipment constraints, excludes infeasible/unknown-critical-capability carriers and scores available evidence; no live quote has been established.

## Source structure

- `CM_PER_M` — binding, [line 60](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L60).
- `DIMENSIONS` — binding, [line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L61).
- `CUBIC_CM_PER_CUBIC_M` — binding, [line 62](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L62).
- `VOLUME_DECIMALS` — binding, [line 64](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L64).
- `CascadeContext` — TypeAliasDeclaration, [line 67](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L67).
- `DrugContext` — TypeAliasDeclaration, [line 78](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L78).
- `ConsignmentInput` — TypeAliasDeclaration, [line 94](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L94).
- `DeriveShipmentInput` — TypeAliasDeclaration, [line 107](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L107).
- `DerivedShipment` — TypeAliasDeclaration, [line 115](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L115).
- `volumeM3` — FunctionDeclaration, [line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L130).
- `explainConsignment` — FunctionDeclaration, [line 141](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L141).
- `specialHandlingFor` — FunctionDeclaration, [line 163](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L163).
- `explainLabelConstraints` — FunctionDeclaration, [line 170](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L170).
- `explainLane` — FunctionDeclaration, [line 188](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L188).
- `DerivationSource` — TypeAliasDeclaration, [line 196](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L196).
- `buildQuantities` — FunctionDeclaration, [line 204](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L204).
- `ResolvedConstraints` — TypeAliasDeclaration, [line 242](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L242).
- `buildRequest` — FunctionDeclaration, [line 254](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L254).
- `requireTemperature` — FunctionDeclaration, [line 305](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L305).
- `requireDeadline` — FunctionDeclaration, [line 317](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L317).
- `deriveShipment` — FunctionDeclaration, [line 340](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/domain/shipment-derivation.ts#L340).

## Static dependencies

- [apps/api/src/config/constants.ts](./apps--api--src--config--constants.ts.md)
- [apps/api/src/modules/logistics/domain/urgency.ts](./apps--api--src--modules--logistics--domain--urgency.ts.md)
- [apps/api/src/shared/errors/index.ts](./apps--api--src--shared--errors--index.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: none.

## Static consumers

- [apps/api/src/modules/logistics/domain/carrier-fallbacks.ts](./apps--api--src--modules--logistics--domain--carrier-fallbacks.ts.md)
- [apps/api/src/modules/logistics/logistics.controller.ts](./apps--api--src--modules--logistics--logistics.controller.ts.md)
- [apps/api/src/modules/logistics/logistics.service.ts](./apps--api--src--modules--logistics--logistics.service.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `5b953b2da932d1d4d6120ab5bf10d6a693c247b1d482dc89b713d62404e32ef9`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
