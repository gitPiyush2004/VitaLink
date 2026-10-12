---
source: 'apps/api/src/modules/cascade/__tests__/exposure.test.ts'
component: cascade
generated: true
---

# apps/api/src/modules/cascade/**tests**/exposure.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Traces a conditional upstream shock through observed associations and projects explicitly supplied days of cover.

## Source structure

- `path` — FunctionDeclaration, [line 17](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L17).
- `NO_CONCENTRATION` — binding, [line 21](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L21).

## Static dependencies

- [apps/api/src/modules/cascade/domain/exposure.ts](./apps--api--src--modules--cascade--domain--exposure.ts.md)
- [packages/graph/src/index.ts](./packages--graph--src--index.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- computeExposure ([line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L23)).
- is zero when nothing reached the drug ([line 24](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L24)).
- passes a single unattenuated path straight through ([line 31](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L31)).
- sums over paths rather than taking the strongest ([line 44](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L44)).
- attenuates a longer path more than a shorter one ([line 57](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L57)).
- does not attenuate at all when decay is 1 ([line 65](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L65)).
- kills everything beyond the first hop when decay is 0 ([line 71](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L71)).
- rejects a decay above 1, which would amplify with distance ([line 77](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L77)).
- rejects a negative decay ([line 85](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L85)).
- doubles exposure for a monopoly ([line 91](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L91)).
- divides by the makers the shock did not touch ([line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L111)).
- applies concentration once, not once per path ([line 133](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L133)).
- clamps to 1 and says that it did ([line 154](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L154)).
- does not report clamping when the score is genuinely 1 ([line 170](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L170)).
- writes the formula out with this run's numbers substituted in ([line 183](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L183)).
- rankByExposure ([line 200](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L200)).
- puts the most exposed drug first ([line 214](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L214)).
- breaks a score tie on path count ([line 220](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L220)).
- breaks a full tie on id, so the order is deterministic ([line 226](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L226)).
- does not mutate its argument ([line 234](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/cascade/__tests__/exposure.test.ts#L234)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `2ce478a6859e187db333ebedbfb2ef6dfd9bfb613776ba285339145bf50b6102`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
