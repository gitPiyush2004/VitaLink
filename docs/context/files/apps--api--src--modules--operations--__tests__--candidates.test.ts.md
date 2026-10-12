---
source: 'apps/api/src/modules/operations/__tests__/candidates.test.ts'
component: operations
generated: true
---

# apps/api/src/modules/operations/**tests**/candidates.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Connects public regulatory incidents to organisation-scoped investigations, analysis, conditional response inputs and decision history.

## Source structure

- `AS_OF` — binding, [line 12](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L12).
- `reference` — binding, [line 14](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L14).
- `source` — FunctionDeclaration, [line 25](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L25).
- `build` — FunctionDeclaration, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L42).
- `verdictOf` — binding, [line 55](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L55).

## Static dependencies

- [apps/api/src/modules/operations/domain/candidates.ts](./apps--api--src--modules--operations--domain--candidates.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- attribute comparison ([line 58](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L58)).
- matches every attribute on an equivalent listing ([line 59](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L59)).
- reports a different concentration rather than matching on the printed number ([line 65](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L65)).
- calls an unreadable strength unknown, never a match ([line 72](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L72)).
- does not claim complete strength agreement from one ingredient of a combination ([line 77](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L77)).
- flags a combination product as carrying extra active ingredients ([line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L95)).
- does not treat differently spelled dosage forms as equal ([line 110](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L110)).
- separates a partial route overlap from no overlap ([line 114](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L114)).
- does not exclude on route when a listing states none ([line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L122)).
- hard exclusions ([line 129](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L129)).
- excludes the investigated product itself ([line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L130)).
- excludes bulk ingredient listings ([line 136](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L136)).
- excludes an expired listing but keeps a future one ([line 142](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L142)).
- handles compact dates, expiry-day boundaries, and invalid calendar dates ([line 147](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L147)).
- excludes a discontinued approved product ([line 154](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L154)).
- ranking ([line 169](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L169)).
- sinks excluded products and prefers confirmed matches over absent evidence ([line 170](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L170)).
- is a pure function of its input ([line 182](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L182)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `001801b39e6667da522e3777fbf21e7976caceb3e1d5f9f287708069141e38e0`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
