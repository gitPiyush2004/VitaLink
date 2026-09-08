"""Rate fitting, and the fallback that keeps it honest.

The fallback behaviour is the part worth testing hardest. A drug with one recall
in twenty years must not get a fitted rate, because the next event would move the
estimate by a factor of two — and a Fragility Index that swings like that is
worse than no Fragility Index.
"""

from __future__ import annotations

import pytest

from app.domain import paper_baseline
from app.domain.rate_estimation import (
    MIN_EVENTS_TO_FIT_RATE,
    RateOrigin,
    estimate_failure_rate,
    estimate_repair_rate,
    sensitivity_band,
)

BASELINE_LAM_API = 1.0 / paper_baseline.SUPPLIER.mtbf_years
BASELINE_MU_API = 1.0 / paper_baseline.SUPPLIER.recovery_years


class TestFailureRateFitting:
    def test_fits_lambda_as_events_over_the_observation_window(self) -> None:
        estimate = estimate_failure_rate(
            event_count=10, observation_window_years=20.0, fallback_rate=BASELINE_LAM_API
        )

        assert estimate.value == pytest.approx(0.5)
        assert estimate.origin is RateOrigin.FITTED_FROM_HISTORY

    def test_falls_back_below_the_minimum_event_count(self) -> None:
        estimate = estimate_failure_rate(
            event_count=MIN_EVENTS_TO_FIT_RATE - 1,
            observation_window_years=20.0,
            fallback_rate=BASELINE_LAM_API,
        )

        assert estimate.value == pytest.approx(BASELINE_LAM_API)
        assert estimate.origin is RateOrigin.PAPER_BASELINE_FALLBACK

    def test_fits_at_exactly_the_minimum_event_count(self) -> None:
        estimate = estimate_failure_rate(
            event_count=MIN_EVENTS_TO_FIT_RATE,
            observation_window_years=15.0,
            fallback_rate=BASELINE_LAM_API,
        )

        assert estimate.origin is RateOrigin.FITTED_FROM_HISTORY
        assert estimate.value == pytest.approx(MIN_EVENTS_TO_FIT_RATE / 15.0)

    def test_a_drug_with_no_recalls_falls_back_rather_than_being_called_perfect(self) -> None:
        # This is the important one. Zero events would fit lambda = 0, which makes
        # the drug perfectly reliable and its Fragility Index zero — a confident
        # claim built on no evidence at all.
        estimate = estimate_failure_rate(
            event_count=0, observation_window_years=20.0, fallback_rate=BASELINE_LAM_API
        )

        assert estimate.value == pytest.approx(BASELINE_LAM_API)
        assert estimate.origin is RateOrigin.PAPER_BASELINE_FALLBACK
        assert estimate.event_count == 0

    def test_confidence_grows_with_the_event_count_and_saturates(self) -> None:
        few = estimate_failure_rate(3, 20.0, BASELINE_LAM_API)
        many = estimate_failure_rate(15, 20.0, BASELINE_LAM_API)
        saturated = estimate_failure_rate(200, 20.0, BASELINE_LAM_API)

        assert few.confidence < many.confidence
        assert saturated.confidence == pytest.approx(1.0)

    def test_a_fallback_reports_low_confidence(self) -> None:
        # The equations are the paper's; the parametrisation is not this drug's.
        estimate = estimate_failure_rate(1, 20.0, BASELINE_LAM_API)

        assert estimate.confidence < 0.5

    def test_the_observation_window_travels_with_the_estimate(self) -> None:
        # An event count without a window is meaningless: "4 recalls" says
        # nothing until you know whether that was over one year or forty.
        estimate = estimate_failure_rate(4, 12.5, BASELINE_LAM_API)

        assert estimate.observation_window_years == pytest.approx(12.5)
        assert estimate.event_count == 4

    def test_rejects_a_non_positive_observation_window(self) -> None:
        with pytest.raises(ValueError, match="observation window must be positive"):
            estimate_failure_rate(5, 0.0, BASELINE_LAM_API)

    def test_rejects_a_negative_event_count(self) -> None:
        with pytest.raises(ValueError, match="event count cannot be negative"):
            estimate_failure_rate(-1, 10.0, BASELINE_LAM_API)


class TestRepairRateFitting:
    def test_fits_mu_as_the_reciprocal_of_the_mean_duration(self) -> None:
        # Three shortages of 365.25 days each -> mean 1 year -> mu = 1/year.
        estimate = estimate_repair_rate(
            durations_days=[365.25, 365.25, 365.25],
            observation_window_years=10.0,
            fallback_rate=BASELINE_MU_API,
        )

        assert estimate.value == pytest.approx(1.0)
        assert estimate.origin is RateOrigin.FITTED_FROM_HISTORY

    def test_a_shorter_mean_shortage_gives_a_faster_repair_rate(self) -> None:
        fast = estimate_repair_rate([30.0, 30.0, 30.0], 10.0, BASELINE_MU_API)
        slow = estimate_repair_rate([300.0, 300.0, 300.0], 10.0, BASELINE_MU_API)

        assert fast.value > slow.value

    def test_falls_back_with_too_few_resolved_shortages(self) -> None:
        estimate = estimate_repair_rate([120.0], 10.0, BASELINE_MU_API)

        assert estimate.value == pytest.approx(BASELINE_MU_API)
        assert estimate.origin is RateOrigin.PAPER_BASELINE_FALLBACK

    def test_falls_back_with_no_resolved_shortages_at_all(self) -> None:
        estimate = estimate_repair_rate([], 10.0, BASELINE_MU_API)

        assert estimate.origin is RateOrigin.PAPER_BASELINE_FALLBACK
        assert estimate.event_count == 0

    def test_rejects_a_zero_length_shortage(self) -> None:
        # A zero-day shortage is a data error, not an instantly-resolved
        # shortage, and admitting it would push mu to infinity.
        with pytest.raises(ValueError, match="durations must be positive"):
            estimate_repair_rate([30.0, 0.0, 40.0], 10.0, BASELINE_MU_API)

    def test_rejects_a_negative_duration(self) -> None:
        with pytest.raises(ValueError, match="durations must be positive"):
            estimate_repair_rate([30.0, -5.0], 10.0, BASELINE_MU_API)


class TestSensitivityBand:
    def test_widens_symmetrically_around_the_point(self) -> None:
        low, high = sensitivity_band(0.10, 0.30)

        assert low == pytest.approx(0.07)
        assert high == pytest.approx(0.13)

    def test_clamps_to_the_unit_interval(self) -> None:
        # These are probabilities. A band reaching 1.2 would be nonsense on a
        # chart and worse in a report.
        low, high = sensitivity_band(0.95, 0.30)

        assert high == pytest.approx(1.0)
        assert low >= 0.0

    def test_a_zero_width_band_is_a_point_but_still_a_band(self) -> None:
        low, high = sensitivity_band(0.5, 0.0)

        assert low == pytest.approx(0.5)
        assert high == pytest.approx(0.5)

    def test_rejects_a_negative_width(self) -> None:
        with pytest.raises(ValueError, match="cannot be negative"):
            sensitivity_band(0.5, -0.1)
