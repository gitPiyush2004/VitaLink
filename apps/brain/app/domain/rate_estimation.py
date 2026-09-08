"""Fitting lambda and mu from real openFDA history.

This is where the reliability model stops being the paper's and starts being
about a specific drug. The paper supplies the equations and a baseline
parametrisation; openFDA supplies the events that let us estimate the rates for
an actual product.

    lambda  failure rate      <- 1 / mean time between recalls, from
                                 openFDA drug/enforcement
    mu      repair rate       <- 1 / mean shortage duration, from resolved
                                 openFDA drug/shortages records

The honest part is the fallback. A drug with one recall in twenty years does not
give a usable failure rate — the estimate would swing wildly on the next event —
so below a documented minimum event count the paper's baseline is used instead,
and the result is tagged ``PAPER_BASELINE_FALLBACK`` on that specific rate. It is
never quietly substituted, because a Fragility Index computed from the paper's
numbers describes the paper's supply chain, not this drug's.

All pure functions. No I/O, no clock: the observation window is passed in, so a
test does not depend on today's date.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

#: Below this many observed events, a fitted rate is not trustworthy and the
#: paper's baseline is used instead. Three is the smallest count from which a
#: mean interval has any stability at all, and the choice is stated in the model
#: card rather than tuned.
MIN_EVENTS_TO_FIT_RATE = 3

DAYS_PER_YEAR = 365.25


class RateOrigin(str, Enum):
    """Where a rate came from. Travels with the number, all the way to the UI."""

    FITTED_FROM_HISTORY = "FITTED_FROM_HISTORY"
    PAPER_BASELINE_FALLBACK = "PAPER_BASELINE_FALLBACK"


@dataclass(frozen=True)
class RateEstimate:
    """One rate, with everything a reader needs to judge it.

    Attributes:
        value: the rate, per year.
        origin: fitted, or the paper's baseline.
        event_count: how many real events the fit was based on. Shown next to the
            number, because "fitted from 3 events" and "fitted from 40" deserve
            different levels of trust.
        observation_window_years: the window the events were counted over. A
            count without a window is meaningless.
        confidence: 0..1. Grows with the event count and saturates. This is a
            reported honesty signal, not a statistical confidence interval, and
            it is labelled as such in the model card.
    """

    value: float
    origin: RateOrigin
    event_count: int
    observation_window_years: float
    confidence: float


#: The event count at which the confidence signal saturates. Chosen so that a
#: drug with a couple of decades of recall history reads as well-characterised.
CONFIDENCE_SATURATION_EVENTS = 20
#: Confidence assigned to a paper-baseline fallback. Deliberately low: the
#: equations are the paper's, but the parametrisation is not this drug's.
FALLBACK_CONFIDENCE = 0.3


def _confidence_from_event_count(event_count: int) -> float:
    """A monotone signal that saturates, not a statistical interval.

    Deliberately simple and deliberately labelled. Reporting a bootstrap
    confidence interval on three events would give the number a precision it does
    not have; reporting nothing would let a three-event fit look like a
    forty-event one.
    """
    return min(1.0, event_count / CONFIDENCE_SATURATION_EVENTS)


def estimate_failure_rate(
    event_count: int,
    observation_window_years: float,
    fallback_rate: float,
) -> RateEstimate:
    """Fits lambda from a count of failure events over a known window.

    Uses the homogeneous-Poisson maximum-likelihood estimator,
    ``lambda = count / window``, rather than ``1 / mean interval``. Two reasons:
    it is defined when the events are not evenly spaced, and it does not require
    knowing the interval before the first observed event, which openFDA does not
    tell us.

    Args:
        event_count: recalls observed for this drug or echelon.
        observation_window_years: the span the count covers. Must be positive.
        fallback_rate: the paper's baseline lambda for this echelon, used when the
            event count is too low to fit.

    Returns:
        The estimate, tagged with where it came from.

    Raises:
        ValueError: if the observation window is not positive, or the count is
            negative.
    """
    if observation_window_years <= 0:
        raise ValueError(f"observation window must be positive, got {observation_window_years}")
    if event_count < 0:
        raise ValueError(f"event count cannot be negative, got {event_count}")

    if event_count < MIN_EVENTS_TO_FIT_RATE:
        return RateEstimate(
            value=fallback_rate,
            origin=RateOrigin.PAPER_BASELINE_FALLBACK,
            event_count=event_count,
            observation_window_years=observation_window_years,
            confidence=FALLBACK_CONFIDENCE,
        )

    return RateEstimate(
        value=event_count / observation_window_years,
        origin=RateOrigin.FITTED_FROM_HISTORY,
        event_count=event_count,
        observation_window_years=observation_window_years,
        confidence=_confidence_from_event_count(event_count),
    )


def estimate_repair_rate(
    durations_days: list[float],
    observation_window_years: float,
    fallback_rate: float,
) -> RateEstimate:
    """Fits mu from the durations of resolved shortages.

    ``mu = 1 / mean duration``, the maximum-likelihood estimator for an
    exponential repair time — which is the distribution the two-state Markov
    model in ``reliability.py`` assumes. Using the same distributional assumption
    for the fit as for the model is the point; fitting a Weibull here and then
    feeding it to an exponential model would be worse than the fallback.

    **Survivorship note.** Only *resolved* shortages have a duration, so this fit
    systematically excludes the ongoing ones — which are, by definition, the long
    ones. The estimate is therefore biased towards faster repair, meaning the
    Fragility Index it produces is optimistic. That is stated in the model card
    and in the report's threats-to-validity section rather than buried.

    Args:
        durations_days: duration in days of each resolved shortage.
        observation_window_years: the span the records cover.
        fallback_rate: the paper's baseline mu for this echelon.

    Returns:
        The estimate, tagged with where it came from.

    Raises:
        ValueError: if any duration is not positive, or the window is not positive.
    """
    if observation_window_years <= 0:
        raise ValueError(f"observation window must be positive, got {observation_window_years}")

    usable = [duration for duration in durations_days if duration > 0]
    if any(duration <= 0 for duration in durations_days):
        raise ValueError("shortage durations must be positive; a zero-day shortage is not one")

    if len(usable) < MIN_EVENTS_TO_FIT_RATE:
        return RateEstimate(
            value=fallback_rate,
            origin=RateOrigin.PAPER_BASELINE_FALLBACK,
            event_count=len(usable),
            observation_window_years=observation_window_years,
            confidence=FALLBACK_CONFIDENCE,
        )

    mean_duration_years = (sum(usable) / len(usable)) / DAYS_PER_YEAR
    return RateEstimate(
        value=1.0 / mean_duration_years,
        origin=RateOrigin.FITTED_FROM_HISTORY,
        event_count=len(usable),
        observation_window_years=observation_window_years,
        confidence=_confidence_from_event_count(len(usable)),
    )


def sensitivity_band(point: float, relative_width: float) -> tuple[float, float]:
    """Turns a modelled point into the low-high band the covenant requires.

    Every MODELLED value in Vitalink is reported as a band, never as a point
    (Rule 1). The band here is a **sensitivity** band, not a statistical
    confidence interval: it answers "how much does the answer move if the inputs
    move by this much", which is the question a supply chain manager is actually
    asking, and it is labelled that way everywhere it appears.

    Args:
        point: the modelled value.
        relative_width: half-width as a fraction of the point, e.g. 0.3 for +/-30%.

    Returns:
        ``(low, high)``, clamped to [0, 1] because every quantity this is applied
        to is a probability.

    Raises:
        ValueError: if the relative width is negative.
    """
    if relative_width < 0:
        raise ValueError(f"relative width cannot be negative, got {relative_width}")

    low = max(0.0, point * (1.0 - relative_width))
    high = min(1.0, point * (1.0 + relative_width))
    return low, high
