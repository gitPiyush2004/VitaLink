"""Series-parallel pharmaceutical supply-chain reliability.

Implements the model published in:

    Tucker, E. L. and Daskin, M. S. (2021).
    "Pharmaceutical Supply Chain Reliability and Effects on Drug Shortages."
    arXiv:2107.09167.

This is the showpiece of the project and the only file where the numbers that
drive every downstream decision are actually produced. Everything in it is a pure
function: no I/O, no clock, no randomness, no framework import. That is what makes
`tests/test_reliability.py` able to reproduce the paper's published configuration
table with no fixtures and no mocks.

The structure being modelled
----------------------------
Three echelons in series, each internally redundant:

    API suppliers          z_api  in parallel
    Plants                 z_plant in parallel, and each plant contains
    Production lines       z_line in parallel

The drug is available when at least one API supplier is up **and** at least one
plant is up, where a plant is up when the plant itself is up and at least one of
its lines is up.

Each component alternates between working and failed as a two-state Markov
process with failure rate ``lam`` and repair rate ``mu``, both per year. Its
long-run unavailability is then ``p = lam / (lam + mu)``, which is equation 1.

A note on what is transcribed and what is derived
-------------------------------------------------
The availability equations below (``p``, ``r_api``, ``r_pl``, ``reliability``,
``expected_shortage``) are the paper's, and are reproduced exactly. Their
correctness is checked against the paper's published configuration table in
``tests/test_reliability.py``, which is CI gate 4.

``mean_uptime_years`` is **derived**, not transcribed. The paper's full text was
not accessible during this build, so rather than guess at its closed form, mean
uptime is computed by the standard frequency-duration method of classical
reliability theory (see Billinton & Allan, *Reliability Evaluation of Power
Systems*): the system's up-to-down transition frequency ``nu`` is computed
directly, and then ``U = r / nu``. The paper's own relation
``D = U / r - U`` (equation 6) then follows as an identity, which
``test_reliability.py`` asserts as a cross-check. This distinction is restated in
``docs/MODEL_CARDS.md`` rather than hidden.
"""

from __future__ import annotations

from dataclasses import dataclass

PERCENT = 100.0


def unavailability(lam: float, mu: float) -> float:
    """Long-run unavailability of one two-state component. Paper eq. 1.

    ``p = lam / (lam + mu)``

    Args:
        lam: failure rate, per year. Must be positive.
        mu: repair rate, per year. Must be positive.

    Returns:
        Fraction of time the component is failed, in [0, 1).

    Raises:
        ValueError: if either rate is not positive. A zero repair rate would mean
            "never repaired", which is not a state this model can represent, and a
            zero failure rate would silently make the component perfect.
    """
    if lam <= 0:
        raise ValueError(f"failure rate must be positive, got {lam}")
    if mu <= 0:
        raise ValueError(f"repair rate must be positive, got {mu}")
    return lam / (lam + mu)


def availability(lam: float, mu: float) -> float:
    """Long-run availability of one component: ``1 - p``."""
    return 1.0 - unavailability(lam, mu)


def r_api(lam_api: float, mu_api: float, z_api: int) -> float:
    """Reliability of the API-supplier echelon. Paper eq. 2.

    ``r_api = 1 - p_api ** z_api``

    The echelon is up when at least one of ``z_api`` independent suppliers is up,
    so it is down only when all of them are down simultaneously.

    Args:
        lam_api: supplier failure rate, per year.
        mu_api: supplier repair rate, per year.
        z_api: number of independent API suppliers. At least 1.

    Returns:
        Probability the API echelon is up, in [0, 1].
    """
    _require_positive_count("z_api", z_api)
    return 1.0 - unavailability(lam_api, mu_api) ** z_api


def r_plant_line(
    lam_plant: float,
    mu_plant: float,
    lam_line: float,
    mu_line: float,
    z_plant: int,
    z_line: int,
) -> float:
    """Reliability of the plant-and-line echelon. Paper eq. 3.

    ``r_pl = 1 - [ p_p + (1 - p_p) * p_l ** z_line ] ** z_plant``

    Read the bracket as "this one plant is unusable", which happens two ways:
    the plant itself is down (``p_p``), or the plant is up but every one of its
    lines is down (``(1 - p_p) * p_l ** z_line``). Those two cases are disjoint,
    which is why they add rather than combine as a union.

    Raising the bracket to ``z_plant`` is the parallel step: the echelon is down
    only when every plant is unusable.

    Args:
        lam_plant: plant failure rate, per year.
        mu_plant: plant repair rate, per year.
        lam_line: production-line failure rate, per year.
        mu_line: production-line repair rate, per year.
        z_plant: plants in parallel. At least 1.
        z_line: lines per plant, in parallel. At least 1.

    Returns:
        Probability the plant-and-line echelon is up, in [0, 1].
    """
    _require_positive_count("z_plant", z_plant)
    _require_positive_count("z_line", z_line)

    p_p = unavailability(lam_plant, mu_plant)
    p_l = unavailability(lam_line, mu_line)

    one_plant_unusable = p_p + (1.0 - p_p) * p_l**z_line
    return 1.0 - one_plant_unusable**z_plant


