/**
 * The pharmaceutical logistics recommender (spec PART 6, stage 8).
 *
 * Two things in this file carry the whole feature's credibility:
 *
 *   1. `carrierQuoteSchema` refines so that an UNAVAILABLE quote must carry a
 *      reason and an ESTIMATED quote must carry a calculation method and a
 *      confidence. Rule 4 is therefore a parse error, not a convention.
 *   2. `carrierCapabilitiesSchema` uses a tri-state for every claim. `'unknown'`
 *      is honest; a guessed `true` would not be, and a hard constraint that
 *      requires a capability treats `'unknown'` as a failure.
 */

import { z } from 'zod';

import { idSchema, isoDateTimeSchema, placeSchema } from './common';
import {
  capabilityFlagSchema,
  carrierIdSchema,
  carrierTierSchema,
  normalisedServiceSchema,
  quoteStatusSchema,
  specialHandlingSchema,
  temperatureRangeSchema,
  trackingGranularitySchema,
  transportModeSchema,
  unavailableReasonSchema,
  urgencySchema,
  type QuoteStatus,
  type UnavailableReason,
} from './enums';
import { provenanceSchema, quantitySchema, type Quantity } from './provenance';

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export const carrierCapabilitiesSchema = z.object({
  modes: z.array(transportModeSchema),
  temperature_ranges: z.array(temperatureRangeSchema),
  cold_chain_certified: capabilityFlagSchema,
  /** Good Distribution Practice. Only `true` if the carrier's own docs say so. */
  gdp_compliant: capabilityFlagSchema,
  dangerous_goods: capabilityFlagSchema,
  customs_brokerage: capabilityFlagSchema,
  temperature_monitoring: capabilityFlagSchema,
  /** 'domestic_in' | 'international' | an explicit list of ISO country pairs. */
  serves_lanes: z.union([
    z.literal('domestic_in'),
    z.literal('international'),
    z.array(z.string()),
  ]),
  tracking_granularity: trackingGranularitySchema,
  /** The documentation page each claim above came from. Never inferred. */
  provenance: provenanceSchema,
});
export type CarrierCapabilities = z.infer<typeof carrierCapabilitiesSchema>;

export const carrierSchema = z.object({
  id: carrierIdSchema,
  display_name: z.string(),
  tier: carrierTierSchema,
  /** Whether credentials are present in this environment. Drives no_credentials. */
  is_configured: z.boolean(),
  /** Honest note for the UI, e.g. why a Tier C carrier can only return sandbox. */
  integration_note: z.string(),
  capabilities: carrierCapabilitiesSchema,
});
export type Carrier = z.infer<typeof carrierSchema>;

export const carrierServiceSchema = z.object({
  carrier_id: carrierIdSchema,
  /** The carrier's own service name, verbatim. Never rewritten. */
  service_code: z.string(),
  service_name: z.string(),
  service_normalised: normalisedServiceSchema,
  provenance: provenanceSchema,
});
export type CarrierService = z.infer<typeof carrierServiceSchema>;

// ---------------------------------------------------------------------------
// ShipmentRequest
// ---------------------------------------------------------------------------

export const shipmentContextSchema = z.object({
  disruption_id: idSchema.nullable(),
  cascade_id: idSchema.nullable(),
  drug_id: idSchema,
  hub_id_destination: idSchema,
  triggered_by: z.enum(['cascade', 'manual', 'scenario']),
});
export type ShipmentContext = z.infer<typeof shipmentContextSchema>;

