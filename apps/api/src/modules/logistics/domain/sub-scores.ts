/**
 * The six sub-scores (spec 6.6).
 *
 * Each is 0-100, computed deterministically, and **stored with its inputs** so
 * the UI can show the arithmetic rather than the result. Nothing here is produced
 * or adjusted by a language model (Rule 2); the model's only job in this feature
 * is to phrase prose around numbers these functions have already produced.
 *
 * Two conventions worth stating.
 *
 * **Normalisation is min-max against the eligible set, not against an absolute
 * scale.** A cost sub-score answers "how does this price compare with the other
 * options I actually have", which is the question being asked. An absolute scale
 * would need a notion of "a reasonable price for a shipment", which nobody has.
 *
 * **A missing input contributes at a documented neutral value and says so.**
 * When a carrier publishes no on-time figure and we have no tracking history of
 * our own, the reliability sub-score is `NEUTRAL_SUB_SCORE` with
 * `neutral_fallback_reason` set — visible on the row. Scoring it zero would
 * punish a carrier for our ignorance; scoring it 100 would reward them for it.
 */

import type { CarrierQuote, TemperatureRange } from '@vitalink/contracts';

import { NEUTRAL_SUB_SCORE } from '@config/constants';
import type { SubScoreKey } from '@config/weights';

const MAX_SCORE = 100;
const MS_PER_HOUR = 3_600_000;

export type SubScore = {
  key: SubScoreKey;
  value: number;
  /** The inputs that produced it, so the row is reproducible from the record. */
  inputs: Record<string, unknown>;
  /** Set when the score fell back to the documented neutral value. */
  neutralFallbackReason: string | null;
};

/** Min-max normalisation, inverted so lower input scores higher. */
function normaliseInverted(value: number, min: number, max: number): number {
  // Every option costs the same: they are all equally good on this axis, and
  // spreading them across 0-100 would invent a difference that is not there.
  if (max === min) return MAX_SCORE;
  return ((max - value) / (max - min)) * MAX_SCORE;
}

/**
 * Cost, weighted by quote confidence.
 *
 * The confidence weighting is spec 6.2's legitimate mechanism: a `LIVE_QUOTE`
 * against real credentials is more trustworthy than a sandbox figure, so a
 * cheap-but-unverified price does not beat a slightly dearer proven one purely on
 * the number. That is how the deepest integration wins on merit, and the
 * explanation can point at this term instead of asserting a preference.
 */
export function costSubScore(quote: CarrierQuote, eligiblePrices: number[]): SubScore {
  const price = quote.price;

  if (price === null || eligiblePrices.length === 0) {
    return {
      key: 'cost',
      value: NEUTRAL_SUB_SCORE,
      inputs: { price: null },
      neutralFallbackReason: 'No price was obtained, so cost could not be compared.',
    };
  }

  const min = Math.min(...eligiblePrices);
  const max = Math.max(...eligiblePrices);
  const raw = normaliseInverted(price.value, min, max);
  // Confidence pulls an unverified price towards neutral rather than scaling it
  // towards zero: a sandbox quote is uncertain, not bad.
  const value = raw * quote.confidence + NEUTRAL_SUB_SCORE * (1 - quote.confidence);

  return {
    key: 'cost',
    value,
    inputs: {
      price_inr: price.value,
      cheapest_eligible_inr: min,
      dearest_eligible_inr: max,
      quote_status: quote.quote_status,
      quote_confidence: quote.confidence,
      raw_before_confidence: raw,
      formula:
        'min-max inverted against the eligible set, then blended towards neutral by ' +
        '(1 - quote confidence), so an unverified price cannot win on the number alone',
    },
    neutralFallbackReason: null,
  };
}

/**
 * Transit, as normalised slack against the deadline.
 *
 * `(deadline - arrival) / (deadline - now)`, clipped. Slack rather than raw
 * transit hours, because what matters is not how fast the service is but how much
 * margin it leaves — and the same 48-hour service is comfortable against a
 * two-week deadline and marginal against a three-day one.
 */
export function transitSubScore(quote: CarrierQuote, deadlineIso: string, now: Date): SubScore {
  const deadlineMs = Date.parse(deadlineIso);
  const nowMs = now.getTime();
  const window = deadlineMs - nowMs;

  const arrivalMs =
    quote.delivery_estimate !== null
      ? Date.parse(quote.delivery_estimate)
      : quote.transit_hours === null
        ? null
        : nowMs + quote.transit_hours.value * MS_PER_HOUR;

  if (arrivalMs === null || window <= 0) {
    return {
      key: 'transit',
      value: NEUTRAL_SUB_SCORE,
      inputs: { arrival: null, deadline: deadlineIso },
      neutralFallbackReason:
        arrivalMs === null
          ? 'The carrier gave neither a delivery estimate nor a transit time.'
          : 'The deadline is already in the past, so there is no slack window to normalise against.',
    };
  }

  const slack = (deadlineMs - arrivalMs) / window;
  const value = Math.min(MAX_SCORE, Math.max(0, slack * MAX_SCORE));

  return {
    key: 'transit',
    value,
    inputs: {
      arrival: new Date(arrivalMs).toISOString(),
      deadline: deadlineIso,
      slack_hours: (deadlineMs - arrivalMs) / MS_PER_HOUR,
      window_hours: window / MS_PER_HOUR,
      formula: '(deadline - arrival) / (deadline - now), clipped to [0, 1]',
    },
    neutralFallbackReason: null,
  };
}

