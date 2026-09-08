"""The baseline parametrisation published in arXiv:2107.09167.

These are used in exactly two places:

  1. ``tests/test_reliability.py`` — CI gate 4, which reproduces the paper's
     configuration table from them.
  2. As a **documented fallback** when live openFDA history is too sparse to fit
     a rate. Every figure that falls back is labelled ``PAPER_BASELINE_FALLBACK``
     on that specific rate, on that specific row, in the UI. It is never quietly
     substituted, because a Fragility Index computed from the paper's numbers
     tells you about the paper's supply chain, not about this drug.

Keeping them in their own module rather than inline in the model makes the
distinction between "the equations" and "one particular parametrisation of the
equations" impossible to blur.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.reliability import ReliabilityRates, rates_from_mtbf


@dataclass(frozen=True)
class EchelonBaseline:
    """Mean time between failures and mean recovery time, both in years."""

    mtbf_years: float
    recovery_years: float


#: Supplier echelon: 17.3 years between failures, 1.2 years to recover.
#: The long recovery is the point — requalifying an API supplier is slow.
SUPPLIER = EchelonBaseline(mtbf_years=17.3, recovery_years=1.2)

#: Plant echelon: 28.2 years between failures, 0.8 years to recover.
PLANT = EchelonBaseline(mtbf_years=28.2, recovery_years=0.8)

#: Line echelon: 8.5 years between failures, 0.08 years (about 29 days) to
#: recover. Lines fail far more often than plants but come back quickly, which is
#: why line redundancy contributes much less than supplier redundancy.
LINE = EchelonBaseline(mtbf_years=8.5, recovery_years=0.08)


def baseline_rates(z_api: int, z_plant: int, z_line: int) -> ReliabilityRates:
    """The paper's baseline rates at a given redundancy configuration.

    Args:
        z_api: API suppliers in parallel.
        z_plant: plants in parallel.
        z_line: lines per plant, in parallel.

    Returns:
        Rates ready to pass to ``reliability.compute``.
    """
    return rates_from_mtbf(
        z_api=z_api,
        z_plant=z_plant,
        z_line=z_line,
        supplier_mtbf_years=SUPPLIER.mtbf_years,
        supplier_recovery_years=SUPPLIER.recovery_years,
        plant_mtbf_years=PLANT.mtbf_years,
        plant_recovery_years=PLANT.recovery_years,
        line_mtbf_years=LINE.mtbf_years,
        line_recovery_years=LINE.recovery_years,
    )
