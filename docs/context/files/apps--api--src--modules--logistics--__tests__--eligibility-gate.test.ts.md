---
source: 'apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts'
component: logistics
generated: true
---

# apps/api/src/modules/logistics/**tests**/eligibility-gate.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Derives shipment constraints, excludes infeasible/unknown-critical-capability carriers and scores available evidence; no live quote has been established.

## Source structure

- `gate` — FunctionDeclaration, [line 27](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L27).

## Static dependencies

- [apps/api/src/modules/logistics/**tests**/factories/logistics.factory.ts](./apps--api--src--modules--logistics--__tests__--factories--logistics.factory.ts.md)
- [apps/api/src/modules/logistics/domain/eligibility-gate.ts](./apps--api--src--modules--logistics--domain--eligibility-gate.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- the baseline ([line 38](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L38)).
- is eligible, so every other test breaks exactly one rule ([line 39](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L39)).
- rule 1 — deadline ([line 48](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L48)).
- passes when the arrival beats the deadline ([line 49](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L49)).
- fails when the arrival is after the deadline ([line 53](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L53)).
- falls back to transit hours when no delivery date is given ([line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L61)).
- treats an unproven deadline as unmet, not as probably fine ([line 78](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L78)).
- rule 2 — temperature ([line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L92)).
- passes when the required range is supported ([line 93](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L93)).
- fails when the required range is not supported ([line 97](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L97)).
- eliminates a refrigerated-only carrier for a drug whose label forbids refrigeration ([line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L106)).
- does not eliminate a carrier that also offers a permitted range ([line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L122)).
- rule 3 — lane ([line 133](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L133)).
- passes for an international carrier on any lane ([line 134](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L134)).
- passes for a domestic-India carrier on a domestic India lane ([line 138](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L138)).
- fails for a domestic-India carrier on an export lane ([line 144](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L144)).
- fails when the lane is absent from an explicit lane list ([line 155](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L155)).
- passes when the lane is present in an explicit lane list ([line 161](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L161)).
- rule 4 — special handling ([line 168](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L168)).
- passes when every required handling is documented true ([line 169](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L169)).
- fails when a required handling is documented false ([line 177](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L177)).
- fails when a required handling is 'unknown' ([line 186](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L186)).
- fails for a handling no carrier documents at all ([line 200](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L200)).
- rules 5 and 6 — dangerous goods and customs ([line 209](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L209)).
- passes hazardous material when the carrier documents DG handling ([line 210](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L210)).
- fails hazardous material when DG handling is 'unknown' ([line 216](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L216)).
- passes a customs shipment when the carrier documents brokerage ([line 225](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L225)).
- fails a customs shipment when brokerage is 'unknown' ([line 231](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L231)).
- rule 7 — quote availability ([line 241](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L241)).
- passes when a price was obtained ([line 242](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L242)).
- fails an UNAVAILABLE quote and carries the carrier's own reason ([line 246](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L246)).
- rule 8 — budget ceiling ([line 262](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L262)).
- passes when no ceiling is set ([line 263](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L263)).
- passes when the price is within the ceiling ([line 267](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L267)).
- fails when the price exceeds the ceiling ([line 282](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L282)).
- rule 9 — mode preference ([line 301](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L301)).
- passes when the preference is "any" ([line 302](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L302)).
- passes when the service mode is in the preference list ([line 306](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L306)).
- fails when the service mode is excluded ([line 312](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L312)).
- does not exclude a multimodal service, which means the mode is unknown ([line 318](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L318)).
- an unavailable quote reports only that ([line 330](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L330)).
- does not also claim the carrier missed the deadline ([line 331](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L331)).
- still reports every failure for a carrier that did quote ([line 354](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L354)).
- the gate reports every failure, not just the first ([line 366](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L366)).
- lists all three problems for a carrier that has three ([line 367](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L367)).
- summarises as NOT ELIGIBLE with the reasons, and never as a score ([line 393](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L393)).
- the deadline is compared as an absolute instant ([line 401](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L401)).
- does not depend on when the test runs ([line 402](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/logistics/__tests__/eligibility-gate.test.ts#L402)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `70a8f2e2a9abe81e726b7ce1b92fe6ebae2e873b4d45ec7051c617d441ab11be`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
