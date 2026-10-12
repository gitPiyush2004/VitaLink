---
source: 'packages/contracts/src/provenance.ts'
component: contracts
generated: true
---

# packages/contracts/src/provenance.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Enforces origin tags, required source/method metadata and model sensitivity-band requirements for quantities.

**Component:** Defines shared runtime-validated domain contracts and provenance envelopes for observations, derived values, models and assumptions.

## Source structure

- `PROVENANCE_TAGS` — binding, [line 25](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L25).
- `provenanceTagSchema` — binding, [line 27](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L27).
- `ProvenanceTag` — TypeAliasDeclaration, [line 28](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L28).
- `provenanceSchema` — binding, [line 31](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L31).
- `Provenance` — TypeAliasDeclaration, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L52).
- `bandSchema` — binding, [line 55](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L55).
- `Band` — TypeAliasDeclaration, [line 56](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L56).
- `quantityShape` — binding, [line 58](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L58).
- `refineCovenant` — FunctionDeclaration, [line 71](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L71).
- `quantitySchema` — binding, [line 117](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L117).
- `Quantity` — TypeAliasDeclaration, [line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L118).
- `RealInput` — TypeAliasDeclaration, [line 133](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L133).
- `real` — FunctionDeclaration, [line 140](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L140).
- `DerivedInput` — TypeAliasDeclaration, [line 154](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L154).
- `derived` — FunctionDeclaration, [line 157](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L157).
- `ModelledInput` — TypeAliasDeclaration, [line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L172).
- `modelled` — FunctionDeclaration, [line 179](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L179).
- `ScenarioInput` — TypeAliasDeclaration, [line 205](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L205).
- `scenario` — FunctionDeclaration, [line 214](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L214).
- `isPointValue` — FunctionDeclaration, [line 232](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/provenance.ts#L232).

## Static dependencies

No resolved repository source imports.

Other import specifiers: `zod`.

## Static consumers

- [packages/contracts/src/**tests**/provenance.test.ts](./packages--contracts--src--__tests__--provenance.test.ts.md)
- [packages/contracts/src/cascade.ts](./packages--contracts--src--cascade.ts.md)
- [packages/contracts/src/catalog.ts](./packages--contracts--src--catalog.ts.md)
- [packages/contracts/src/common.ts](./packages--contracts--src--common.ts.md)
- [packages/contracts/src/graph.ts](./packages--contracts--src--graph.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)
- [packages/contracts/src/logistics-decision.ts](./packages--contracts--src--logistics-decision.ts.md)
- [packages/contracts/src/logistics.ts](./packages--contracts--src--logistics.ts.md)
- [packages/contracts/src/operations.ts](./packages--contracts--src--operations.ts.md)
- [packages/contracts/src/reliability.ts](./packages--contracts--src--reliability.ts.md)
- [packages/contracts/src/scenarios.ts](./packages--contracts--src--scenarios.ts.md)
- [packages/contracts/src/signals.ts](./packages--contracts--src--signals.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `953c23b263d91d51747e2c760f36e64e109f88de3f9b453692126b28f8ddd73e`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
