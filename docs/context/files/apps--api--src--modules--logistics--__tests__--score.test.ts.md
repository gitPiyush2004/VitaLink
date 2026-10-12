---
source: 'apps/api/src/modules/logistics/__tests__/score.test.ts'
component: logistics
generated: true
---

# apps/api/src/modules/logistics/**tests**/score.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Derives shipment constraints, excludes infeasible/unknown-critical-capability carriers and scores available evidence; no live quote has been established.

## Source structure

- `pair` — FunctionDeclaration, [line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L92).
- `recommendUnder` — FunctionDeclaration, [line 135](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L135).

## Static dependencies

- [apps/api/src/config/weights.ts](./apps--api--src--config--weights.ts.md)
- [apps/api/src/modules/logistics/**tests**/factories/logistics.factory.ts](./apps--api--src--modules--logistics--__tests__--factories--logistics.factory.ts.md)
- [apps/api/src/modules/logistics/domain/recommend.ts](./apps--api--src--modules--logistics--domain--recommend.ts.md)
- [apps/api/src/modules/logistics/domain/score.ts](./apps--api--src--modules--logistics--domain--score.ts.md)
- [apps/api/src/modules/logistics/domain/sub-scores.ts](./apps--api--src--modules--logistics--domain--sub-scores.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- the weight profiles ([line 32](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L32)).
- all sum to 1 ([line 33](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L33)).
- never let cold chain fall below the floor ([line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L42)).
- rejects a profile whose weights do not sum to 1 ([line 48](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L48)).
- rejects a profile that drops cold chain below the floor ([line 58](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L58)).
- shifts weight from cost to transit as urgency rises ([line 68](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L68)).
- the weighting is responsive ([line 147](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L147)).
- under CRITICAL, the ₹6,000-cheaper but 25h-slower carrier loses ([line 148](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L148)).
- under LOW, the same pair reverses ([line 155](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L155)).
- reverses because cost and transit weights swapped, not because inputs changed ([line 162](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L162)).
- is a narrow win under CRITICAL, and the breakdown says why ([line 178](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L178)).
- records the cost normalisation range so the row is reproducible ([line 196](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L196)).
- a missing input falls back to neutral and says so ([line 212](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L212)).
- scores reliability neutral with the reason, not zero and not 100 ([line 213](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L213)).
- uses observed history when there is any ([line 224](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L224)).
- scores lane risk neutral while the physical layer is not ingested ([line 232](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L232)).
- computes lane risk from exposure once the lane is known ([line 239](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L239)).
- surfaces every neutral fallback in the explanation ([line 246](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L246)).
- cold chain is scored as capability depth, not a boolean ([line 255](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L255)).
- gives a full score to an ambient shipment regardless of reefer capability ([line 256](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L256)).
- ranks an active monitored reefer above one that only supports the range ([line 263](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L263)).
- the carrier preference is disclosed or it does not exist ([line 280](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L280)).
- returns no note when there is no bonus ([line 281](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L281)).
- cannot produce a bonus without a disclosure note ([line 285](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L285)).
- applies the bonus to the final score and shows it in the breakdown ([line 293](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L293)).
- breaks ties on merit rather than reversing them ([line 312](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L312)).
- nothing is dropped from the comparison ([line 359](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L359)).
- lists ineligible carriers with no score at all ([line 360](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L360)).
- counts providers, not quotes ([line 392](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L392)).
- states the coverage ratio in words, even when coverage is complete ([line 422](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L422)).
- counts carriers that returned nothing against the attempted total ([line 430](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L430)).
- returns a null recommendation rather than relaxing a constraint ([line 448](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L448)).
- the counterfactual ([line 475](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L475)).
- states what the runner-up would have cost and saved ([line 476](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L476)).
- is absent when there is only one eligible carrier ([line 487](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L487)).
- cost is normalised against the eligible set, not the whole set ([line 505](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L505)).
- ignores an ineligible carrier when setting the cheapest price ([line 506](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/score.test.ts#L506)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `17743cba37ec3b96267e7eba5ffbe33d08aaa0eb3b1568a71c4ae1f737fbb783`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
