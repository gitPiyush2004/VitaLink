---
source: 'apps/brain/tests/test_rate_estimation.py'
component: brain
generated: true
---

# apps/brain/tests/test_rate_estimation.py

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Calculates the published reliability model and proxy-rate fits; formula reproduction is not validated forecasting.

## Source structure

- `TestFailureRateFitting` — ClassDef, [line 26](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L26).
- `TestFailureRateFitting.test_fits_lambda_as_events_over_the_observation_window` — method, [line 27](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L27).
- `TestFailureRateFitting.test_falls_back_below_the_minimum_event_count` — method, [line 35](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L35).
- `TestFailureRateFitting.test_fits_at_exactly_the_minimum_event_count` — method, [line 45](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L45).
- `TestFailureRateFitting.test_a_drug_with_no_recalls_falls_back_rather_than_being_called_perfect` — method, [line 55](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L55).
- `TestFailureRateFitting.test_confidence_grows_with_the_event_count_and_saturates` — method, [line 67](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L67).
- `TestFailureRateFitting.test_a_fallback_reports_low_confidence` — method, [line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L75).
- `TestFailureRateFitting.test_the_observation_window_travels_with_the_estimate` — method, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L81).
- `TestFailureRateFitting.test_rejects_a_non_positive_observation_window` — method, [line 89](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L89).
- `TestFailureRateFitting.test_rejects_a_negative_event_count` — method, [line 93](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L93).
- `TestRepairRateFitting` — ClassDef, [line 98](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L98).
- `TestRepairRateFitting.test_fits_mu_as_the_reciprocal_of_the_mean_duration` — method, [line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L99).
- `TestRepairRateFitting.test_a_shorter_mean_shortage_gives_a_faster_repair_rate` — method, [line 110](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L110).
- `TestRepairRateFitting.test_falls_back_with_too_few_resolved_shortages` — method, [line 116](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L116).
- `TestRepairRateFitting.test_falls_back_with_no_resolved_shortages_at_all` — method, [line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L122).
- `TestRepairRateFitting.test_rejects_a_zero_length_shortage` — method, [line 128](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L128).
- `TestRepairRateFitting.test_rejects_a_negative_duration` — method, [line 134](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L134).
- `TestSensitivityBand` — ClassDef, [line 139](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L139).
- `TestSensitivityBand.test_widens_symmetrically_around_the_point` — method, [line 140](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L140).
- `TestSensitivityBand.test_clamps_to_the_unit_interval` — method, [line 146](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L146).
- `TestSensitivityBand.test_a_zero_width_band_is_a_point_but_still_a_band` — method, [line 154](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L154).
- `TestSensitivityBand.test_rejects_a_negative_width` — method, [line 160](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/brain/tests/test_rate_estimation.py#L160).

## Static dependencies

- [apps/brain/app/domain/**init**.py](./apps--brain--app--domain--__init__.py.md)
- [apps/brain/app/domain/rate_estimation.py](./apps--brain--app--domain--rate_estimation.py.md)

Other import specifiers: `__future__`, `pytest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `d847c3af863c8369b82fe87fa32e3c3ea09361c3305beb166a133d9e80af485a`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
