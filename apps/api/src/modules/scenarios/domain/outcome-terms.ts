/**
 * The individual outcome terms, one function each.
 *
 * Separated from the assembly in `enumerate.ts` because each one carries a
 * provenance decision that deserves to be read on its own — which of these is
 * DERIVED from real data, which is MODELLED from an operator assumption, and
 * which cannot be computed at all. That accounting is the file's whole point.
 */

import { derived, modelled, scenario as scenarioValue, type Quantity } from '@vitalink/contracts';

import { CO2_KG_PER_TONNE_KM } from '@config/constants';

import type { CarrierOption, CascadeFacts, DerivationSource, SourcingOption } from './enumerate';

const KG_PER_TONNE = 1000;
/** Decimal places for each unit, so the calculation methods read consistently. */
const DECIMALS = { score: 4, fraction: 2, tonnes: 3, distance: 0 } as const;
/** Sensitivity half-width used to turn a modelled point into a band. */
const BAND_WIDTH = 0.3;
/** A band has two edges, so its midpoint is the sum over two. */
const EDGES = 2;

/**
 * Expected shortage after an intervention.
 *
 * `exposure * (1 - reduction)`. The exposure came from the cascade and is
 * DERIVED from real listing data; the reduction fraction is the operator's
 * assumption about how much of the gap their intervention closes. So the product
 * is MODELLED, not DERIVED — one of its two inputs is an assumption, and a
 * MODELLED value must be reported as a band.
 */
export function expectedShortage(
  option: SourcingOption,
  facts: CascadeFacts,
  source: DerivationSource,
): Quantity {
  const value = facts.exposure * (1 - option.shortageReductionFraction);

  return modelled({
    value,
    unit: 'score_0_1',
    source,
    band: {
      low: Math.max(0, value * (1 - BAND_WIDTH)),
      high: Math.min(1, value * (1 + BAND_WIDTH)),
    },
    assumptions: {
      exposure_is_derived_from_openfda_listings: true,
      exposure: facts.exposure,
      shortage_reduction_is_an_operator_assumption: true,
      shortage_reduction_fraction: option.shortageReductionFraction,
      band_is_a_sensitivity_range_not_a_confidence_interval: true,
      band_relative_width: BAND_WIDTH,
    },
    confidence: 0.5,
    method:
      'expected shortage = cascade exposure * (1 - the fraction this intervention closes). ' +
      `Here: ${facts.exposure.toFixed(DECIMALS.score)} * (1 - ` +
      `${option.shortageReductionFraction.toFixed(DECIMALS.fraction)}) = ` +
      `${value.toFixed(DECIMALS.score)}. MODELLED rather ` +
      "than DERIVED because the reduction fraction is the operator's assumption: no public " +
      'source states how much of a shortfall a given alternate supplier can cover.',
  });
}

/** CO2 from published tonne-km factors. DERIVED where the distance is known. */
export function co2(
  carrier: CarrierOption,
  facts: CascadeFacts,
  source: {
    name: string;
    url: string;
    query: null;
    fetchedAt: string;
  },
): { quantity: Quantity | null; reason: string | null } {
  if (facts.distanceKm === null) {
    return {
      quantity: null,
      reason:
        'CO2 needs a distance, and the lane has no routed or great-circle distance: the ' +
        'physical layer is not ingested, so origin and destination have no coordinates in the ' +
        'MVP. Reported null rather than as a plausible figure.',
    };
  }

  const factor =
    CO2_KG_PER_TONNE_KM[carrier.mode as keyof typeof CO2_KG_PER_TONNE_KM] ??
    CO2_KG_PER_TONNE_KM.road;
  const tonnes = facts.weightKg / KG_PER_TONNE;
  const value = tonnes * facts.distanceKm * factor;

  return {
    reason: null,
    quantity: derived({
      value,
      unit: 'kg',
      source,
      method:
        `${tonnes.toFixed(DECIMALS.tonnes)} tonnes * ` +
        `${facts.distanceKm.toFixed(DECIMALS.distance)} km * ` +
        `${String(factor)} kg CO2 per tonne-km for mode "${carrier.mode}". The emission ` +
        'factors are rough published industry averages, not a certified inventory.',
    }),
  };
}

/**
 * Recovery days: how long until supply is restored under this scenario.
 *
 * Three cases, in preference order, and the third is the one that was wrong.
 *
 * **The reliability model's mean uptime**, when it has one. DERIVED from the
 * Tucker & Daskin availability model via the frequency-duration method.
 *
 * **The intervention's own lead time**, otherwise — labelled SCENARIO, because a
 * lead time is when the intervention starts delivering and not the same
 * quantity as a modelled recovery. Honest substitution, stated on the value.
 *
 * **The shock's duration, for DO_NOTHING.** The first version used the lead
 * time here too, and DO_NOTHING has a lead time of zero — so the baseline was
 * reported as recovering in zero days, which made doing nothing look like
 * instant recovery and flattered it on the one axis where it is worst. Doing
 * nothing recovers when the disruption ends, which is what the cascade's
 * `duration_days` says.
 */
export function recoveryDays(
  option: SourcingOption,
  facts: CascadeFacts,
  source: DerivationSource,
): Quantity {
  if (facts.meanUptimeDays !== null) {
    return derived({
      value: facts.meanUptimeDays,
      unit: 'days',
      source,
      method:
        'Mean uptime from the Tucker & Daskin series-parallel availability model, computed by ' +
        'the Python reliability service via the frequency-duration method.',
    });
  }

  if (option.kind === 'DO_NOTHING') {
    return scenarioValue({
      value: facts.shockDurationDays,
      unit: 'days',
      setBy:
        "the shock's own duration from the cascade request — doing nothing recovers when the " +
        'disruption ends, not immediately. Reporting zero here would make the baseline look ' +
        'like instant recovery on the one axis where it is worst',
      at: source.fetchedAt,
    });
  }

  return scenarioValue({
    value: option.leadTimeDays,
    unit: 'days',
    setBy:
      `operator lead time for "${option.label}" — the reliability model produced no mean ` +
      "uptime for this drug, so this is the intervention's own lead time and not a modelled " +
      'recovery estimate',
    at: source.fetchedAt,
  });
}

/**
 * Days of cover after the intervention.
 *
 * The cascade's own band, scaled by how much of the shortfall the intervention
 * closes. MODELLED because the scaling is an assumption about the intervention:
 * an alternate supplier that closes 60% of a gap does not necessarily extend
 * cover by 60%, and nobody has measured the relationship.
 */
export function coverBand(
  option: SourcingOption,
  facts: CascadeFacts,
  source: DerivationSource,
): Quantity {
  // Cover improves in proportion to the shortage closed, so the intervention's
  // effect on cover is the same assumption as its effect on shortage.
  const multiplier = 1 + option.shortageReductionFraction;

  return modelled({
    value: ((facts.coverDaysLow + facts.coverDaysHigh) / EDGES) * multiplier,
    unit: 'days',
    source,
    band: { low: facts.coverDaysLow * multiplier, high: facts.coverDaysHigh * multiplier },
    assumptions: {
      cover_band_is_from_the_cascade_projection: true,
      intervention_extends_cover_in_proportion_to_shortage_closed: true,
      shortage_reduction_fraction: option.shortageReductionFraction,
    },
    confidence: 0.5,
    method:
      "The cascade's cover band, scaled by (1 + the fraction this intervention closes). The " +
      'scaling is an assumption about the intervention, not a measurement.',
  });
}
