---
source: 'packages/connectors/src/http/cached-client.ts'
component: connectors
generated: true
---

# packages/connectors/src/http/cached-client.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Combines typed validation, source-specific cache/limits/retry, provenance and invalid-cache recovery.

**Component:** Owns typed external HTTP, source parsing, provenance, caching, retries, rate limits and adapter availability.

## Source structure

- `DEFAULT_TIMEOUT_MS` — binding, [line 48](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L48).
- `CACHE_KEY_HASH_LENGTH` — binding, [line 51](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L51).
- `CachedHttpClientDeps` — TypeAliasDeclaration, [line 53](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L53).
- `SourceRequest` — TypeAliasDeclaration, [line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L61).
- `Fetched` — TypeAliasDeclaration, [line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L92).
- `CachedHttpClient` — ClassDeclaration, [line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L106).
- `CachedHttpClient.getJson` — method, [line 128](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L128).
- `CachedHttpClient.cachedJson` — method, [line 148](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L148).
- `CachedHttpClient.getText` — method, [line 173](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L173).
- `CachedHttpClient.postForm` — method, [line 212](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L212).
- `CachedHttpClient.buildProvenance` — method, [line 265](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L265).
- `CachedHttpClient.fetchWithRetries` — method, [line 275](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L275).
- `CachedHttpClient.attemptOnce` — method, [line 318](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L318).
- `buildCacheKey` — FunctionDeclaration, [line 370](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L370).
- `CacheEntry` — TypeAliasDeclaration, [line 378](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L378).
- `parseCacheEntry` — FunctionDeclaration, [line 381](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L381).
- `validate` — FunctionDeclaration, [line 399](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L399).

## Static dependencies

- [packages/connectors/src/http/classify.ts](./packages--connectors--src--http--classify.ts.md)
- [packages/connectors/src/http/connector-error.ts](./packages--connectors--src--http--connector-error.ts.md)
- [packages/connectors/src/http/decode-body.ts](./packages--connectors--src--http--decode-body.ts.md)
- [packages/connectors/src/http/ports.ts](./packages--connectors--src--http--ports.ts.md)
- [packages/connectors/src/http/rate-limiter.ts](./packages--connectors--src--http--rate-limiter.ts.md)
- [packages/connectors/src/http/retry.ts](./packages--connectors--src--http--retry.ts.md)
- [packages/connectors/src/http/slow-hosts.ts](./packages--connectors--src--http--slow-hosts.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: `node:crypto`, `undici`, `zod`.

## Static consumers

- [packages/connectors/src/**tests**/cached-client.test.ts](./packages--connectors--src--__tests__--cached-client.test.ts.md)
- [packages/connectors/src/carriers/carrier-adapter.ts](./packages--connectors--src--carriers--carrier-adapter.ts.md)
- [packages/connectors/src/http/classify.ts](./packages--connectors--src--http--classify.ts.md)
- [packages/connectors/src/http/index.ts](./packages--connectors--src--http--index.ts.md)
- [packages/connectors/src/sources/comtrade.client.ts](./packages--connectors--src--sources--comtrade.client.ts.md)
- [packages/connectors/src/sources/gdelt.client.ts](./packages--connectors--src--sources--gdelt.client.ts.md)
- [packages/connectors/src/sources/geo.client.ts](./packages--connectors--src--sources--geo.client.ts.md)
- [packages/connectors/src/sources/hazard.client.ts](./packages--connectors--src--sources--hazard.client.ts.md)
- [packages/connectors/src/sources/openfda.client.ts](./packages--connectors--src--sources--openfda.client.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `2def9f3ce3e0deae09fa4c5fdddc5761ed28bc897206a1df4db20485fcfa13f9`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
