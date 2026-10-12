---
source: 'packages/connectors/src/sources/openfda.client.ts'
component: connectors
generated: true
---

# packages/connectors/src/sources/openfda.client.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Defines/validates typed FDA enforcement, shortage, NDC and label requests and their provenance.

**Component:** Owns typed external HTTP, source parsing, provenance, caching, retries, rate limits and adapter availability.

## Source structure

- `MAX_LIMIT` — binding, [line 37](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L37).
- `MAX_COUNT_BUCKETS` — binding, [line 47](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L47).
- `metaSchema` — binding, [line 50](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L50).
- `envelopeSchema` — FunctionDeclaration, [line 62](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L62).
- `ndcProductSchema` — binding, [line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L75).
- `NdcProduct` — TypeAliasDeclaration, [line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L95).
- `drugsFdaSchema` — binding, [line 107](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L107).
- `DrugsFdaRecord` — TypeAliasDeclaration, [line 128](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L128).
- `labelSchema` — binding, [line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L130).
- `DrugLabel` — TypeAliasDeclaration, [line 148](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L148).
- `enforcementSchema` — binding, [line 150](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L150).
- `EnforcementReport` — TypeAliasDeclaration, [line 180](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L180).
- `shortageSchema` — binding, [line 182](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L182).
- `ShortageRecord` — TypeAliasDeclaration, [line 209](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L209).
- `OpenFdaQuery` — TypeAliasDeclaration, [line 215](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L215).
- `ENDPOINTS` — binding, [line 225](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L225).
- `EndpointName` — TypeAliasDeclaration, [line 233](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L233).
- `countBucketSchema` — binding, [line 239](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L239).
- `CountBucket` — TypeAliasDeclaration, [line 240](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L240).
- `OpenFdaClient` — ClassDeclaration, [line 242](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L242).
- `OpenFdaClient.searchNdc` — method, [line 245](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L245).
- `OpenFdaClient.searchLabels` — method, [line 249](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L249).
- `OpenFdaClient.searchEnforcement` — method, [line 253](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L253).
- `OpenFdaClient.searchShortages` — method, [line 257](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L257).
- `OpenFdaClient.searchDrugsFda` — method, [line 261](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L261).
- `OpenFdaClient.count` — method, [line 277](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L277).
- `OpenFdaClient.search` — method, [line 290](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L290).
- `buildUrl` — FunctionDeclaration, [line 333](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L333).
- `describeQuery` — FunctionDeclaration, [line 345](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L345).

## Static dependencies

- [packages/connectors/src/http/cached-client.ts](./packages--connectors--src--http--cached-client.ts.md)
- [packages/connectors/src/http/connector-error.ts](./packages--connectors--src--http--connector-error.ts.md)
- [packages/connectors/src/sources/source-registry.ts](./packages--connectors--src--sources--source-registry.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/connectors/src/sources/index.ts](./packages--connectors--src--sources--index.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `1c0bd4c2fc97eec787ee59a4afb3081ffbbcb90cbcb46599f16391d7a4d88ef6`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
