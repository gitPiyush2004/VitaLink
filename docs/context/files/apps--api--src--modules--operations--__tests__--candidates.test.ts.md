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
- flags a combination product as carrying extra active ingredients ([line 77](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L77)).
- does not treat differently spelled dosage forms as equal ([line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L92)).
- separates a partial route overlap from no overlap ([line 96](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L96)).
- does not exclude on route when a listing states none ([line 104](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L104)).
- hard exclusions ([line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L111)).
- excludes the investigated product itself ([line 112](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L112)).
- excludes bulk ingredient listings ([line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L118)).
- excludes an expired listing but keeps a future one ([line 124](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L124)).
- excludes a discontinued approved product ([line 129](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L129)).
- ranking ([line 144](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L144)).
- sinks excluded products and prefers confirmed matches over absent evidence ([line 145](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L145)).
- is a pure function of its input ([line 157](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/operations/__tests__/candidates.test.ts#L157)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `d17030bb0850dc233ad723e2b672c0434053d253576502466e4a71da0c2e32c4`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
