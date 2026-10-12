"""API-level tests for the compute service.

These use FastAPI's `TestClient` against the real app, not a mock of it. There is
nothing to mock: the service is stateless and pure, so the "integration" test is
as cheap as a unit test.

The assertions worth reading are the covenant ones. Every figure that comes out of
this service must be a MODELLED `Quantity` with a band, its assumptions and a
confidence — and because `Quantity`'s pydantic validator enforces that, a
response that violated it could not be serialised at all. These tests confirm the
enforcement is actually wired in rather than merely defined.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import Provenance, Quantity

client = TestClient(app)

FETCHED_AT = "2026-09-01T00:00:00.000Z"


def fit_request(**overrides: object) -> dict[str, object]:
    """A well-characterised drug: enough history to fit both rates."""
    return {
        "drug_id": "drug-heparin-sodium",
        "recall_count": 12,
        "resolved_shortage_durations_days": [180.0, 240.0, 95.0, 310.0, 150.0],
        "observation_window_years": 20.0,
        "z_api": 2,
        "z_plant": 1,
        "z_line": 1,
        **overrides,
    }


def post_fit(payload: dict[str, object]) -> dict[str, object]:
    response = client.post(
        "/reliability/fit",
        json=payload,
        headers={"X-Vitalink-Fetched-At": FETCHED_AT},
    )
    assert response.status_code == 200, response.text
    return response.json()


class TestHealth:
    def test_reports_alive_without_touching_anything(self) -> None:
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json()["service"] == "brain"


class TestReliabilityFit:
    def test_returns_every_reliability_figure(self) -> None:
        body = post_fit(fit_request())

        for field in (
            "r_api",
            "r_pl",
            "r",
            "expected_shortage_s",
            "mean_time_to_failure_years",
            "mean_time_to_recovery_years",
            "fragility_index_0_100",
        ):
            assert field in body, f"missing {field}"

    def test_every_figure_is_a_modelled_quantity_with_a_band(self) -> None:
        # Rule 1: a MODELLED value is never rendered as a point. Enforcing it in
        # the schema means the UI cannot receive a point-valued model output even
        # if a component tried to render one.
        body = post_fit(fit_request())

        for field in ("r", "expected_shortage_s", "fragility_index_0_100"):
            quantity = body[field]
            assert quantity["tag"] == "MODELLED"
            assert quantity["band"] is not None
            assert quantity["band"]["low"] <= quantity["value"] <= quantity["band"]["high"]

    def test_wire_format_omits_unset_optional_provenance_but_keeps_required_nulls(self) -> None:
        body = post_fit(fit_request())
        quantity = body["r"]
        assert quantity["unit"] is None
        assert quantity["provenance"]["query"] is None
        assert "llm_model" not in quantity["provenance"]
        assert "prompt_hash" not in quantity["provenance"]

    def test_year_bands_are_not_clipped_as_probabilities(self) -> None:
        body = post_fit(fit_request())
        quantity = body["mean_time_to_failure_years"]
        assert quantity["value"] > 1
        assert quantity["band"]["low"] < quantity["value"] < quantity["band"]["high"]

    def test_every_figure_carries_its_equation(self) -> None:
        body = post_fit(fit_request())

        assert "paper eq. 2" in body["r_api"]["provenance"]["calculation_method"]
        assert "paper eq. 3" in body["r_pl"]["provenance"]["calculation_method"]
        assert "paper eq. 4" in body["r"]["provenance"]["calculation_method"]
        assert (
            "paper eq. 6" in body["mean_time_to_recovery_years"]["provenance"]["calculation_method"]
        )

    def test_every_figure_carries_the_papers_assumptions(self) -> None:
        body = post_fit(fit_request())

        assumptions = body["expected_shortage_s"]["provenance"]["assumptions"]
        assert assumptions["echelons_assumed_independent"] is True
        assert assumptions["component_lifetimes_assumed_exponential"] is True
        # The two limitations discovered during the build, restated on the number
        # itself rather than only in a document nobody opens.
        assert "labeler counts" in assumptions["z_api_interpretation"]
        assert assumptions["mu_fitted_only_from_resolved_shortages_so_is_optimistic"] is True

    def test_the_response_says_which_rates_were_fitted_and_which_fell_back(self) -> None:
        body = post_fit(fit_request())

        origins = body["rate_origins"]
        assert origins["lam_api"] == "FITTED_FROM_HISTORY"
        assert origins["mu_api"] == "FITTED_FROM_HISTORY"
        # No public source publishes plant or line event series, so these two
        # echelons always use the paper's baseline and always say so.
        assert origins["lam_plant"] == "PAPER_BASELINE_FALLBACK"
        assert origins["lam_line"] == "PAPER_BASELINE_FALLBACK"
        assert origins["event_counts"]["recalls"] == 12
        assert origins["event_counts"]["resolved_shortages"] == 5

    def test_a_drug_with_no_history_falls_back_and_reports_low_confidence(self) -> None:
        body = post_fit(fit_request(recall_count=0, resolved_shortage_durations_days=[]))

        assert body["rate_origins"]["lam_api"] == "PAPER_BASELINE_FALLBACK"
        assert body["rate_origins"]["mu_api"] == "PAPER_BASELINE_FALLBACK"
        assert body["expected_shortage_s"]["provenance"]["confidence"] < 0.5

    def test_confidence_is_the_weakest_input_rate(self) -> None:
        # A record is only as trustworthy as its worst-characterised input, so
        # taking the minimum rather than an average is deliberate.
        body = post_fit(fit_request(recall_count=40, resolved_shortage_durations_days=[]))

        assert body["expected_shortage_s"]["provenance"]["confidence"] < 0.5

    def test_a_second_supplier_reduces_the_fragility_index(self) -> None:
        one = post_fit(fit_request(z_api=1))
        two = post_fit(fit_request(z_api=2))

        assert two["fragility_index_0_100"]["value"] < one["fragility_index_0_100"]["value"]

    def test_the_fetched_at_header_is_required(self) -> None:
        # Without it the service would have to read its own clock, and a stored
        # reliability record would stop being reproducible from its inputs.
        response = client.post("/reliability/fit", json=fit_request())

        assert response.status_code == 422

    def test_the_fetch_time_is_echoed_rather_than_replaced_with_now(self) -> None:
        body = post_fit(fit_request())

        assert body["computed_at"] == FETCHED_AT
        assert body["r"]["provenance"]["fetched_at"] == FETCHED_AT

    def test_rejects_a_redundancy_count_below_one(self) -> None:
        response = client.post(
            "/reliability/fit",
            json=fit_request(z_api=0),
            headers={"X-Vitalink-Fetched-At": FETCHED_AT},
        )

        assert response.status_code == 422

    def test_rejects_an_unknown_field_rather_than_ignoring_it(self) -> None:
        # `extra="forbid"`, the same intent as Mongoose's `strict: 'throw'`: a
        # field the caller thinks it is sending must not vanish silently.
        response = client.post(
            "/reliability/fit",
            json=fit_request(surprise_field="hello"),
            headers={"X-Vitalink-Fetched-At": FETCHED_AT},
        )

        assert response.status_code == 422


class TestQuantitySchemaEnforcesTheCovenant:
    """The pydantic mirror must refuse exactly what the zod original refuses."""

    def test_rejects_a_derived_value_with_no_calculation_method(self) -> None:
        try:
            Quantity(
                value=1.0,
                unit=None,
                tag="DERIVED",
                provenance=Provenance(
                    source_name="openFDA",
                    source_url="https://api.fda.gov/drug/ndc.json",
                    fetched_at=FETCHED_AT,
                ),
            )
        except ValueError as error:
            assert "how it was calculated" in str(error)
        else:
            raise AssertionError("a DERIVED value with no formula was accepted")

    def test_rejects_a_modelled_value_with_no_band(self) -> None:
        try:
            Quantity(
                value=0.04,
                unit=None,
                tag="MODELLED",
                provenance=Provenance(
                    source_name="Tucker & Daskin",
                    source_url="https://arxiv.org/abs/2107.09167",
                    fetched_at=FETCHED_AT,
                    calculation_method="s = 1 - r",
                    assumptions={"z_line": 1},
                    confidence=0.6,
                ),
            )
        except ValueError as error:
            assert "band" in str(error)
        else:
            raise AssertionError("a MODELLED point value was accepted")

    def test_accepts_a_real_value_with_only_a_source(self) -> None:
        quantity = Quantity(
            value=47.0,
            unit="count",
            tag="REAL",
            provenance=Provenance(
                source_name="openFDA NDC Directory",
                source_url="https://api.fda.gov/drug/ndc.json",
                query='search=generic_name:"heparin sodium"&count=labeler_name.exact',
                fetched_at=FETCHED_AT,
            ),
        )

        assert quantity.tag == "REAL"
