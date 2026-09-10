/**
 * Document <-> domain mapping for the logistics module.
 *
 * Split out of the repository so that file stays about queries. The mapping is
 * explicit in both directions and neither shape leaks into the other: the
 * service works in camelCase domain objects and has never seen a database field
 * name.
 *
 * The stored quote shape is derived from `fromQuote`'s return type rather than
 * declared twice, so a field added to the writer cannot be silently missing from
 * the reader.
 */

import type {
  CarrierQuote,
  Place,
  ShipmentRequest,
  TemperatureRange,
  Urgency,
} from '@vitalink/contracts';

import { WEIGHT_PROFILES, type SubScoreKey } from '@config/weights';
import { fromProvenance, fromQuantity, toProvenance, toQuantity } from '@shared/db/mappers';

import type { GateFailure } from '../domain/eligibility-gate';
import type { Counterfactual, Recommendation } from '../domain/recommend';

import type { LogisticsRecommendationDoc } from './logistics-recommendation.model';
import type { ShipmentRequestDoc } from './shipment-request.model';

/** Narrowed here so the two mappers below do not repeat the lookup chain. */
type GateFailureReason = GateFailure['reason'];

/** A stored shipment request, plus the two fields the record adds. */
export type ShipmentRecord = {
  request: ShipmentRequest;
  prohibitedRanges: TemperatureRange[];
  derivation: string[];
};

