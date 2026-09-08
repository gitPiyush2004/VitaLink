"""pydantic v2 mirror of `packages/contracts`.

The API and the browser share zod schemas directly. This service cannot, so it
mirrors them — and a mirror rots silently unless something checks it. That check
is `tests/test_contract_drift.py`, which reads the TypeScript source and compares
the field names.

Field names are `snake_case` on both sides, which is why the mirror is mechanical
enough to check at all: the API's repository layer does the camelCase translation,
so the wire format is snake_case end to end.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProvenanceTag = Literal["REAL", "DERIVED", "MODELLED", "SCENARIO"]


class Band(BaseModel):
    """A low-high interval. MODELLED values are always reported as one."""

    model_config = ConfigDict(extra="forbid")

    low: float
    high: float


class Provenance(BaseModel):
    """Where a value came from, in enough detail to re-run the query."""

    model_config = ConfigDict(extra="forbid")

    source_name: str
    source_url: str
    query: str | None = None
    fetched_at: str
    calculation_method: str | None = None
    assumptions: dict[str, object] | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    llm_model: str | None = None
    prompt_hash: str | None = None


class Quantity(BaseModel):
    """The data covenant, mirrored.

    The validator enforces the same rules as the zod `superRefine` in
    `packages/contracts/src/provenance.ts`: a DERIVED value must state its
    formula, and a MODELLED value must carry assumptions, a confidence and a
    band. Enforcing it on both sides means neither can be the weak link.
    """

    model_config = ConfigDict(extra="forbid")

    value: float
    unit: str | None
    tag: ProvenanceTag
    provenance: Provenance
    band: Band | None = None

    @model_validator(mode="after")
    def enforce_covenant(self) -> Quantity:
        """Rejects a value whose tag promises more than its provenance delivers."""
        if self.tag in ("DERIVED", "MODELLED") and self.provenance.calculation_method is None:
            raise ValueError(f"a {self.tag} value must state how it was calculated")

        if self.tag != "MODELLED":
            return self

        if self.provenance.assumptions is None:
            raise ValueError("a MODELLED value must declare its assumptions")
        if self.provenance.confidence is None:
            raise ValueError("a MODELLED value must carry a confidence in 0..1")
        if self.band is None:
            raise ValueError(
                "a MODELLED value must be reported as a low-high band, never as a point"
            )
        if self.band.low > self.band.high:
            raise ValueError("band low must not exceed band high")

        return self


# ---------------------------------------------------------------------------
# Reliability
# ---------------------------------------------------------------------------

RateOriginLiteral = Literal["FITTED_FROM_HISTORY", "PAPER_BASELINE_FALLBACK"]


class ReliabilityInput(BaseModel):
    """Redundancy counts and rates for one drug.

    Mirrors `reliabilityInputSchema`. Naming follows the paper: `z_*` are
    redundancy counts, `lam_*` failure rates per year, `mu_*` repair rates.
    """

    model_config = ConfigDict(extra="forbid")

    drug_id: str
    z_api: int = Field(ge=1)
    z_plant: int = Field(ge=1)
    z_line: int = Field(ge=1)
    lam_api: float = Field(gt=0)
    mu_api: float = Field(gt=0)
    lam_plant: float = Field(gt=0)
    mu_plant: float = Field(gt=0)
    lam_line: float = Field(gt=0)
    mu_line: float = Field(gt=0)


class RateProvenance(BaseModel):
    """Which rates were fitted and which fell back to the paper's baseline."""

    model_config = ConfigDict(extra="forbid")

    lam_api: RateOriginLiteral
    mu_api: RateOriginLiteral
    lam_plant: RateOriginLiteral
    mu_plant: RateOriginLiteral
    lam_line: RateOriginLiteral
    mu_line: RateOriginLiteral
    event_counts: dict[str, int]


class ReliabilityResponse(BaseModel):
    """Everything the model produces for one drug, each figure in an envelope."""

    model_config = ConfigDict(extra="forbid")

    drug_id: str
    input: ReliabilityInput
    rate_origins: RateProvenance

    r_api: Quantity
    r_pl: Quantity
    r: Quantity
    expected_shortage_s: Quantity
    mean_time_to_failure_years: Quantity
    mean_time_to_recovery_years: Quantity
    fragility_index_0_100: Quantity

    computed_at: str
    assumptions: dict[str, object]
    provenance: Provenance


class RateFitRequest(BaseModel):
    """Ask the service to fit rates from observed history.

    The observation window is supplied by the caller rather than read from a
    clock here, so the same request always produces the same answer — which is
    what makes a stored reliability record reproducible.
    """

    model_config = ConfigDict(extra="forbid")

    drug_id: str
    #: Recalls observed for this drug, from openFDA drug/enforcement.
    recall_count: int = Field(ge=0)
    #: Durations in days of *resolved* shortages, from openFDA drug/shortages.
    #: Only resolved ones have a duration, which biases mu; see the model card.
    resolved_shortage_durations_days: list[float] = Field(default_factory=list)
    observation_window_years: float = Field(gt=0)

    z_api: int = Field(ge=1)
    z_plant: int = Field(ge=1)
    z_line: int = Field(ge=1)


class HealthResponse(BaseModel):
    """Liveness only. It touches nothing, because the brain depends on nothing."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]
    service: Literal["brain"]
    version: str
