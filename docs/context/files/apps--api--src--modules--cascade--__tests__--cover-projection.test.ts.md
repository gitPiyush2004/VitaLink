---
source: 'apps/api/src/modules/cascade/__tests__/cover-projection.test.ts'
component: cascade
generated: true
---

# apps/api/src/modules/cascade/**tests**/cover-projection.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Traces a conditional upstream shock through observed associations and projects explicitly supplied days of cover.

## Source structure

- `BASE` — binding, [line 20](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L20).

## Static dependencies

- [apps/api/src/config/constants.ts](./apps--api--src--config--constants.ts.md)
- [apps/api/src/modules/cascade/domain/cover-projection.ts](./apps--api--src--modules--cascade--domain--cover-projection.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- projectCover ([line 22](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L22)).
- leaves cover untouched when exposure is zero ([line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L23)).
- drains cover in proportion to exposure ([line 29](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L29)).
- leaves no cover at all when exposure is total ([line 35](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L35)).
- produces a curve that declines by one day per day ([line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L42)).
- never reports negative cover ([line 49](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L49)).
- takes the stockout band low from the low cover edge, not the high ([line 56](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L56)).
- reports no stockout when cover outlasts the horizon ([line 70](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L70)).
- reports day zero when cover is already below the threshold ([line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L81)).
- rejects an exposure outside the unit interval ([line 89](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L89)).
- rejects negative cover ([line 94](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L94)).
- projectCover, honesty about its inputs ([line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L99)).
- declares that assumed cover is a SCENARIO input ([line 100](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L100)).
- records the operator figure it was given, so the result is reproducible ([line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L111)).
- says the band is a sensitivity range, not a confidence interval ([line 117](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L117)).
- writes the formula out with this run's numbers ([line 125](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L125)).
- coverToUrgency ([line 134](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L134)).
- is CRITICAL at or below two days of cover ([line 138](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L138)).
- is HIGH at or below five days ([line 143](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L143)).
- is NORMAL at or below fourteen days ([line 147](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L147)).
- is LOW above fourteen days ([line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L151)).
- escalates to HIGH on severity alone, even with plenty of cover ([line 155](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L155)).
- does not let severity downgrade a critical cover figure ([line 161](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/cover-projection.test.ts#L161)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `64e3a181fb5d1213a8c2702e3677547f943d1414e327f2df70abb606009ee31e`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