export type RecommendationRecord = {
  id: string;
  shipmentRequestId: string;
  recommendedQuoteId: string | null;
  weightProfile: { name: string; weights: Record<string, number>; selectedBecause: string };
  quotes: CarrierQuote[];
  recommendation: Recommendation;
  coverageNote: string;
  narrative: string | null;
  narrativeLlmModel: string | null;
  supersededBy: string | null;
  supersedes: string | null;
  changeLog: string[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Shipment requests
// ---------------------------------------------------------------------------

export function fromPlace(place: Place): ShipmentRequestDoc['origin'] {
  return {
    name: place.name,
    city: place.city,
    country: place.country,
    ...(place.pincode === undefined ? {} : { pincode: place.pincode }),
    point: place.point,
    provenance: fromProvenance(place.provenance),
  };
}

function toPlace(doc: ShipmentRequestDoc['origin']): Place {
  return {
    name: doc.name,
    city: doc.city,
    country: doc.country,
    ...(doc.pincode === undefined ? {} : { pincode: doc.pincode }),
    point: doc.point,
    provenance: toProvenance(doc.provenance),
  };
}

/**
 * Narrows a nullable mapper result.
 *
 * Weight and volume are not optional on a shipment — a carrier prices on them —
 * so a missing value must fail loudly here rather than be written as a document
 * a later reader would see as zero.
 */
export function requireQuantity(
  quantity: ReturnType<typeof fromQuantity>,
  field: string,
): NonNullable<ReturnType<typeof fromQuantity>> {
  if (quantity === null) throw new Error(`a shipment request cannot be stored without ${field}`);
  return quantity;
}

export function toShipmentRecord(doc: ShipmentRequestDoc): ShipmentRecord {
  const weight = toQuantity(doc.weight_kg);
  const volume = toQuantity(doc.volume_m3);
  if (weight === null || volume === null) {
    throw new Error(`stored shipment ${doc._id} is missing its weight or volume`);
  }

  return {
    request: {
      id: doc._id,
      context:
        doc.context === null
          ? null
          : {
              disruption_id: doc.context.disruption_id,
              cascade_id: doc.context.cascade_id,
              drug_id: doc.context.drug_id,
              hub_id_destination: doc.context.hub_id_destination,
              triggered_by: doc.context.triggered_by,
            },
      origin: toPlace(doc.origin),
      destination: toPlace(doc.destination),
      product: {
        drug_id: doc.product.drug_id,
        name: doc.product.name,
        category: doc.product.category,
        nlem_critical: doc.product.nlem_critical,
      },
      weight_kg: weight,
      dimensions_cm: doc.dimensions_cm,
      volume_m3: volume,
      number_of_packages: doc.number_of_packages,
      temperature_requirement: doc.temperature_requirement as TemperatureRange,
      required_delivery_deadline: doc.required_delivery_deadline.toISOString(),
      shipping_mode_preference:
        doc.shipping_mode_preference as ShipmentRequest['shipping_mode_preference'],
      special_handling: doc.special_handling as ShipmentRequest['special_handling'],
      hazardous_material: doc.hazardous_material,
      customs_required: doc.customs_required,
      urgency: doc.urgency,
      budget_ceiling_inr: toQuantity(doc.budget_ceiling_inr),
      created_at: doc.created_at.toISOString(),
      provenance: toProvenance(doc.provenance),
    },
    prohibitedRanges: (doc.prohibited_temperature_ranges ?? []) as TemperatureRange[],
    derivation: doc.derivation,
  };
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export function fromQuote(quote: CarrierQuote): Record<string, unknown> {
  return {
    id: quote.id,
    provider: quote.provider,
    provider_display: quote.provider_display,
    service: quote.service,
    service_normalised: quote.service_normalised,
    price: fromQuantity(quote.price),
    currency: quote.currency,
    fx: quote.fx,
    transit_hours: fromQuantity(quote.transit_hours),
    pickup_estimate: quote.pickup_estimate,
    delivery_estimate: quote.delivery_estimate,
    temperature_control: quote.temperature_control,
    temperature_range_supported: quote.temperature_range_supported,
    cold_chain: quote.cold_chain,
    gdp_compliant: quote.gdp_compliant,
    tracking_available: quote.tracking_available,
    tracking_granularity: quote.tracking_granularity,
    quote_status: quote.quote_status,
    unavailable_reason: quote.unavailable_reason,
    source: quote.source,
    raw_response_ref: quote.raw_response_ref,
    confidence: quote.confidence,
    retrieved_at: quote.retrieved_at,
    provenance: fromProvenance(quote.provenance),
  };
}

/** The stored quote shape, declared so the mapper back is type-checked. */
export type StoredQuote = ReturnType<typeof fromQuote>;

function toQuote(stored: StoredQuote, shipmentRequestId: string): CarrierQuote {
  const provenance = toProvenance(stored.provenance as Parameters<typeof toProvenance>[0]);
  return {
    id: stored.id as string,
    shipment_request_id: shipmentRequestId,
    provider: stored.provider as CarrierQuote['provider'],
    provider_display: stored.provider_display as string,
    service: stored.service as string,
    service_normalised: stored.service_normalised as CarrierQuote['service_normalised'],
    price: toQuantity(stored.price as Parameters<typeof toQuantity>[0]),
    currency: 'INR',
    fx: stored.fx as CarrierQuote['fx'],
    transit_hours: toQuantity(stored.transit_hours as Parameters<typeof toQuantity>[0]),
    pickup_estimate: stored.pickup_estimate as string | null,
    delivery_estimate: stored.delivery_estimate as string | null,
    temperature_control: stored.temperature_control as CarrierQuote['temperature_control'],
    temperature_range_supported: stored.temperature_range_supported as TemperatureRange[],
    cold_chain: stored.cold_chain as CarrierQuote['cold_chain'],
    gdp_compliant: stored.gdp_compliant as CarrierQuote['gdp_compliant'],
    tracking_available: stored.tracking_available as boolean,
    tracking_granularity: stored.tracking_granularity as CarrierQuote['tracking_granularity'],
    quote_status: stored.quote_status as CarrierQuote['quote_status'],
    unavailable_reason: stored.unavailable_reason as CarrierQuote['unavailable_reason'],
    source: stored.source as string,
    raw_response_ref: stored.raw_response_ref as string | null,
    confidence: stored.confidence as number,
    retrieved_at: stored.retrieved_at as string,
    provenance,
  };
}

export function fromCounterfactual(
  counterfactual: Counterfactual | null,
): LogisticsRecommendationDoc['counterfactual'] {
  if (counterfactual === null) return null;
  return {
    runner_up_quote_id: counterfactual.runnerUpQuoteId,
    runner_up_display: counterfactual.runnerUpDisplay,
    runner_up_score: counterfactual.runnerUpScore,
    price_delta_inr: counterfactual.priceDeltaInr,
    transit_delta_hours: counterfactual.transitDeltaHours,
    verdict: counterfactual.verdict,
  };
}

function toCounterfactual(
  doc: LogisticsRecommendationDoc['counterfactual'],
): Counterfactual | null {
  if (doc === null) return null;
  return {
    runnerUpQuoteId: doc.runner_up_quote_id,
    runnerUpDisplay: doc.runner_up_display,
    runnerUpScore: doc.runner_up_score,
    priceDeltaInr: doc.price_delta_inr,
    transitDeltaHours: doc.transit_delta_hours,
    verdict: doc.verdict,
  };
}

type StoredEligibility = {
  quote_id: string;
  carrier_id: string;
  is_eligible: boolean;
  failures: { reason: string; detail: string }[];
};

type StoredScored = {
  quote_id: string;
  carrier_id: string;
  carrier_display: string;
  service: string;
  sub_scores: {
    key: string;
    value: number;
    weight: number;
    contribution: number;
    inputs: Record<string, unknown>;
    neutral_fallback_reason: string | null;
  }[];
  weighted_score: number;
  preference_bonus: number;
  preference_note: string | null;
  final_score: number;
};

/** The stored eligibility rows, back into the domain shape. */
function toEligibility(doc: LogisticsRecommendationDoc): Recommendation['eligibility'] {
  return (doc.eligibility as StoredEligibility[]).map((one) => ({
    quoteId: one.quote_id,
    carrierId: one.carrier_id as CarrierQuote['provider'],
    result: {
      isEligible: one.is_eligible,
      failures: one.failures.map((failure) => ({
        reason: failure.reason as GateFailureReason,
        detail: failure.detail,
      })),
    },
  }));
}

/** The stored scored rows, back into the domain shape. */
function toScored(doc: LogisticsRecommendationDoc): Recommendation['scored'] {
  return (doc.scored as StoredScored[]).map((one) => ({
    quoteId: one.quote_id,
    carrierId: one.carrier_id as CarrierQuote['provider'],
    carrierDisplay: one.carrier_display,
    service: one.service,
    subScores: one.sub_scores.map((subScore) => ({
      key: subScore.key as SubScoreKey,
      value: subScore.value,
      weight: subScore.weight,
      contribution: subScore.contribution,
      inputs: subScore.inputs,
      neutralFallbackReason: subScore.neutral_fallback_reason,
    })),
    weightedScore: one.weighted_score,
    preferenceBonus: one.preference_bonus,
    preferenceNote: one.preference_note,
    finalScore: one.final_score,
  }));
}

export function toRecommendationRecord(doc: LogisticsRecommendationDoc): RecommendationRecord {
  return {
    id: doc._id,
    shipmentRequestId: doc.shipment_request_id,
    recommendedQuoteId: doc.recommended_quote_id,
    weightProfile: {
      name: doc.weight_profile.name,
      weights: doc.weight_profile.weights,
      selectedBecause: doc.weight_profile.selected_because,
    },
    quotes: (doc.quotes as StoredQuote[]).map((quote) => toQuote(quote, doc.shipment_request_id)),
    recommendation: {
      recommendedQuoteId: doc.recommended_quote_id,
      // `rationale` and `selected_because` are two different sentences and an
      // earlier version used the second for both. The profile's rationale says
      // *why this profile weights things the way it does* — a property of the
      // profile, so it comes from the live table. `selected_because` says *why
      // this profile is in force for this shipment*, which is a property of the
      // run and is stored. Conflating them printed the whole shipment derivation
      // where the weighting explanation belonged.
      //
      // The stored weights are a `Record<string, number>`, whose index signature
      // satisfies the profile's per-key record structurally — so a document
      // written by an older version, missing a sub-score key, would type as
      // complete and read as zero. `weightSubScores` handles a missing key by
      // weighting it zero and showing the row, so the failure is visible rather
      // than silent; it is a hole on purpose rather than by oversight.
      profile: {
        name: doc.weight_profile.name as Urgency,
        weights: doc.weight_profile.weights,
        rationale:
          WEIGHT_PROFILES[doc.weight_profile.name as Urgency]?.rationale ??
          doc.weight_profile.selected_because,
      },
      eligibility: toEligibility(doc),
      scored: toScored(doc),
      counterfactual: toCounterfactual(doc.counterfactual),
      coverageNote: doc.coverage_note,
      carriersAttempted: doc.carriers_attempted,
      carriersQuoted: doc.carriers_quoted,
    },
    coverageNote: doc.coverage_note,
    narrative: doc.narrative,
    narrativeLlmModel: doc.narrative_llm_model,
    supersededBy: doc.superseded_by,
    supersedes: doc.supersedes,
    changeLog: doc.change_log,
    createdAt: doc.created_at.toISOString(),
  };
}
