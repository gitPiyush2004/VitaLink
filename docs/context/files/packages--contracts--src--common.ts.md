---
source: 'packages/contracts/src/common.ts'
component: contracts
generated: true
---

# packages/contracts/src/common.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Supports this component through the configuration or source declarations identified below; consult the linked source for full behavior.

**Component:** Defines shared runtime-validated domain contracts and provenance envelopes for observations, derived values, models and assumptions.

## Source structure

- `idSchema` — binding, [line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L23).
- `isoDateTimeSchema` — binding, [line 25](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L25).
- `geoPointSchema` — binding, [line 28](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L28).
- `GeoPoint` — TypeAliasDeclaration, [line 36](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L36).
- `placeSchema` — binding, [line 38](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L38).
- `Place` — TypeAliasDeclaration, [line 46](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L46).
- `paginationQuerySchema` — binding, [line 56](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L56).
- `PaginationQuery` — TypeAliasDeclaration, [line 60](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L60).
- `pageMetaSchema` — binding, [line 62](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L62).
- `PageMeta` — TypeAliasDeclaration, [line 67](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L67).
- `apiErrorSchema` — binding, [line 73](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L73).
- `ApiError` — TypeAliasDeclaration, [line 79](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L79).
- `successEnvelope` — FunctionDeclaration, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L81).
- `failureEnvelopeSchema` — binding, [line 91](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L91).
- `Success` — TypeAliasDeclaration, [line 96](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L96).
- `Failure` — TypeAliasDeclaration, [line 97](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L97).
- `ApiResponse` — TypeAliasDeclaration, [line 98](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L98).
- `ERROR_CODES` — binding, [line 104](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L104).
- `errorCodeSchema` — binding, [line 127](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L127).
- `ErrorCode` — TypeAliasDeclaration, [line 128](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/common.ts#L128).

## Static dependencies

- [packages/contracts/src/limits.ts](./packages--contracts--src--limits.ts.md)
- [packages/contracts/src/provenance.ts](./packages--contracts--src--provenance.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/contracts/src/auth.ts](./packages--contracts--src--auth.ts.md)
- [packages/contracts/src/cascade.ts](./packages--contracts--src--cascade.ts.md)
- [packages/contracts/src/catalog.ts](./packages--contracts--src--catalog.ts.md)
- [packages/contracts/src/events.ts](./packages--contracts--src--events.ts.md)
- [packages/contracts/src/graph.ts](./packages--contracts--src--graph.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)
- [packages/contracts/src/logistics-decision.ts](./packages--contracts--src--logistics-decision.ts.md)
- [packages/contracts/src/logistics.ts](./packages--contracts--src--logistics.ts.md)
- [packages/contracts/src/reliability.ts](./packages--contracts--src--reliability.ts.md)
- [packages/contracts/src/scenarios.ts](./packages--contracts--src--scenarios.ts.md)
- [packages/contracts/src/signals.ts](./packages--contracts--src--signals.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `f977e0b3487e6e5194a76bcd13eb04aefb3aae6a4008939afa1acd53eb9f8ebb`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