def reliability(api_reliability: float, plant_line_reliability: float) -> float:
    """Overall supply reliability. Paper eq. 4.

    ``r = r_api * r_pl``

    The two echelons are in series — the drug needs both — and are assumed
    independent, so their availabilities multiply. The independence assumption is
    the model's strongest, and is restated on every value the system reports:
    in reality a shock can hit a supplier and a plant at once, which is precisely
    the correlated failure the cascade engine models separately.
    """
    return api_reliability * plant_line_reliability


def expected_shortage(overall_reliability: float) -> float:
    """Expected fraction of time the drug is in shortage: ``s = 1 - r``."""
    return 1.0 - overall_reliability


def fragility_index(shortage: float) -> float:
    """The headline 0-100 metric. Literally ``100 * s``.

    Deliberately not a rescaled or weighted composite. It is the expected
    percentage of time the drug is unavailable, so a reader can check it against
    the shortage figure directly, and a Fragility Index of 10 means "expect this
    drug to be short about a tenth of the time".
    """
    return PERCENT * shortage


# ---------------------------------------------------------------------------
# Uptime and downtime
# ---------------------------------------------------------------------------


def _parallel_group_failure_frequency(p: float, lam: float, count: int) -> float:
    """Up-to-down transition frequency of ``count`` identical parallel components.

    The group goes down only when the last working component fails, so the
    frequency is P(exactly one up) times that one's failure rate:

        nu = count * (1 - p) * p ** (count - 1) * lam

    This is the frequency-duration method of classical reliability theory, not a
    result from the paper. See the module docstring.
    """
    return count * (1.0 - p) * p ** (count - 1) * lam


def _plant_unit_failure_frequency(
    p_p: float, lam_plant: float, p_l: float, lam_line: float, z_line: int
) -> float:
    """Up-to-down transition frequency of one plant together with its lines.

    A plant unit is up when the plant is up and at least one line is up. It
    therefore goes down two ways, and both are counted:

      * the plant fails, from any up state: ``a_unit * lam_plant``
      * the plant is up and the last working line fails

    Args:
        p_p: plant unavailability.
        lam_plant: plant failure rate, per year.
        p_l: line unavailability.
        lam_line: line failure rate, per year.
        z_line: lines in this plant.

    Returns:
        Transitions per year from "unit up" to "unit down".
    """
    a_unit = (1.0 - p_p) * (1.0 - p_l**z_line)
    plant_fails = a_unit * lam_plant
    last_line_fails = (1.0 - p_p) * _parallel_group_failure_frequency(p_l, lam_line, z_line)
    return plant_fails + last_line_fails


@dataclass(frozen=True)
class ReliabilityRates:
    """The six rates and three redundancy counts the model needs.

    Frozen because the whole point of `domain/` is that nothing mutates its
    arguments: a computation is reproducible from its inputs alone.

    Naming follows the paper so a reader can hold the code and the paper side by
    side: ``z_*`` are redundancy counts, ``lam_*`` are failure rates per year,
    ``mu_*`` are repair rates per year.
    """

    z_api: int
    z_plant: int
    z_line: int
    lam_api: float
    mu_api: float
    lam_plant: float
    mu_plant: float
    lam_line: float
    mu_line: float


@dataclass(frozen=True)
class ReliabilityResult:
    """Everything the model produces for one drug.

    Kept as one immutable value so the API layer can serialise it without
    recomputing anything, and so a stored record is reproducible from the inputs
    that are stored alongside it.
    """

    r_api: float
    r_plant_line: float
    r: float
    expected_shortage_s: float
    fragility_index_0_100: float
    mean_uptime_years: float
    mean_downtime_years: float
    #: Up-to-down transitions per year. Exposed because it is the quantity the
    #: uptime derivation rests on, and hiding it would make that step unauditable.
    failure_frequency_per_year: float


