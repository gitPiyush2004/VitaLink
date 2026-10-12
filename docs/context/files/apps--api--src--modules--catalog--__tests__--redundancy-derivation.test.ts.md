---
source: 'apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts'
component: catalog
generated: true
---

# apps/api/src/modules/catalog/**tests**/redundancy-derivation.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Assembles observed product/label data and explicit redundancy proxies; labelers are not proven API suppliers or plants.

## Source structure

- `labelers` — FunctionDeclaration, [line 15](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L15).
- `HEPARIN_SODIUM_REAL` — binding, [line 26](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L26).
- `INSULIN_GLARGINE_REAL` — binding, [line 32](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L32).

## Static dependencies

- [apps/api/src/modules/catalog/domain/redundancy-derivation.ts](./apps--api--src--modules--catalog--domain--redundancy-derivation.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- the API tier is not claimed to be observed ([line 34](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L34)).
- assumes a single API supplier when no trade data is supplied ([line 35](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L35)).
- says the assumption overstates fragility, rather than implying precision ([line 45](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L45)).
- does not let 47 labelers become 47 API suppliers ([line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L52)).
- derives z_api from country concentration when trade data exists ([line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L61)).
- reports a dominant supplier country as effectively single-source ([line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L75)).
- cites the trade source in the method, so the number is checkable ([line 85](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L85)).
- z_plant, the echelon openFDA actually measures ([line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L95)).
- discriminates between drugs instead of returning one value for all ([line 96](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L96)).
- uses the numbers-equivalent of HHI, not the raw count ([line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L106)).
- discounts the long tail without a hand-maintained repackager list ([line 117](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L117)).
- reports two equal makers as z_plant = 2 ([line 126](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L126)).
- reports a dominated duopoly as more fragile than an even one ([line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L130)).
- states the whole formula, with its inputs, in the method ([line 140](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L140)).
- a truncated openFDA count is reported as a floor ([line 150](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L150)).
- flags truncation, so a floor is not mistaken for a total ([line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L151)).
- says nothing about truncation when the count was complete ([line 163](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L163)).
- missing data is never treated as good news ([line 171](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L171)).
- assumes the most fragile configuration when no labeler is observed ([line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L172)).
- never returns a redundancy below 1, because the model rejects zero ([line 181](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L181)).
- flags a genuine single labeler ([line 188](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L188)).
- does not flag two labelers as single source ([line 195](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/redundancy-derivation.test.ts#L195)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `72114f84eb0e17eafc8217148a34accca00b2b0e0b8dc9c6fa44598796865828`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
