---
source: 'packages/connectors/src/__tests__/cached-client.test.ts'
component: connectors
generated: true
---

# packages/connectors/src/**tests**/cached-client.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Owns typed external HTTP, source parsing, provenance, caching, retries, rate limits and adapter availability.

## Source structure

- `bodySchema` — binding, [line 18](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L18).
- `frozenClock` — binding, [line 20](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L20).
- `instantSleeper` — binding, [line 21](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L21).
- `request` — FunctionDeclaration, [line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L23).
- `scriptFetch` — FunctionDeclaration, [line 36](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L36).

## Static dependencies

- [packages/connectors/src/http/cached-client.ts](./packages--connectors--src--http--cached-client.ts.md)
- [packages/connectors/src/http/connector-error.ts](./packages--connectors--src--http--connector-error.ts.md)
- [packages/connectors/src/http/ports.ts](./packages--connectors--src--http--ports.ts.md)

Other import specifiers: `vitest`, `zod`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- CachedHttpClient.getJson ([line 68](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L68)).
- retains legacy cache identities for ordinary requests ([line 69](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L69)).
- returns the parsed body with provenance attached ([line 91](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L91)).
- serves the second identical request from cache without a network call ([line 110](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L110)).
- refetches an invalid cached body and replaces it only after validation ([line 125](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L125)).
- reports the original fetch time on a cache hit, not the time of the hit ([line 152](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L152)).
- treats a different URL as a different cache entry ([line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L172)).
- retries a 503 and succeeds on the second attempt ([line 192](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L192)).
- does not retry a 404, and reports it as not_found ([line 209](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L209)).
- gives up after the retry budget and reports rate_limited ([line 223](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L223)).
- reports a body that does not match the schema as malformed_response ([line 237](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L237)).
- reports a non-JSON body as malformed_response ([line 252](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L252)).
- does not cache a failed response ([line 263](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L263)).
- keeps the raw body, so a carrier quote can be proved later ([line 282](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/__tests__/cached-client.test.ts#L282)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `3fea15db546625496bb8428963aa79cb7580a453dfff85dc91ecf8bed19283b2`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
