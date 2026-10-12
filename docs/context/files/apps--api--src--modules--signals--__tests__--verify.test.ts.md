---
source: 'apps/api/src/modules/signals/__tests__/verify.test.ts'
component: signals
generated: true
---

# apps/api/src/modules/signals/**tests**/verify.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Turns retrieved observations into clusters, entity matches, independence checks, corroboration and either published alerts or quarantine.

## Source structure

- `NOW` — binding, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L42).

## Static dependencies

- [apps/api/src/config/constants.ts](./apps--api--src--config--constants.ts.md)
- [apps/api/src/modules/signals/domain/cluster.ts](./apps--api--src--modules--signals--domain--cluster.ts.md)
- [apps/api/src/modules/signals/domain/independence.ts](./apps--api--src--modules--signals--domain--independence.ts.md)
- [apps/api/src/modules/signals/domain/resolve.ts](./apps--api--src--modules--signals--domain--resolve.ts.md)
- [apps/api/src/modules/signals/domain/simhash.ts](./apps--api--src--modules--signals--domain--simhash.ts.md)
- [apps/api/src/modules/signals/domain/veracity.ts](./apps--api--src--modules--signals--domain--veracity.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- dedupe, and what it can and cannot do on a headline ([line 48](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L48)).
- cannot separate a rewrite from a different firm on text alone ([line 56](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L56)).
- under-merges rather than over-merges at the configured threshold ([line 70](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L70)).
- merges text that is genuinely the same ([line 78](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L78)).
- adapts the shingle size to document length ([line 83](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L83)).
- skips the SimHash prefilter when there are too few features to compare ([line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L92)).
- still rejects unrelated text outright ([line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L99)).
- does not make every short document identical ([line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L109)).
- clustering will not merge two firms ([line 117](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L117)).
- splits two firms whose recall texts are nearly identical ([line 142](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L142)).
- does not treat an unknown manufacturer as a different one ([line 149](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L149)).
- is deterministic, so cluster ids do not depend on query order ([line 159](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L159)).
- normalises corporate suffixes away ([line 166](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L166)).
- independence counts publishers, not feeds ([line 179](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L179)).
- collapses two openFDA endpoints into one source ([line 180](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L180)).
- says so in the explanation, so a reader can tell why the count is one ([line 194](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L194)).
- counts a regulator and a newspaper as two ([line 206](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L206)).
- excludes an unkeyable observation rather than counting it ([line 216](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L216)).
- resolves a two-part public suffix ([line 229](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L229)).
- keys an agency by the agency and a news site by its domain ([line 236](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L236)).
- veracity is a product, not a weighted sum ([line 247](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L247)).
- scores a single source at zero however authoritative and recent ([line 248](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L248)).
- publishes a fresh, corroborated, authoritative alert ([line 264](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L264)).
- is DERIVED with the substituted formula on it, never MODELLED ([line 277](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L277)).
- halves at the half-life rather than falling off a cliff ([line 294](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L294)).
- treats a future timestamp as now, not as fresher than now ([line 301](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L301)).
- takes the strongest publisher, not the average ([line 306](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L306)).
- grows with diminishing returns above the minimum ([line 313](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L313)).
- classifies a regulator apart from a newspaper ([line 320](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L320)).
- resolution refuses to guess ([line 332](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L332)).
- leaves an ambiguous name unresolved rather than picking one ([line 343](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L343)).
- resolves a longer form of the same firm name ([line 362](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L362)).
- does not pair a firm with a different firm that merely looks similar ([line 372](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L372)).
- falls back to the drug when no firm was named ([line 384](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L384)).
- says a headline named nothing, rather than failing silently ([line 393](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/__tests__/verify.test.ts#L393)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `94f79fd4c6db7ae3a0d43a3b059974e98c4e9b34473c51482559874fc99869be`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
