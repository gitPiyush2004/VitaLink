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
- `CACHE_SEPARATOR` — binding, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L52).
- `CachedHttpClientDeps` — TypeAliasDeclaration, [line 54](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L54).
- `SourceRequest` — TypeAliasDeclaration, [line 62](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L62).
- `Fetched` — TypeAliasDeclaration, [line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L95).
- `CachedHttpClient` — ClassDeclaration, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L109).
- `CachedHttpClient.getJson` — method, [line 131](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L131).
- `CachedHttpClient.cachedJson` — method, [line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L151).
- `CachedHttpClient.getText` — method, [line 176](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L176).
- `CachedHttpClient.postForm` — method, [line 215](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L215).
- `CachedHttpClient.buildProvenance` — method, [line 268](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L268).
- `CachedHttpClient.fetchWithRetries` — method, [line 278](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L278).
- `CachedHttpClient.attemptOnce` — method, [line 321](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L321).
- `buildCacheKey` — FunctionDeclaration, [line 374](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L374).
- `CacheEntry` — TypeAliasDeclaration, [line 384](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L384).
- `parseCacheEntry` — FunctionDeclaration, [line 387](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L387).
- `validate` — FunctionDeclaration, [line 405](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/http/cached-client.ts#L405).

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
- [packages/connectors/src/sources/**tests**/fda-archive.test.ts](./packages--connectors--src--sources--__tests__--fda-archive.test.ts.md)
- [packages/connectors/src/sources/**tests**/openfda-page.test.ts](./packages--connectors--src--sources--__tests__--openfda-page.test.ts.md)
- [packages/connectors/src/sources/comtrade.client.ts](./packages--connectors--src--sources--comtrade.client.ts.md)
- [packages/connectors/src/sources/fda-archive.client.ts](./packages--connectors--src--sources--fda-archive.client.ts.md)
- [packages/connectors/src/sources/gdelt.client.ts](./packages--connectors--src--sources--gdelt.client.ts.md)
- [packages/connectors/src/sources/geo.client.ts](./packages--connectors--src--sources--geo.client.ts.md)
- [packages/connectors/src/sources/hazard.client.ts](./packages--connectors--src--sources--hazard.client.ts.md)
- [packages/connectors/src/sources/openfda.client.ts](./packages--connectors--src--sources--openfda.client.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `13089b00ec40d5d3f7f3a4f82cdf6f605374a7480df529becedb0fd4159ae252`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
