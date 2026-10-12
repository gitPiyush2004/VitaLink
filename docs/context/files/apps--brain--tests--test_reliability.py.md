---
source: 'apps/brain/tests/test_reliability.py'
component: brain
generated: true
---

# apps/brain/tests/test_reliability.py

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Calculates the published reliability model and proxy-rate fits; formula reproduction is not validated forecasting.

## Source structure

- `TestPaperConfigurationTable` — ClassDef, [line 44](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L44).
- `TestPaperConfigurationTable.test_reproduces_published_expected_shortage` — method, [line 48](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L48).
- `TestPaperConfigurationTable.test_computed_values_are_pinned_against_silent_drift` — method, [line 61](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L61).
- `TestPaperConfigurationTable.test_the_largest_gap_to_the_paper_is_documented` — method, [line 88](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L88).
- `TestEquationOne` — ClassDef, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L109).
- `TestEquationOne.test_unavailability_of_a_component_that_fails_and_repairs_equally_fast` — method, [line 112](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L112).
- `TestEquationOne.test_a_component_that_repairs_ten_times_faster_is_down_a_ninth_of_the_time` — method, [line 115](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L115).
- `TestEquationOne.test_availability_is_one_minus_unavailability` — method, [line 118](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L118).
- `TestEquationOne.test_a_zero_repair_rate_is_rejected_rather_than_producing_p_equals_one` — method, [line 121](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L121).
- `TestEquationOne.test_a_zero_failure_rate_is_rejected_rather_than_producing_a_perfect_component` — method, [line 128](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L128).
- `TestEquationTwo` — ClassDef, [line 135](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L135).
- `TestEquationTwo.test_one_supplier_means_the_echelon_is_exactly_as_reliable_as_that_supplier` — method, [line 138](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L138).
- `TestEquationTwo.test_a_second_supplier_squares_the_failure_probability` — method, [line 141](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L141).
- `TestEquationTwo.test_a_third_supplier_cubes_it` — method, [line 144](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L144).
- `TestEquationTwo.test_zero_suppliers_is_rejected` — method, [line 147](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L147).
- `TestEquationThree` — ClassDef, [line 155](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L155).
- `TestEquationThree.test_a_perfectly_reliable_line_leaves_only_plant_failures` — method, [line 158](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L158).
- `TestEquationThree.test_a_permanently_failing_line_makes_the_plant_useless` — method, [line 167](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L167).
- `TestEquationThree.test_the_two_failure_causes_are_disjoint_not_a_union` — method, [line 176](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L176).
- `TestEquationThree.test_line_redundancy_only_helps_when_z_line_exceeds_one` — method, [line 198](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L198).
- `TestEquationThree.test_zero_plants_or_zero_lines_is_rejected` — method, [line 206](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L206).
- `TestEquationFour` — ClassDef, [line 213](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L213).
- `TestEquationFour.test_the_echelons_multiply_because_they_are_in_series` — method, [line 216](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L216).
- `TestEquationFour.test_shortage_is_the_complement_of_reliability` — method, [line 219](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L219).
- `TestEquationFour.test_fragility_index_is_the_shortage_as_a_percentage` — method, [line 222](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L222).
- `TestEquationSix` — ClassDef, [line 229](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L229).
- `TestEquationSix.test_downtime_satisfies_the_papers_identity` — method, [line 239](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L239).
- `TestEquationSix.test_availability_recovers_from_uptime_and_downtime` — method, [line 250](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L250).
- `TestEquationSix.test_uptime_is_reported_in_years_and_is_plausible` — method, [line 268](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L268).
- `TestMonotonicity` — ClassDef, [line 279](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L279).
- `TestMonotonicity.test_adding_an_api_supplier_never_increases_shortage` — method, [line 288](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L288).
- `TestMonotonicity.test_adding_a_plant_never_increases_shortage` — method, [line 295](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L295).
- `TestMonotonicity.test_adding_a_line_never_increases_shortage` — method, [line 301](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L301).
- `TestMonotonicity.test_supplier_redundancy_helps_more_than_line_redundancy` — method, [line 307](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L307).
- `TestMonotonicity.test_a_faster_repair_never_increases_shortage` — method, [line 325](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L325).
- `TestBounds` — ClassDef, [line 336](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L336).
- `TestBounds.test_all_probabilities_stay_in_the_unit_interval` — method, [line 342](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability.py#L342).

## Static dependencies

- [apps/brain/app/domain/**init**.py](./apps--brain--app--domain--__init__.py.md)

Other import specifiers: `__future__`, `pytest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `f7c49d61b3db5a8e20063b9f92f01a0538e2966e13da9bcda03f7e265077f01c`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
