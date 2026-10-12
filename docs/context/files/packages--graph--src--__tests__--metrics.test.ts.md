---
source: 'packages/graph/src/__tests__/metrics.test.ts'
component: graph-package
generated: true
---

# packages/graph/src/**tests**/metrics.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Provides reusable graph representation, traversal and metrics independent of API storage.

## Source structure

No TypeScript/Python declarations extracted; inspect the source link for configuration or prose.

## Static dependencies

- [packages/graph/src/metrics.ts](./packages--graph--src--metrics.ts.md)
- [packages/graph/src/supply-graph.ts](./packages--graph--src--supply-graph.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- herfindahl ([line 22](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L22)).
- is 1 for a monopoly ([line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L23)).
- is 0.5 for two equal players ([line 27](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L27)).
- is 0.1 for ten equal players ([line 31](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L31)).
- distinguishes a dominant player from an even split at the same count ([line 35](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L35)).
- is 0 for an empty set ([line 44](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L44)).
- toShares ([line 49](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L49)).
- normalises counts into shares that sum to one ([line 50](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L50)).
- returns an empty list rather than dividing by zero ([line 57](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L57)).
- unaffectedRedundancy ([line 63](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L63)).
- counts the makers a shock does not touch ([line 64](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L64)).
- never returns zero, so the exposure divisor cannot explode ([line 68](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L68)).
- concentrationPenalty ([line 76](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L76)).
- is 1 when manufacture is perfectly dispersed ([line 77](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L77)).
- doubles exposure for a monopoly ([line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L81)).
- is linear in HHI, so no single term dominates the exposure sum ([line 85](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L85)).
- maxDependencyShare ([line 90](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L90)).
- reports the largest single-country dependency ([line 91](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L91)).
- returns null rather than zero when there is no trade data ([line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L95)).
- isSingleSource ([line 102](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L102)).
- flags a drug with one observed maker ([line 103](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L103)).
- does not flag a drug with two ([line 107](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L107)).
- treats zero observed makers as single source ([line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L111)).
- slugify ([line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L118)).
- normalises case and punctuation to one form ([line 119](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L119)).
- strips combining marks so lookalike hyphens collapse together ([line 127](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L127)).
- trims leading and trailing separators ([line 132](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L132)).
- bounds the length, so an id stays usable in a URL ([line 136](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/graph/src/__tests__/metrics.test.ts#L136)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `a2de09dc8c08c71c40bd6310511df4d6d94c6faddd28bd5b43accd2039563130`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
