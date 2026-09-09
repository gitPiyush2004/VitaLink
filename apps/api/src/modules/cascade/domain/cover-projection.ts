/**
 * Projecting days of cover, and being honest that inventory is not public.
 *
 * This file is the clearest example in the codebase of the data covenant forcing
 * a design. The spec's stage 4 wants:
 *
 *     cover(t)     = inventory(t0) + incoming_supply(t) - cumulative_demand(t)
 *     stockout_day = min{ t : cover(t) < safety_threshold }
 *
 * **Not one of those three inputs is publicly available.** No API publishes a
 * company's warehouse inventory, its incoming purchase orders, or hospital-level
 * demand. The spec anticipates this and says to model demand from catchment
 * population times condition prevalence times WHO defined daily dose — but that
 * needs OSM hospital catchments and district populations, which the MVP has not
 * ingested, so even the modelled route is unavailable.
 *
 * There were three ways to handle that. Two of them are wrong.
 *
 * **Wrong: invent a plausible inventory.** A curve that looks right and means
 * nothing. This is exactly what Rule 1 exists to forbid.
 *
 * **Wrong: report nothing.** The stockout day is the single most useful output
 * the cascade has, and refusing to compute it at all because one input is an
 * assumption would throw away the whole analysis.
 *
 * **What this file does:** days of cover at t0 is an explicit `SCENARIO` input —
 * the operator's own figure, which they genuinely know and no API does. From
 * there the projection is a real `DERIVED` calculation, because the *effect of
 * the shock* on that cover is what the cascade computed. The result is a band,
 * the assumption is attached to it, and the UI renders a SCENARIO-derived value
 * in the SCENARIO treatment rather than as a fact.
 *
 * All pure. `now` is passed in, so the same inputs always give the same curve.
 */

import { COVER_BAND_RELATIVE_WIDTH, COVER_PROJECTION_DAYS } from '@config/constants';

/** Decimal places used when quoting a figure inside a calculation method. */
const DECIMALS = 4;
/** Decimal places for a day count, which only ever needs two. */
const DAY_DECIMALS = 2;
const PERCENT = 100;

export type CoverInput = {
  /**
   * Days of cover at the moment of the shock. A SCENARIO value: the operator
   * knows it and no public source does.
   */
  assumedCoverDays: number;
  /** The drug's exposure to this shock, 0..1, from the exposure formula. */
  exposure: number;
  /** Cover below this many days counts as heading for stockout. */
  safetyThresholdDays: number;
  /** Horizon in days. Defaults to the configured projection length. */
  horizonDays?: number;
};

export type CoverProjection = {
  /** Day index, 0 to horizon. */
  days: number[];
  /** Remaining days of cover at each day, low and high edge of the band. */
  coverLow: number[];
  coverHigh: number[];
  /** The day cover falls below the safety threshold, as a band. Null if it never does. */
  stockoutDayBand: { low: number; high: number } | null;
  /** Effective cover after the shock's effect, before banding. */
  effectiveCoverDays: number;
  assumptions: Record<string, unknown>;
  calculationMethod: string;
};

/**
 * Projects cover forward under a shock.
 *
 * The model is deliberately the simplest one that is defensible: a shock removes
 * a fraction of inbound supply equal to the drug's exposure, so cover drains
 * faster by that fraction.
 *
 *     effective cover = assumed cover * (1 - exposure)
 *     cover(t)        = effective cover - t
 *
 * A richer model — a supply curve, a demand seasonality term, a lead-time
 * distribution — would be easy to write and impossible to justify, because every
 * one of its extra parameters would be invented. This one has exactly one
 * assumption, and it is named.
 *
 * @throws RangeError if exposure is outside [0, 1] or cover is negative.
 */
export function projectCover(input: CoverInput): CoverProjection {
  if (input.exposure < 0 || input.exposure > 1) {
    throw new RangeError(`exposure must be in [0, 1], got ${String(input.exposure)}`);
  }
  if (input.assumedCoverDays < 0) {
    throw new RangeError(`cover days cannot be negative, got ${String(input.assumedCoverDays)}`);
  }

  const horizon = input.horizonDays ?? COVER_PROJECTION_DAYS;
  const effectiveCoverDays = input.assumedCoverDays * (1 - input.exposure);

  // The band is a sensitivity range on the operator's own cover figure, not a
  // confidence interval, and it is labelled that way wherever it appears.
  const low = effectiveCoverDays * (1 - COVER_BAND_RELATIVE_WIDTH);
  const high = effectiveCoverDays * (1 + COVER_BAND_RELATIVE_WIDTH);

  const days: number[] = [];
  const coverLow: number[] = [];
  const coverHigh: number[] = [];

  for (let day = 0; day <= horizon; day += 1) {
    days.push(day);
    coverLow.push(Math.max(0, low - day));
    coverHigh.push(Math.max(0, high - day));
  }

  return {
    days,
    coverLow,
    coverHigh,
    stockoutDayBand: stockoutBand(low, high, input.safetyThresholdDays, horizon),
    effectiveCoverDays,
    assumptions: {
      assumed_cover_days_is_a_scenario_input: true,
      assumed_cover_days: input.assumedCoverDays,
      inventory_incoming_supply_and_demand_are_not_publicly_available: true,
      shock_removes_supply_proportional_to_exposure: true,
      band_is_a_sensitivity_range_not_a_confidence_interval: true,
      band_relative_width: COVER_BAND_RELATIVE_WIDTH,
      safety_threshold_days: input.safetyThresholdDays,
    },
    calculationMethod:
      'effective cover = assumed cover * (1 - exposure); cover(t) = effective cover - t. ' +
      `Here: ${String(input.assumedCoverDays)} assumed days * (1 - ` +
      `${input.exposure.toFixed(DECIMALS)}) = ${effectiveCoverDays.toFixed(DAY_DECIMALS)} effective days, ` +
      `banded +/-${String(COVER_BAND_RELATIVE_WIDTH * PERCENT)}%. Assumed cover is a SCENARIO ` +
      'input because no public source publishes inventory, incoming supply or demand.',
  };
}

/**
 * The day cover crosses the safety threshold, as a band.
 *
 * The *low* cover edge crosses first, so it gives the earlier day — which is why
 * the band's `low` comes from `low` cover and not the other way round. Getting
 * that backwards would report the optimistic day as the pessimistic one, which is
 * the wrong error to make in a shortage tool.
 */
function stockoutBand(
  lowCover: number,
  highCover: number,
  threshold: number,
  horizon: number,
): { low: number; high: number } | null {
  const earliest = lowCover - threshold;
  const latest = highCover - threshold;

  // Already below the threshold at t0: a stockout is not projected, it is current.
  if (earliest <= 0 && latest <= 0) return { low: 0, high: 0 };
  if (latest > horizon) return null;

  return {
    low: Math.max(0, Math.floor(earliest)),
    high: Math.max(0, Math.floor(latest)),
  };
}

/** Urgency from days of cover (spec 6.5). Pure, so the logistics module reuses it. */
export function coverToUrgency(
  coverDaysLow: number,
  severity: number,
  thresholds: { critical: number; high: number; normal: number },
  escalationSeverity: number,
): 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' {
  if (coverDaysLow <= thresholds.critical) return 'CRITICAL';
  if (coverDaysLow <= thresholds.high || severity >= escalationSeverity) return 'HIGH';
  if (coverDaysLow <= thresholds.normal) return 'NORMAL';
  return 'LOW';
}
