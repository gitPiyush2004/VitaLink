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

- `MAX_LIMIT` — binding, [line 29](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L29).
- `MAX_COUNT_BUCKETS` — binding, [line 39](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L39).
- `metaSchema` — binding, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L42).
- `envelopeSchema` — FunctionDeclaration, [line 54](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L54).
- `ndcProductSchema` — binding, [line 67](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L67).
- `NdcProduct` — TypeAliasDeclaration, [line 87](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L87).
- `drugsFdaSchema` — binding, [line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L99).
- `DrugsFdaRecord` — TypeAliasDeclaration, [line 120](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L120).
- `labelSchema` — binding, [line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L122).
- `DrugLabel` — TypeAliasDeclaration, [line 140](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L140).
- `enforcementSchema` — binding, [line 142](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L142).
- `EnforcementReport` — TypeAliasDeclaration, [line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L172).
- `shortageSchema` — binding, [line 174](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L174).
- `ShortageRecord` — TypeAliasDeclaration, [line 202](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L202).
- `OpenFdaQuery` — TypeAliasDeclaration, [line 208](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L208).
- `ENDPOINTS` — binding, [line 218](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L218).
- `EndpointName` — TypeAliasDeclaration, [line 226](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L226).
- `countBucketSchema` — binding, [line 232](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L232).
- `CountBucket` — TypeAliasDeclaration, [line 233](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L233).
- `FdaPage` — TypeAliasDeclaration, [line 235](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L235).
- `OpenFdaClient` — ClassDeclaration, [line 237](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L237).
- `OpenFdaClient.searchNdc` — method, [line 240](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L240).
- `OpenFdaClient.searchLabels` — method, [line 244](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L244).
- `OpenFdaClient.searchEnforcement` — method, [line 248](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L248).
- `OpenFdaClient.searchShortages` — method, [line 252](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L252).
- `OpenFdaClient.searchDrugsFda` — method, [line 256](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L256).
- `OpenFdaClient.count` — method, [line 272](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L272).
- `OpenFdaClient.search` — method, [line 285](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L285).
- `buildUrl` — FunctionDeclaration, [line 333](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L333).
- `describeQuery` — FunctionDeclaration, [line 345](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L345).

## Static dependencies

- [packages/connectors/src/http/cached-client.ts](./packages--connectors--src--http--cached-client.ts.md)
- [packages/connectors/src/http/connector-error.ts](./packages--connectors--src--http--connector-error.ts.md)
- [packages/connectors/src/sources/source-registry.ts](./packages--connectors--src--sources--source-registry.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/connectors/src/sources/**tests**/openfda-page.test.ts](./packages--connectors--src--sources--__tests__--openfda-page.test.ts.md)
- [packages/connectors/src/sources/index.ts](./packages--connectors--src--sources--index.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `de19328e119675b6fba163d498153d16bc946bb9f8a8c9a984a2ff40c973ca1b`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
