---
source: 'apps/brain/tests/test_reliability_api.py'
component: brain
generated: true
---

# apps/brain/tests/test_reliability_api.py

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Calculates the published reliability model and proxy-rate fits; formula reproduction is not validated forecasting.

## Source structure

- `fit_request` — FunctionDef, [line 26](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L26).
- `post_fit` — FunctionDef, [line 40](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L40).
- `TestHealth` — ClassDef, [line 50](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L50).
- `TestHealth.test_reports_alive_without_touching_anything` — method, [line 51](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L51).
- `TestReliabilityFit` — ClassDef, [line 58](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L58).
- `TestReliabilityFit.test_returns_every_reliability_figure` — method, [line 59](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L59).
- `TestReliabilityFit.test_every_figure_is_a_modelled_quantity_with_a_band` — method, [line 73](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L73).
- `TestReliabilityFit.test_wire_format_omits_unset_optional_provenance_but_keeps_required_nulls` — method, [line 85](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L85).
- `TestReliabilityFit.test_year_bands_are_not_clipped_as_probabilities` — method, [line 93](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L93).
- `TestReliabilityFit.test_every_figure_carries_its_equation` — method, [line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L99).
- `TestReliabilityFit.test_every_figure_carries_the_papers_assumptions` — method, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L109).
- `TestReliabilityFit.test_the_response_says_which_rates_were_fitted_and_which_fell_back` — method, [line 120](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L120).
- `TestReliabilityFit.test_a_drug_with_no_history_falls_back_and_reports_low_confidence` — method, [line 133](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L133).
- `TestReliabilityFit.test_confidence_is_the_weakest_input_rate` — method, [line 140](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L140).
- `TestReliabilityFit.test_a_second_supplier_reduces_the_fragility_index` — method, [line 147](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L147).
- `TestReliabilityFit.test_the_fetched_at_header_is_required` — method, [line 153](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L153).
- `TestReliabilityFit.test_the_fetch_time_is_echoed_rather_than_replaced_with_now` — method, [line 160](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L160).
- `TestReliabilityFit.test_rejects_a_redundancy_count_below_one` — method, [line 166](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L166).
- `TestReliabilityFit.test_rejects_an_unknown_field_rather_than_ignoring_it` — method, [line 175](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L175).
- `TestQuantitySchemaEnforcesTheCovenant` — ClassDef, [line 187](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L187).
- `TestQuantitySchemaEnforcesTheCovenant.test_rejects_a_derived_value_with_no_calculation_method` — method, [line 190](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L190).
- `TestQuantitySchemaEnforcesTheCovenant.test_rejects_a_modelled_value_with_no_band` — method, [line 207](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L207).
- `TestQuantitySchemaEnforcesTheCovenant.test_accepts_a_real_value_with_only_a_source` — method, [line 227](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_reliability_api.py#L227).

## Static dependencies

- [apps/brain/app/main.py](./apps--brain--app--main.py.md)
- [apps/brain/app/schemas.py](./apps--brain--app--schemas.py.md)

Other import specifiers: `__future__`, `fastapi.testclient`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `2d16fe8140c3d3204aa1e22ce3bb8b58e2a7c67c422d03860f19e92bccd97fa4`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
