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
- `NdcProduct` — TypeAliasDeclaration, [line 89](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L89).
- `labelSchema` — binding, [line 91](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L91).
- `DrugLabel` — TypeAliasDeclaration, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L109).
- `enforcementSchema` — binding, [line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L111).
- `EnforcementReport` — TypeAliasDeclaration, [line 141](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L141).
- `shortageSchema` — binding, [line 143](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L143).
- `ShortageRecord` — TypeAliasDeclaration, [line 170](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L170).
- `OpenFdaQuery` — TypeAliasDeclaration, [line 176](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L176).
- `ENDPOINTS` — binding, [line 186](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L186).
- `EndpointName` — TypeAliasDeclaration, [line 193](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L193).
- `countBucketSchema` — binding, [line 199](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L199).
- `CountBucket` — TypeAliasDeclaration, [line 200](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L200).
- `OpenFdaClient` — ClassDeclaration, [line 202](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L202).
- `OpenFdaClient.searchNdc` — method, [line 205](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L205).
- `OpenFdaClient.searchLabels` — method, [line 209](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L209).
- `OpenFdaClient.searchEnforcement` — method, [line 213](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L213).
- `OpenFdaClient.searchShortages` — method, [line 217](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L217).
- `OpenFdaClient.count` — method, [line 233](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L233).
- `OpenFdaClient.search` — method, [line 246](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L246).
- `buildUrl` — FunctionDeclaration, [line 289](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L289).
- `describeQuery` — FunctionDeclaration, [line 301](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/sources/openfda.client.ts#L301).

## Static dependencies

- [packages/connectors/src/http/cached-client.ts](./packages--connectors--src--http--cached-client.ts.md)
- [packages/connectors/src/http/connector-error.ts](./packages--connectors--src--http--connector-error.ts.md)
- [packages/connectors/src/sources/source-registry.ts](./packages--connectors--src--sources--source-registry.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/connectors/src/sources/index.ts](./packages--connectors--src--sources--index.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `c7978774c57f3929abd7caad0c1d6cb96cc407887a1f570441cc6e96f28202c8`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