export const packageDimensionsSchema = z.object({
  l: z.number().positive(),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type PackageDimensions = z.infer<typeof packageDimensionsSchema>;

export const shipmentRequestSchema = z.object({
  id: idSchema,

  /**
   * Required when auto-generated. This field is the reason the recommender is
   * part of Vitalink rather than a courier comparison page: a shipment always
   * knows which disruption it exists to answer.
   */
  context: shipmentContextSchema.nullable(),

  origin: placeSchema,
  destination: placeSchema,

  product: z.object({
    drug_id: idSchema,
    name: z.string(),
    category: z.string(),
    nlem_critical: z.boolean(),
  }),

  weight_kg: quantitySchema,
  dimensions_cm: z.array(packageDimensionsSchema),
  volume_m3: quantitySchema,
  number_of_packages: z.number().int().min(1),

  /** Derived from the drug's real label, not asked of the user. */
  temperature_requirement: temperatureRangeSchema,
  /** Absolute ISO instant, never a relative "72h" — the gate compares instants. */
  required_delivery_deadline: isoDateTimeSchema,
  shipping_mode_preference: z.union([z.array(transportModeSchema), z.literal('any')]),
  special_handling: z.array(specialHandlingSchema),
  hazardous_material: z.boolean(),
  customs_required: z.boolean(),
  urgency: urgencySchema,

  budget_ceiling_inr: quantitySchema.nullable(),
  created_at: isoDateTimeSchema,
  provenance: provenanceSchema,
});
export type ShipmentRequest = z.infer<typeof shipmentRequestSchema>;

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

const carrierQuoteShape = {
  id: idSchema,
  shipment_request_id: idSchema,
  provider: carrierIdSchema,
  provider_display: z.string(),
  /** The carrier's service name, verbatim. */
  service: z.string(),
  service_normalised: normalisedServiceSchema,

  /** Null when the quote is UNAVAILABLE. A missing price is never a zero. */
  price: quantitySchema.nullable(),
  currency: z.literal('INR'),
  fx: z
    .object({
      rate: z.number().positive(),
      base: z.string(),
      source: z.string(),
      fetched_at: isoDateTimeSchema,
    })
    .nullable(),

  transit_hours: quantitySchema.nullable(),
  pickup_estimate: isoDateTimeSchema.nullable(),
  delivery_estimate: isoDateTimeSchema.nullable(),

  temperature_control: capabilityFlagSchema,
  temperature_range_supported: z.array(temperatureRangeSchema),
  cold_chain: capabilityFlagSchema,
  gdp_compliant: capabilityFlagSchema,
  tracking_available: z.boolean(),
  tracking_granularity: trackingGranularitySchema,

  quote_status: quoteStatusSchema,
  unavailable_reason: unavailableReasonSchema.nullable(),
  /** e.g. "DSV Quote API generic-quote-demo-v1", "internal rate model v1". */
  source: z.string(),
  /** Pointer to the archived raw payload. This is how a LIVE_QUOTE is provable. */
  raw_response_ref: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  retrieved_at: isoDateTimeSchema,
  provenance: provenanceSchema,
};

/** The subset of a quote each status rule needs. Keeps the checks readable. */
type QuoteForRefinement = {
  quote_status: QuoteStatus;
  unavailable_reason: UnavailableReason | null;
  price: Quantity | null;
  raw_response_ref: string | null;
};

function reject(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

/** An UNAVAILABLE carrier is shown with a reason and no number. Ever. */
function checkUnavailable(quote: QuoteForRefinement, ctx: z.RefinementCtx): void {
  if (quote.unavailable_reason === null) {
    reject(
      ctx,
      ['unavailable_reason'],
      'An UNAVAILABLE quote must say why. It is never silently dropped.',
    );
  }
  if (quote.price !== null) {
    reject(ctx, ['price'], 'An UNAVAILABLE quote must not carry a price.');
  }
}

/** A rate-model output is MODELLED and publishes its confidence. */
function checkEstimated(price: Quantity, ctx: z.RefinementCtx): void {
  if (price.tag !== 'MODELLED') {
    reject(
      ctx,
      ['price', 'tag'],
      'An ESTIMATED price is a model output and must be tagged MODELLED.',
    );
  }
  if (price.provenance.confidence === undefined) {
    reject(
      ctx,
      ['price', 'provenance', 'confidence'],
      'An ESTIMATED price must publish its confidence.',
    );
  }
}

/**
 * The check that makes a fabricated live quote impossible.
 *
 * A LIVE_QUOTE must point at the archived raw carrier payload. Without one there
 * is no way to tell a real quote from an invented one, so the schema refuses it.
 * CI gate 5 asserts the same property statically and independently.
 */
function checkLive(quote: QuoteForRefinement, price: Quantity, ctx: z.RefinementCtx): void {
  if (price.tag !== 'REAL') {
    reject(ctx, ['price', 'tag'], 'A LIVE_QUOTE price is tagged REAL or it is not a live quote.');
  }
  if (quote.raw_response_ref === null) {
    reject(
      ctx,
      ['raw_response_ref'],
      'A LIVE_QUOTE must reference the archived carrier payload that proves it. ' +
        'Without one it cannot be distinguished from a fabrication.',
    );
  }
}

/** Rule 4, enforced at parse time rather than by convention. */
function refineQuoteStatus(quote: QuoteForRefinement, ctx: z.RefinementCtx): void {
  if (quote.quote_status === 'UNAVAILABLE') {
    checkUnavailable(quote, ctx);
    return;
  }

  const { price } = quote;
  if (price === null) {
    reject(ctx, ['price'], `A ${quote.quote_status} quote must carry a price.`);
    return;
  }

  switch (quote.quote_status) {
    case 'ESTIMATED':
      checkEstimated(price, ctx);
      return;
    case 'SANDBOX_QUOTE':
      if (price.tag !== 'SCENARIO') {
        reject(
          ctx,
          ['price', 'tag'],
          'A SANDBOX_QUOTE has a real API shape but not real commercial pricing, so its ' +
            'price is tagged SCENARIO.',
        );
      }
      return;
    case 'LIVE_QUOTE':
      checkLive(quote, price, ctx);
      return;
    case 'CONTRACT_RATE':
      if (price.tag !== 'REAL') {
        reject(
          ctx,
          ['price', 'tag'],
          'A CONTRACT_RATE comes from an uploaded rate card, so it is REAL.',
        );
      }
      return;
    default:
      return;
  }
}

export const carrierQuoteSchema = z.object(carrierQuoteShape).superRefine(refineQuoteStatus);
export type CarrierQuote = z.infer<typeof carrierQuoteSchema>;
