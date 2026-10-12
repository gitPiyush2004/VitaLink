---
source: 'apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts'
component: catalog
generated: true
---

# apps/api/src/modules/catalog/**tests**/storage-parsing.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Assembles observed product/label data and explicit redundancy proxies; labelers are not proven API suppliers or plants.

## Source structure

- `HEPARIN` — binding, [line 27](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L27).
- `INSULIN` — binding, [line 32](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L32).
- `CISPLATIN` — binding, [line 40](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L40).
- `AMOXICILLIN` — binding, [line 46](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L46).
- `METHOTREXATE` — binding, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L52).

## Static dependencies

- [apps/api/src/modules/catalog/domain/storage-parsing.ts](./apps--api--src--modules--catalog--domain--storage-parsing.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- cisplatin: a forbidden condition is not a requirement ([line 57](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L57)).
- does not read "Do not refrigerate" as a refrigeration requirement ([line 58](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L58)).
- records the prohibition, because it is itself a hard constraint ([line 67](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L67)).
- says in its reason that the label forbids refrigeration ([line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L75)).
- amoxicillin: a reconstituted-product condition is not a shipping condition ([line 82](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L82)).
- ships at room temperature, not refrigerated ([line 83](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L83)).
- records the refrigeration as in-use only, rather than discarding it ([line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L92)).
- explains why the refrigeration clause was excluded ([line 98](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L98)).
- methotrexate: an after-first-puncture condition is not a shipping condition ([line 105](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L105)).
- ships at room temperature ([line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L106)).
- records the 2-8C as in-use only ([line 112](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L112)).
- still extracts the excursion allowance from the shipping clause ([line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L118)).
- insulin glargine: "Not In-Use" is the shipping condition ([line 125](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L125)).
- reads it as 2-8C, not ambient ([line 126](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L126)).
- is not confused by "Not In-Use" containing the string "In-Use" ([line 135](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L135)).
- does not read "Do not freeze" as a freezing instruction ([line 143](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L143)).
- requires cold-chain handling and monitoring ([line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L151)).
- heparin sodium: a plain single-condition label ([line 158](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L158)).
- reads controlled room temperature as 15-25C ([line 159](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L159)).
- is not fooled by "20° to 25°C" looking like "2 to 8" ([line 166](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L166)).
- extracts the stated excursion ceiling ([line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L172)).
- reports one condition, not two, from "Controlled Room Temperature" ([line 178](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L178)).
- parseStorage, across the several products under one generic name ([line 188](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L188)).
- does not let one product's prohibition cancel another's requirement ([line 189](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L189)).
- reports how many labels it parsed ([line 208](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L208)).
- takes the strictest requirement as the drug-level default ([line 214](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L214)).
- flags disagreement between products rather than resolving it silently ([line 220](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L220)).
- does not flag disagreement when every product agrees ([line 230](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L230)).
- returns null when no product resolved a shipping requirement ([line 237](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L237)).
- returns null for a generic name with no labels at all ([line 244](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L244)).
- scopeClauses ([line 252](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L252)).
- marks a negated clause as a prohibition ([line 253](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L253)).
- splits before a negation even when the full stop sits inside a bracket ([line 260](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L260)).
- marks a reconstitution clause as in-use ([line 270](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L270)).
- marks an after-first-puncture clause as in-use ([line 284](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L284)).
- splits on semicolons as well as full stops ([line 292](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L292)).
- other cold-chain phrasings ([line 300](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L300)).
- matches "Refrigerated" despite the trailing letters ([line 301](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L301)).
- matches a Fahrenheit range with the unit between the numbers ([line 305](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L305)).
- reads an explicit freezer instruction as frozen ([line 309](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L309)).
- reads liquid-nitrogen storage as cryogenic ([line 316](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L316)).
- reads "at or below 25°C" as room temperature ([line 322](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L322)).
- refusing to guess ([line 327](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L327)).
- returns null for a label with no storage section ([line 328](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L328)).
- returns null for a storage section it cannot interpret ([line 335](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L335)).
- returns null when the only condition stated is scoped to in-use product ([line 342](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L342)).
- says explicitly why it did not default to ambient ([line 352](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L352)).
- still extracts an excursion allowance from otherwise unparseable text ([line 358](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L358)).
- parseExcursion ([line 368](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L368)).
- returns the upper bound of a stated allowance ([line 369](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L369)).
- returns null when the label states no allowance ([line 373](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L373)).
- does not run past a sentence boundary ([line 377](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L377)).
- impliedSpecialHandling ([line 382](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L382)).
- requires nothing extra for a room-temperature drug ([line 383](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L383)).
- requires nothing extra when the range could not be parsed ([line 387](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/catalog/__tests__/storage-parsing.test.ts#L387)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `dab43a4a7fa302d7dcc61bb0ea4675f54dcbff9572dcd9e94051aae8b357a5ee`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
