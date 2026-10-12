"""Wraps the pure model in the provenance envelopes the covenant requires.

The split is the point of the layering (PART 3A.8):

    domain/reliability.py     the equations. Floats in, floats out. No idea that
                              provenance, JSON or HTTP exist.
    services/                 this file. Turns those floats into `Quantity`
                              envelopes with their tags, bands, assumptions and
                              calculation methods attached.
    routers/                  HTTP only.

Keeping the envelope-building here rather than in the domain means the model can
be tested against the paper's table with plain floats, and means every number
that leaves this service carries its provenance without the equations having to
know about it.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings
from app.domain import paper_baseline, rate_estimation, reliability
from app.schemas import (
    Band,
    Provenance,
    Quantity,
    RateFitRequest,
    RateProvenance,
    ReliabilityInput,
    ReliabilityResponse,
)

PAPER_URL = "https://arxiv.org/abs/2107.09167"
PAPER_NAME = "Tucker & Daskin (2021), arXiv:2107.09167"

#: Half-width of the sensitivity band on every MODELLED value, as a fraction.
#: Bands are sensitivity ranges, not confidence intervals, and are labelled so.
BAND_RELATIVE_WIDTH = 0.30

PERCENT = 100.0


@dataclass(frozen=True)
class ModelledContext:
    """The parts of a MODELLED quantity that are the same for every figure.

    Bundled into one value because a MODELLED `Quantity` genuinely needs all of
    them and passing seven positional arguments per figure would be unreadable
    (PART 3A.12: use an options object beyond four parameters).
    """

    assumptions: dict[str, object]
    confidence: float
    fetched_at: str


def _modelled(
    value: float,
    unit: str | None,
    method: str,
    context: ModelledContext,
    *,
    band_scale: float = 1.0,
) -> Quantity:
    """Builds a MODELLED quantity, band and assumptions included.

    Args:
        value: the modelled figure.
        unit: SI unit, or None for a unitless probability or index.
        method: the equation, cited by paper equation number.
        context: the assumptions, confidence and fetch time shared by every
            figure in one computation.
        band_scale: multiplier applied to the band bounds, for values expressed
            on a 0-100 scale rather than 0-1.

    Returns:
        A `Quantity` that satisfies the covenant's MODELLED rules by construction.
    """
    if unit == "years":
        low, high = value * (1 - BAND_RELATIVE_WIDTH), value * (1 + BAND_RELATIVE_WIDTH)
    else:
        low, high = rate_estimation.sensitivity_band(value / band_scale, BAND_RELATIVE_WIDTH)

    return Quantity(
        value=value,
        unit=unit,
        tag="MODELLED",
        band=Band(
            low=low if unit == "years" else low * band_scale,
            high=high if unit == "years" else high * band_scale,
        ),
        provenance=Provenance(
            source_name=PAPER_NAME,
            source_url=PAPER_URL,
            query=None,
            fetched_at=context.fetched_at,
            calculation_method=method,
            assumptions=context.assumptions,
            confidence=context.confidence,
        ),
    )


def _shared_assumptions(
    rates: reliability.ReliabilityRates, origins: RateProvenance
) -> dict[str, object]:
    """The assumptions restated on every figure this service returns.

    They are attached to each `Quantity` rather than mentioned once in a footnote
    because a number that travels into a report, a screenshot or a slide must
    carry its caveats with it.
    """
    return {
        "model": PAPER_NAME,
        "echelons_assumed_independent": True,
        "component_lifetimes_assumed_exponential": True,
        "z_line_is_a_scenario_default": rates.z_line == 1,
        "z_api_interpretation": (
            "Caller-supplied API redundancy; public labeler counts do not "
            "establish independent API suppliers."
        ),
        "z_plant_interpretation": (
            "Caller-supplied plant redundancy; the operational workflow "
            "uses a labeler-concentration proxy."
        ),
        "mu_fitted_only_from_resolved_shortages_so_is_optimistic": True,
        "rate_origins": origins.model_dump(),
    }


class ReliabilityService:
    """Fits rates from history, runs the model, wraps the output in envelopes."""

    def fit_and_compute(self, request: RateFitRequest, fetched_at: str) -> ReliabilityResponse:
        """The whole QUANTIFY stage for one drug.

        Args:
            request: observed history and redundancy counts.
            fetched_at: when the underlying openFDA data was fetched. Passed in
                rather than read from a clock, so the result is reproducible.

        Returns:
            Every reliability figure, each as a MODELLED `Quantity` with its band,
            assumptions and confidence.
        """
        baseline = paper_baseline.baseline_rates(request.z_api, request.z_plant, request.z_line)

        # Only the supplier echelon's rates can be fitted from public history:
        # openFDA recalls and shortages are reported at product level, and there
        # is no public series for plant or line events at all. Those two echelons
        # therefore always use the paper's baseline, and say so.
        lam_api = rate_estimation.estimate_failure_rate(
            event_count=request.recall_count,
            observation_window_years=request.observation_window_years,
            fallback_rate=baseline.lam_api,
        )
        mu_api = rate_estimation.estimate_repair_rate(
            durations_days=request.resolved_shortage_durations_days,
            observation_window_years=request.observation_window_years,
            fallback_rate=baseline.mu_api,
        )

        rates = reliability.ReliabilityRates(
            z_api=request.z_api,
            z_plant=request.z_plant,
            z_line=request.z_line,
            lam_api=lam_api.value,
            mu_api=mu_api.value,
            lam_plant=baseline.lam_plant,
            mu_plant=baseline.mu_plant,
            lam_line=baseline.lam_line,
            mu_line=baseline.mu_line,
        )

        origins = RateProvenance(
            lam_api=lam_api.origin.value,
            mu_api=mu_api.origin.value,
            lam_plant="PAPER_BASELINE_FALLBACK",
            mu_plant="PAPER_BASELINE_FALLBACK",
            lam_line="PAPER_BASELINE_FALLBACK",
            mu_line="PAPER_BASELINE_FALLBACK",
            event_counts={
                "recalls": lam_api.event_count,
                "resolved_shortages": mu_api.event_count,
            },
        )

        result = reliability.compute(rates)
        assumptions = _shared_assumptions(rates, origins)
        # The whole record is only as trustworthy as its weakest input rate.
        confidence = min(lam_api.confidence, mu_api.confidence)
        context = ModelledContext(
            assumptions=assumptions, confidence=confidence, fetched_at=fetched_at
        )

        return ReliabilityResponse(
            drug_id=request.drug_id,
            input=ReliabilityInput(
                drug_id=request.drug_id,
                z_api=rates.z_api,
                z_plant=rates.z_plant,
                z_line=rates.z_line,
                lam_api=rates.lam_api,
                mu_api=rates.mu_api,
                lam_plant=rates.lam_plant,
                mu_plant=rates.mu_plant,
                lam_line=rates.lam_line,
                mu_line=rates.mu_line,
            ),
            rate_origins=origins,
            r_api=_modelled(
                result.r_api,
                None,
                "r_api = 1 - p_api^z_api  (paper eq. 2), p = lam/(lam+mu)  (eq. 1)",
                context,
            ),
            r_pl=_modelled(
                result.r_plant_line,
                None,
                "r_pl = 1 - [p_p + (1-p_p) p_l^z_line]^z_plant  (paper eq. 3)",
                context,
            ),
            r=_modelled(
                result.r,
                None,
                "r = r_api * r_pl  (paper eq. 4)",
                context,
            ),
            expected_shortage_s=_modelled(
                result.expected_shortage_s,
                None,
                "s = 1 - r",
                context,
            ),
            mean_time_to_failure_years=_modelled(
                result.mean_uptime_years,
                "years",
                "U = r / nu, where nu is the system up-to-down transition "
                "frequency by the frequency-duration method. Derived, not the "
                "paper's closed form; see docs/MODEL_CARDS.md.",
                context,
                band_scale=max(result.mean_uptime_years, 1.0),
            ),
            mean_time_to_recovery_years=_modelled(
                result.mean_downtime_years,
                "years",
                "D = U/r - U  (paper eq. 6)",
                context,
                band_scale=max(result.mean_downtime_years, 1.0),
            ),
            fragility_index_0_100=_modelled(
                result.fragility_index_0_100,
                None,
                "Fragility Index = 100 * s",
                context,
                band_scale=PERCENT,
            ),
            computed_at=fetched_at,
            assumptions=assumptions,
            provenance=Provenance(
                source_name=PAPER_NAME,
                source_url=PAPER_URL,
                query=None,
                fetched_at=fetched_at,
                calculation_method=(
                    "Series-parallel availability model, equations 1-4 and 6, "
                    f"parametrised from openFDA history where available. v{settings.version}."
                ),
                assumptions=assumptions,
                confidence=confidence,
            ),
        )
