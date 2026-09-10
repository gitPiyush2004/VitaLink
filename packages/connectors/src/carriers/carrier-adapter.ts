/**
 * The `CarrierAdapter` interface. Every carrier implements exactly this.
 *
 * The rule this file exists to enforce (spec 6.3): **no carrier-specific logic
 * anywhere outside its own adapter.** The recommendation engine must not contain
 * the string "DSV", "FedEx" or any other carrier name — it sees only
 * `CarrierQuote` objects and a `CarrierId`. A CI grep would be one way to enforce
 * that; a normalised interface is a better one, because it makes the violation
 * hard to write rather than merely detectable.
 *
 * ## The method contract that matters
 *
 * `getQuote` **never throws for a business reason.** A carrier with no
 * credentials, an unserved lane, an auth failure or a timeout all return an
 * `UNAVAILABLE` quote carrying a machine-readable reason. That is not defensive
 * programming, it is the point of Rule 4: an unavailable carrier has to appear in
 * the comparison table with its reason, and an adapter that threw would let the
 * fan-out drop it silently.
 *
 * It may still throw for a *programming* error — a malformed request it cannot
 * even attempt — because that is a bug and should surface as one.
 *
 * ## Capabilities are documented, never guessed
 *
 * `getCapabilities` returns only what the carrier's own documentation states,
 * with the documentation URL in the provenance. Every capability field is a
 * tri-state, and `'unknown'` is used liberally, because `'unknown'` is an honest
 * value and a guessed `true` is not. A hard constraint that requires a capability
 * treats `'unknown'` as a failure — so guessing `true` to be helpful would put a
 * pharmaceutical shipment on a carrier that may not be able to carry it.
 */

import type {
  CarrierCapabilities,
  CarrierId,
  CarrierQuote,
  CarrierService,
  CarrierTier,
  ShipmentRequest,
  ShipmentTrackingEvent,
  UnavailableReason,
} from '@vitalink/contracts';

import type { CachedHttpClient } from '../http/cached-client';

/** What every adapter needs from the outside. Injected, never imported. */
export type CarrierAdapterDeps = {
  /** The shared cached client, so carrier calls are rate-limited and archived. */
  http: CachedHttpClient;
  /** Injected so a quote's `retrieved_at` is reproducible under test. */
  clock: { now(): Date };
  /**
   * Archives a raw carrier payload and returns the reference.
   *
   * A `LIVE_QUOTE` cannot be constructed without one — `carrierQuoteSchema`
   * refuses it — because without the archived payload a real quote cannot be
   * told apart from a fabricated one.
   */
  archiveRawPayload(carrierId: CarrierId, body: string): Promise<string>;
};

export type TransitEstimate = {
  serviceCode: string;
  transitHours: number;
  pickupEstimate: string | null;
  deliveryEstimate: string | null;
};

export type CarrierAdapter = {
  readonly id: CarrierId;
  readonly displayName: string;
  readonly tier: CarrierTier;

  /**
   * Whether credentials are present in this environment.
   *
   * False is a legitimate state, not an error. It produces an `UNAVAILABLE`
   * quote with reason `no_credentials`, and the UI says exactly that.
   */
  isConfigured(): boolean;

  /** Only what the carrier's documentation states. Never inferred. */
  getCapabilities(): Promise<CarrierCapabilities>;

  getServiceOptions(request: ShipmentRequest): Promise<CarrierService[]>;

  /**
   * One quote per eligible service.
   *
   * Never throws for a business reason — returns UNAVAILABLE with a reason.
   */
  getQuote(request: ShipmentRequest): Promise<CarrierQuote[]>;

  getTransitTime(request: ShipmentRequest): Promise<TransitEstimate[]>;

  getTracking(carrierReference: string): Promise<ShipmentTrackingEvent[]>;
};

/**
 * Builds an `UNAVAILABLE` quote.
 *
 * Every adapter uses this rather than hand-rolling the shape, for two reasons.
 * It guarantees the reason is always present — which `carrierQuoteSchema` also
 * enforces, but at parse time rather than construction time. And it guarantees
 * `price` is `null` rather than `0`, because a zero price would sort to the top
 * of a cost comparison and win.
 */
export function unavailableQuote(input: {
  shipmentRequestId: string;
  carrierId: CarrierId;
  displayName: string;
  reason: UnavailableReason;
  detail: string;
  retrievedAt: string;
}): CarrierQuote {
  return {
    id: `quote-${input.carrierId}-${input.shipmentRequestId}-unavailable`,
    shipment_request_id: input.shipmentRequestId,
    provider: input.carrierId,
    provider_display: input.displayName,
    service: 'n/a',
    service_normalised: 'multimodal',
    // Null, never zero. A zero price wins a cost comparison.
    price: null,
    currency: 'INR',
    fx: null,
    transit_hours: null,
    pickup_estimate: null,
    delivery_estimate: null,
    temperature_control: 'unknown',
    temperature_range_supported: [],
    cold_chain: 'unknown',
    gdp_compliant: 'unknown',
    tracking_available: false,
    tracking_granularity: 'none',
    quote_status: 'UNAVAILABLE',
    unavailable_reason: input.reason,
    source: `${input.displayName} (${input.reason})`,
    raw_response_ref: null,
    confidence: 0,
    retrieved_at: input.retrievedAt,
    provenance: {
      source_name: input.displayName,
      source_url: 'https://github.com/gitPiyush2004/VitaLink/blob/main/docs/CARRIER_STATUS.md',
      query: null,
      fetched_at: input.retrievedAt,
      calculation_method: `No quote was obtained: ${input.detail}`,
    },
  };
}

/**
 * Confidence by quote status (spec 6.2).
 *
 * This is the mechanism by which the deepest integration wins **on merit** rather
 * than by a hidden preference. A live quote against real credentials is simply
 * more trustworthy than a sandbox figure or a model estimate, and the cost
 * sub-score is weighted by this — so the explanation can say *why* a carrier won
 * instead of asserting that it did.
 */
export const QUOTE_STATUS_CONFIDENCE = {
  LIVE_QUOTE: 1,
  CONTRACT_RATE: 0.9,
  SANDBOX_QUOTE: 0.5,
  ESTIMATED: 0.3,
  UNAVAILABLE: 0,
} as const;
