---
source: 'scripts/history/__tests__/persistence.test.ts'
component: scripts
generated: true
---

# scripts/history/**tests**/persistence.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Provides setup, source probes and mechanical verification/documentation commands rather than runtime product data.

## Source structure

- `directories` — binding, [line 17](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L17).
- `temporary` — FunctionDeclaration, [line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L23).
- `source` — FunctionDeclaration, [line 28](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L28).
- `decision` — FunctionDeclaration, [line 54](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L54).

## Static dependencies

- [packages/connectors/src/index.ts](./packages--connectors--src--index.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)
- [scripts/history/forecast/baselines.ts](./scripts--history--forecast--baselines.ts.md)
- [scripts/history/forecast/cohort.ts](./scripts--history--forecast--cohort.ts.md)
- [scripts/history/forecast/evaluate.ts](./scripts--history--forecast--evaluate.ts.md)
- [scripts/history/forecast/metrics.ts](./scripts--history--forecast--metrics.ts.md)
- [scripts/history/forecast/task.ts](./scripts--history--forecast--task.ts.md)
- [scripts/history/snapshot-store.ts](./scripts--history--snapshot-store.ts.md)

Other import specifiers: `node:fs`, `node:os`, `node:path`, `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- observable persistence outcomes ([line 74](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L74)).
- uses the next global capture, never the next reappearance, and does not infer resolution from absence ([line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L75)).
- keeps Current and Resolved as distinct labels; discontinuation, unknown and conflicting outcomes are excluded ([line 89](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L89)).
- enforces the 14–60 day window inclusively and leaves the final capture unlabelled ([line 107](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L107)).
- excludes unparseable dates and historically impossible dates at origin or target without rewriting them ([line 120](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L120)).
- features depend only on the prefix, and Current-run age resets after absence or a long gap ([line 131](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L131)).
- retains same-status duplicate source records and rejects duplicate capture times ([line 150](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L150)).
- training availability and honest metrics ([line 163](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L163)).
- purges boundary-crossing labels instead of training on future outcomes ([line 164](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L164)).
- does not fit on validation/test labels, preserves unseen-key reporting and rejects an overlapping holdout ([line 173](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L173)).
- reports missed resolutions even when the majority baseline has high accuracy; probabilities of one enter the final calibration bin ([line 189](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L189)).
- weights capture macro metrics equally instead of treating every presentation row as independent ([line 211](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L211)).
- replays verified source bodies into hash-linked deterministic evaluation artifacts without network access ([line 227](https://github.com/gitPiyush2004/VitaLink/blob/main/scripts/history/__tests__/persistence.test.ts#L227)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `16309379edf0000fba8aabb730ff4d91a1f1a6bf643e0041082960165a28695d`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
