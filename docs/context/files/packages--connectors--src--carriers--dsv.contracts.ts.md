---
source: 'packages/connectors/src/carriers/dsv.contracts.ts'
component: connectors
generated: true
---

# packages/connectors/src/carriers/dsv.contracts.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Defines the current DSV token/quote payload contracts; field-level quote assumptions need validation against actual provider responses.

**Component:** Owns typed external HTTP, source parsing, provenance, caching, retries, rate limits and adapter availability.

## Source structure

- `MS_PER_SECOND` — binding, [line 28](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L28).
- `TOKEN_SAFETY_MARGIN_SECONDS` — binding, [line 36](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L36).
- `TOKEN_SAFETY_MARGIN_MS` — binding, [line 37](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L37).
- `CARRIER_TIMEOUT_SECONDS` — binding, [line 39](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L39).
- `CARRIER_TIMEOUT_MS` — binding, [line 40](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L40).
- `CARRIER_MAX_ATTEMPTS` — binding, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L42).
- `DsvConfig` — TypeAliasDeclaration, [line 44](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L44).
- `TOKEN_ENDPOINTS` — binding, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L52).
- `QUOTE_ENDPOINTS` — binding, [line 64](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L64).
- `tokenResponseSchema` — binding, [line 69](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L69).
- `quoteResponseSchema` — binding, [line 84](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L84).
- `DSV_CAPABILITIES` — binding, [line 114](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L114).
- `CachedToken` — TypeAliasDeclaration, [line 136](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L136).
- `DsvQuote` — TypeAliasDeclaration, [line 139](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L139).
- `DsvProvenance` — TypeAliasDeclaration, [line 142](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L142).
- `HOURS_PER_DAY` — binding, [line 149](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L149).
- `toTransitHours` — FunctionDeclaration, [line 152](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L152).
- `toFx` — FunctionDeclaration, [line 167](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L167).
- `mapErrorToReason` — FunctionDeclaration, [line 178](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L178).
- `describeError` — FunctionDeclaration, [line 201](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L201).
- `describeShipment` — FunctionDeclaration, [line 209](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L209).
- `normaliseMode` — FunctionDeclaration, [line 221](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L221).
- `quoteCapabilityFields` — FunctionDeclaration, [line 250](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/connectors/src/carriers/dsv.contracts.ts#L250).

## Static dependencies

- [packages/connectors/src/http/connector-error.ts](./packages--connectors--src--http--connector-error.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: `zod`.

## Static consumers

- [packages/connectors/src/carriers/dsv.adapter.ts](./packages--connectors--src--carriers--dsv.adapter.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `32c9e386bd5beda4ea66af26aa5aa4559cada735e8d1f12e95a0c6d236e55bfe`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
