---
source: 'apps/api/src/modules/signals/signals.repository.ts'
component: signals
generated: true
---

# apps/api/src/modules/signals/signals.repository.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Owns persistence queries/mapping for this module; follow callers for business decisions and organisation scope.

**Component:** Turns retrieved observations into clusters, entity matches, independence checks, corroboration and either published alerts or quarantine.

## Source structure

- `storedId` — FunctionDeclaration, [line 43](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L43).
- `saveSignals` — FunctionDeclaration, [line 47](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L47).
- `findRecentSignals` — FunctionDeclaration, [line 97](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L97).
- `findSignalsByIds` — FunctionDeclaration, [line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L118).
- `assignClusters` — FunctionDeclaration, [line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L130).
- `SaveAlertInput` — TypeAliasDeclaration, [line 150](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L150).
- `saveAlert` — FunctionDeclaration, [line 152](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L152).
- `listAlerts` — FunctionDeclaration, [line 194](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L194).
- `findAlert` — FunctionDeclaration, [line 207](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L207).
- `SaveQuarantineInput` — TypeAliasDeclaration, [line 218](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L218).
- `saveQuarantine` — FunctionDeclaration, [line 220](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L220).
- `listQuarantine` — FunctionDeclaration, [line 257](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L257).
- `countQuarantineByReason` — FunctionDeclaration, [line 277](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L277).
- `SignalsRepository` — TypeAliasDeclaration, [line 290](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L290).
- `createSignalsRepository` — FunctionDeclaration, [line 306](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/signals.repository.ts#L306).

## Static dependencies

- [apps/api/src/modules/signals/models/mappers.ts](./apps--api--src--modules--signals--models--mappers.ts.md)
- [apps/api/src/modules/signals/models/raw-signal.model.ts](./apps--api--src--modules--signals--models--raw-signal.model.ts.md)
- [apps/api/src/modules/signals/models/verified-alert.model.ts](./apps--api--src--modules--signals--models--verified-alert.model.ts.md)
- [apps/api/src/shared/db/mappers.ts](./apps--api--src--shared--db--mappers.ts.md)
- [apps/api/src/shared/errors/index.ts](./apps--api--src--shared--errors--index.ts.md)

Other import specifiers: none.

## Static consumers

- [apps/api/src/modules/signals/domain/ingest-mappers.ts](./apps--api--src--modules--signals--domain--ingest-mappers.ts.md)
- [apps/api/src/modules/signals/domain/verify-helpers.ts](./apps--api--src--modules--signals--domain--verify-helpers.ts.md)
- [apps/api/src/modules/signals/index.ts](./apps--api--src--modules--signals--index.ts.md)
- [apps/api/src/modules/signals/signals.adjudicate.ts](./apps--api--src--modules--signals--signals.adjudicate.ts.md)
- [apps/api/src/modules/signals/signals.corroborate.ts](./apps--api--src--modules--signals--signals.corroborate.ts.md)
- [apps/api/src/modules/signals/signals.ingest.ts](./apps--api--src--modules--signals--signals.ingest.ts.md)
- [apps/api/src/modules/signals/signals.queries.ts](./apps--api--src--modules--signals--signals.queries.ts.md)
- [apps/api/src/modules/signals/signals.service.ts](./apps--api--src--modules--signals--signals.service.ts.md)
- [apps/api/src/modules/signals/signals.verify.ts](./apps--api--src--modules--signals--signals.verify.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `eb4990ad27debaa47f89e5a62f0ff9dc281a11b0e9eb5fd87c1342ae116bdf67`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