def system_failure_frequency(rates: ReliabilityRates) -> float:
    """Up-to-down transition frequency of the whole series system, per year.

    Two subsystems in series fail as a system when either fails while the other is
    up, so their frequencies combine as:

        nu = r_pl * nu_api + r_api * nu_pl

    Derived, not from the paper. See the module docstring.
    """
    p_api = unavailability(rates.lam_api, rates.mu_api)
    p_p = unavailability(rates.lam_plant, rates.mu_plant)
    p_l = unavailability(rates.lam_line, rates.mu_line)

    api_reliability = r_api(rates.lam_api, rates.mu_api, rates.z_api)
    plant_line_reliability = r_plant_line(
        rates.lam_plant,
        rates.mu_plant,
        rates.lam_line,
        rates.mu_line,
        rates.z_plant,
        rates.z_line,
    )

    nu_api = _parallel_group_failure_frequency(p_api, rates.lam_api, rates.z_api)

    # The plant echelon is a parallel group of plant *units*, each of which is
    # itself a plant-plus-lines composite. Its unavailability is the bracket from
    # eq. 3, and its failure frequency is that of the composite.
    q_unit = p_p + (1.0 - p_p) * p_l**rates.z_line
    nu_unit = _plant_unit_failure_frequency(p_p, rates.lam_plant, p_l, rates.lam_line, rates.z_line)
    # Same "last one standing" logic as a simple parallel group, but with the
    # composite unit's unavailability and its own failure frequency.
    nu_plant_line = rates.z_plant * q_unit ** (rates.z_plant - 1) * nu_unit

    return plant_line_reliability * nu_api + api_reliability * nu_plant_line


def compute(rates: ReliabilityRates) -> ReliabilityResult:
    """Runs the whole model for one drug.

    Args:
        rates: the six rates and three redundancy counts.

    Returns:
        Every figure the system reports, as one immutable value.

    Raises:
        ValueError: if any rate is non-positive or any count is below 1.
    """
    api_reliability = r_api(rates.lam_api, rates.mu_api, rates.z_api)
    plant_line_reliability = r_plant_line(
        rates.lam_plant,
        rates.mu_plant,
        rates.lam_line,
        rates.mu_line,
        rates.z_plant,
        rates.z_line,
    )

    overall = reliability(api_reliability, plant_line_reliability)
    shortage = expected_shortage(overall)

    nu = system_failure_frequency(rates)
    # nu is zero only in the degenerate case of a perfectly reliable system,
    # which the positive-rate guards make unreachable. Guarded anyway, because a
    # division by zero here would surface as a NaN in a Fragility Index.
    uptime = overall / nu if nu > 0 else float("inf")
    # Paper eq. 6: D = U / r - U. Written in the equivalent (1 - r) / nu form,
    # and `test_reliability.py` asserts the two agree.
    downtime = shortage / nu if nu > 0 else 0.0

    return ReliabilityResult(
        r_api=api_reliability,
        r_plant_line=plant_line_reliability,
        r=overall,
        expected_shortage_s=shortage,
        fragility_index_0_100=fragility_index(shortage),
        mean_uptime_years=uptime,
        mean_downtime_years=downtime,
        failure_frequency_per_year=nu,
    )


def rates_from_mtbf(
    z_api: int,
    z_plant: int,
    z_line: int,
    supplier_mtbf_years: float,
    supplier_recovery_years: float,
    plant_mtbf_years: float,
    plant_recovery_years: float,
    line_mtbf_years: float,
    line_recovery_years: float,
) -> ReliabilityRates:
    """Builds rates from mean times, which is how humans and papers state them.

    ``lam = 1 / MTBF`` and ``mu = 1 / mean recovery time``. Both are the standard
    exponential-lifetime conversion, and both are the form the paper's baseline
    table is published in.
    """
    return ReliabilityRates(
        z_api=z_api,
        z_plant=z_plant,
        z_line=z_line,
        lam_api=1.0 / supplier_mtbf_years,
        mu_api=1.0 / supplier_recovery_years,
        lam_plant=1.0 / plant_mtbf_years,
        mu_plant=1.0 / plant_recovery_years,
        lam_line=1.0 / line_mtbf_years,
        mu_line=1.0 / line_recovery_years,
    )


def _require_positive_count(name: str, value: int) -> None:
    if value < 1:
        raise ValueError(f"{name} must be at least 1, got {value}")