/**
 * Reliability: on-time performance.
 *
 * None of the six carriers publishes a machine-readable on-time figure, and
 * Vitalink has no accumulated tracking history yet (that is Phase 13). So this
 * sub-score is **always** the documented neutral value today, and the reason is
 * on every row rather than in a footnote.
 *
 * The alternative — inventing a plausible on-time percentage per carrier — would
 * be a fabricated number driving a real decision, which is precisely what the
 * data covenant exists to prevent.
 *
 * It takes no quote, deliberately: there is nothing in a carrier's quote payload
 * that speaks to its punctuality. A parameter that was accepted and ignored would
 * imply the quote had been consulted.
 */
export function reliabilitySubScore(
  observed: { onTimeRate: number; shipments: number } | null,
): SubScore {
  if (observed === null) {
    return {
      key: 'reliability',
      value: NEUTRAL_SUB_SCORE,
      inputs: { published_on_time_rate: null, observed_shipments: 0 },
      neutralFallbackReason:
        'This carrier publishes no machine-readable on-time figure and Vitalink has no ' +
        'tracking history for it yet, so reliability contributes at the documented neutral ' +
        'value. Inventing a percentage would be a fabricated number driving a real decision.',
    };
  }

  return {
    key: 'reliability',
    value: observed.onTimeRate * MAX_SCORE,
    inputs: {
      observed_on_time_rate: observed.onTimeRate,
      observed_shipments: observed.shipments,
      source: 'Vitalink tracking history',
      formula: 'observed on-time rate * 100',
    },
    neutralFallbackReason: null,
  };
}

/**
 * Cold chain, as capability *depth* rather than a yes/no.
 *
 * Active reefer with monitoring and GDP is genuinely better than passive
 * packaging alone, and a boolean would rank them equal. The tiers are additive
 * and each is worth stating.
 */
export function coldChainSubScore(quote: CarrierQuote, required: TemperatureRange): SubScore {
  const needsColdChain = required === '2-8C' || required === 'frozen' || required === 'cryogenic';

  if (!needsColdChain) {
    return {
      key: 'cold_chain',
      value: MAX_SCORE,
      inputs: { required, reason: 'ambient or room-temperature shipment' },
      neutralFallbackReason: null,
    };
  }

  const TIER = { supportsRange: 40, coldChain: 25, monitoring: 20, gdp: 15 } as const;
  let value = 0;
  const achieved: string[] = [];

  if (quote.temperature_range_supported.includes(required)) {
    value += TIER.supportsRange;
    achieved.push(`supports ${required}`);
  }
  if (quote.cold_chain === true) {
    value += TIER.coldChain;
    achieved.push('cold-chain certified');
  }
  if (quote.temperature_control === true) {
    value += TIER.monitoring;
    achieved.push('temperature monitoring');
  }
  if (quote.gdp_compliant === true) {
    value += TIER.gdp;
    achieved.push('GDP compliant');
  }

  return {
    key: 'cold_chain',
    value,
    inputs: {
      required,
      achieved,
      tiers: TIER,
      formula:
        'additive capability depth: supporting the range is worth most, then certification, ' +
        'then monitoring, then GDP. A boolean would rank passive packaging equal to an ' +
        'active reefer with monitoring.',
    },
    neutralFallbackReason: null,
  };
}

/**
 * Risk: exposure of this carrier's own route to the *same* shock.
 *
 * This is the sub-score only Vitalink can compute, and spec 6.7 is emphatic that
 * it must be built from the existing graph and cascade rather than from a second
 * risk engine. It is `1 - (exposure of the lane's nodes to this shock)`.
 *
 * In the MVP the lane's nodes are not known — the physical layer is not ingested,
 * so a quote does not tell us which hubs it transits. The score therefore falls
 * back to neutral with that stated, rather than to a number that looks computed.
 */
export function riskSubScore(
  laneExposure: { exposure: number; sharedNodes: string[] } | null,
): SubScore {
  if (laneExposure === null) {
    return {
      key: 'risk',
      value: NEUTRAL_SUB_SCORE,
      inputs: { lane_nodes_known: false },
      neutralFallbackReason:
        "The carrier's route cannot be mapped onto graph nodes yet: the physical layer " +
        '(hubs, lanes, geocoded facilities) is not ingested, so there is no way to tell ' +
        'whether this lane transits the shocked region. Reported neutral rather than as a ' +
        'computed figure.',
    };
  }

  return {
    key: 'risk',
    value: (1 - laneExposure.exposure) * MAX_SCORE,
    inputs: {
      lane_exposure: laneExposure.exposure,
      shared_nodes_with_cascade: laneExposure.sharedNodes,
      formula: '(1 - exposure of this lane to the same shock) * 100, from the cascade path',
    },
    neutralFallbackReason: null,
  };
}

/** Service: tracking granularity, customs brokerage, documented pharma division. */
export function serviceSubScore(quote: CarrierQuote): SubScore {
  const GRANULARITY = { none: 0, milestone: 30, event: 60, realtime: 100 } as const;
  const value = GRANULARITY[quote.tracking_granularity];

  return {
    key: 'service',
    value,
    inputs: {
      tracking_granularity: quote.tracking_granularity,
      tracking_available: quote.tracking_available,
      formula: 'tracking granularity mapped onto 0-100',
    },
    neutralFallbackReason: null,
  };
}
