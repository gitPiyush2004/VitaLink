/**
 * DSV — the reference adapter.
 *
 * Built first and completely, because it is the only one of the six carriers in
 * spec 6.1 with a documented, self-serve, OAuth-2.0 quotation API *and* a
 * documented demo environment. Every other adapter copies this shape.
 *
 * ## What was verified, and what was not
 *
 * The OAuth flow below is **transcribed from `developer.dsv.com/oauth-guide`,
 * read on 8 September 2026**, not guessed:
 *
 *   demo token endpoint   https://api.dsv.com/my-demo/oauth/v1/token
 *   production            https://api.dsv.com/my/oauth/v1/token
 *   grant_type            client_credentials
 *   client_id             myDSV username
 *   client_secret         myDSV password
 *   required header       DSV-Subscription-Key
 *   body encoding         application/x-www-form-urlencoded
 *   access token life     10 minutes
 *   refresh token life    30 days
 *   business API auth     Authorization: Bearer {access_token}
 *
 * The **ten-minute access token is the detail that shapes this adapter**. A quote
 * fan-out cannot assume a cached token is still valid, so the token is refreshed
 * proactively against a safety margin rather than reactively on a 401 — which
 * would cost a wasted round trip on every expiry boundary.
 *
 * **The Quote API's field-level request and response schema is not publicly
 * readable.** It sits behind the portal's authenticated product pages, and
 * subscribing to a product requires a myDSV login. That is an honest correction
 * to the spec's 6.1 table, which implies the whole API is self-serve documented;
 * only the authentication is. See `docs/CARRIER_STATUS.md`.
 *
 * The consequence is marked in the code rather than hidden: the request and
 * response mapping below carries `UNVERIFIED_SCHEMA` markers, is written from the
 * documented product description, and has **never been run against a real
 * response**. When credentials exist, the first live call will either confirm it
 * or produce a `malformed_response` from the schema validation — which is the
 * correct failure, and far better than silently mapping the wrong field.
 *
 * With no credentials configured the adapter returns `UNAVAILABLE` with reason
 * `no_credentials`. It does not fall back to an estimate.
 */

import type {
  CarrierCapabilities,
  CarrierQuote,
  CarrierService,
  Quantity,
  ShipmentRequest,
  ShipmentTrackingEvent,
  UnavailableReason,
} from '@vitalink/contracts';

import {
  QUOTE_STATUS_CONFIDENCE,
  unavailableQuote,
  type CarrierAdapter,
  type CarrierAdapterDeps,
  type TransitEstimate,
} from './carrier-adapter';
import {
  CARRIER_MAX_ATTEMPTS,
  CARRIER_TIMEOUT_MS,
  DSV_CAPABILITIES,
  MS_PER_SECOND,
  QUOTE_ENDPOINTS,
  TOKEN_ENDPOINTS,
  TOKEN_SAFETY_MARGIN_MS,
  describeError,
  describeShipment,
  mapErrorToReason,
  normaliseMode,
  quoteCapabilityFields,
  quoteResponseSchema,
  toFx,
  toTransitHours,
  tokenResponseSchema,
  type CachedToken,
  type DsvProvenance,
  type DsvQuote,
} from './dsv.contracts';

export type DsvConfig = {
  environment: 'demo' | 'production';
  clientId: string;
  clientSecret: string;
  subscriptionKey: string;
};

export class DsvAdapter implements CarrierAdapter {
  readonly id = 'dsv' as const;
  readonly displayName = 'DSV';
  /** Tier A: the only carrier with a documented self-serve quotation API. */
  readonly tier = 'A' as const;

  private token: CachedToken | null = null;

  constructor(
    private readonly deps: CarrierAdapterDeps,
    private readonly config: DsvConfig,
  ) {}

  isConfigured(): boolean {
    return (
      this.config.clientId.length > 0 &&
      this.config.clientSecret.length > 0 &&
      this.config.subscriptionKey.length > 0
    );
  }

  getCapabilities(): Promise<CarrierCapabilities> {
    return Promise.resolve(DSV_CAPABILITIES);
  }

  getServiceOptions(_request: ShipmentRequest): Promise<CarrierService[]> {
    // Service options come back on the quote response rather than from a separate
    // catalogue call, so this returns nothing rather than inventing a service list.
    return Promise.resolve([]);
  }

  /**
   * Quotes for one shipment.
   *
   * Returns `UNAVAILABLE` rather than throwing for every business reason, so the
   * comparison table can show DSV with its reason instead of dropping it.
   */
  async getQuote(request: ShipmentRequest): Promise<CarrierQuote[]> {
    const retrievedAt = this.deps.clock.now().toISOString();

    if (!this.isConfigured()) {
      return [
        this.unavailable(
          request,
          'no_credentials',
          'DSV_CLIENT_ID, DSV_CLIENT_SECRET and DSV_SUBSCRIPTION_KEY are not all set. ' +
            'Register at developer.dsv.com and subscribe to the Quote product.',
          retrievedAt,
        ),
      ];
    }

    try {
      const response = await this.fetchQuotes(request);
      const quotes = response.data.quotes ?? [];
      if (quotes.length === 0) {
        return [
          this.unavailable(
            request,
            'route_not_served',
            'DSV returned no quotes for this origin, destination and service combination.',
            retrievedAt,
          ),
        ];
      }

      // The raw payload is archived BEFORE any quote is constructed, because a
      // LIVE_QUOTE cannot exist without a reference to it.
      const rawRef = await this.deps.archiveRawPayload('dsv', response.rawBody);

      return quotes.map((quote, index) =>
        this.toQuote(request, quote, { rawRef, retrievedAt, index }),
      );
    } catch (error) {
      return [
        this.unavailable(request, mapErrorToReason(error), describeError(error), retrievedAt),
      ];
    }
  }

  /**
   * The quote call itself, with the token attached.
   *
   * Not cached beyond the request: a freight quote is time-sensitive, and a
   * stale one presented as live would violate Rule 4.
   */
  private async fetchQuotes(request: ShipmentRequest) {
    const token = await this.accessToken();

    return this.deps.http.getJson(
      {
        sourceId: 'dsv_quote',
        displayName: 'DSV Quote API',
        url: this.quoteUrl(request),
        queryDescription: describeShipment(request),
        // DSV publishes no public rate limit for the Quote API. One second is a
        // courtesy interval for a fan-out of a handful of shipments.
        minIntervalMs: MS_PER_SECOND,
        cacheTtlSeconds: 0,
        headers: {
          authorization: `Bearer ${token}`,
          'DSV-Subscription-Key': this.config.subscriptionKey,
        },
        timeoutMs: CARRIER_TIMEOUT_MS,
        maxAttempts: CARRIER_MAX_ATTEMPTS,
      },
      quoteResponseSchema,
    );
  }

  async getTransitTime(request: ShipmentRequest): Promise<TransitEstimate[]> {
    // DSV returns transit time on the quote, so there is no separate call. Reusing
    // the quote avoids a second charged request for data already in hand.
    const quotes = await this.getQuote(request);

    return quotes
      .filter((quote) => quote.transit_hours !== null)
      .map((quote) => ({
        serviceCode: quote.service,
        transitHours: quote.transit_hours?.value ?? 0,
        pickupEstimate: quote.pickup_estimate,
        deliveryEstimate: quote.delivery_estimate,
      }));
  }

  getTracking(_carrierReference: string): Promise<ShipmentTrackingEvent[]> {
    // Phase 13. The schema and the event flow are designed (spec 6.14); the
    // polling is not built, and returning an empty list is honest about that.
    return Promise.resolve([]);
  }

  /**
   * A valid access token, refreshed proactively.
   *
   * The margin matters because DSV's token lives ten minutes: a fan-out that
   * begins with eight minutes elapsed would otherwise fail partway through.
   */
  private async accessToken(): Promise<string> {
    const nowMs = this.deps.clock.now().getTime();

    if (this.token !== null && this.token.expiresAtMs - TOKEN_SAFETY_MARGIN_MS > nowMs) {
      return this.token.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    // The token call goes through the cached client for its rate limiting and
    // backoff, but with a zero TTL: caching a bearer token in Redis would put a
    // live credential in a shared store for no benefit.
    const response = await this.deps.http.postForm(
      {
        sourceId: 'dsv_oauth',
        displayName: 'DSV Access Token API',
        url: TOKEN_ENDPOINTS[this.config.environment],
        queryDescription: 'grant_type=client_credentials',
        minIntervalMs: MS_PER_SECOND,
        cacheTtlSeconds: 0,
        headers: { 'DSV-Subscription-Key': this.config.subscriptionKey },
        timeoutMs: CARRIER_TIMEOUT_MS,
        maxAttempts: CARRIER_MAX_ATTEMPTS,
      },
      body,
      tokenResponseSchema,
    );

    const DEFAULT_TOKEN_LIFE_SECONDS = 600;
    const lifeSeconds = response.data.expires_in ?? DEFAULT_TOKEN_LIFE_SECONDS;

    this.token = {
      accessToken: response.data.access_token,
      expiresAtMs: nowMs + lifeSeconds * MS_PER_SECOND,
    };

    return this.token.accessToken;
  }

  private quoteUrl(request: ShipmentRequest): string {
    // UNVERIFIED_SCHEMA: the query-parameter form is inferred. When credentials
    // exist, a 400 here is the expected first failure and tells us the real shape.
    const params = new URLSearchParams({
      originCountry: request.origin.country,
      originCity: request.origin.city,
      destinationCountry: request.destination.country,
      destinationCity: request.destination.city,
      weightKg: String(request.weight_kg.value),
      volumeM3: String(request.volume_m3.value),
      packages: String(request.number_of_packages),
    });

    return `${QUOTE_ENDPOINTS[this.config.environment]}?${params.toString()}`;
  }

  /**
   * Maps one DSV quote into the internal model.
   *
   * The status decision is the important line. A demo-environment response has a
   * real API shape but **not real commercial pricing**, so it is a
   * `SANDBOX_QUOTE` whose price is tagged `SCENARIO` — never `LIVE_QUOTE`, and
   * `carrierQuoteSchema` would refuse it if it tried.
   */
  private toQuote(
    request: ShipmentRequest,
    quote: DsvQuote,
    meta: { rawRef: string; retrievedAt: string; index: number },
  ): CarrierQuote {
    const amount = quote.totalPrice?.amount ?? null;
    if (amount === null) {
      return this.unavailable(
        request,
        'upstream_error',
        'DSV returned a quote with no price amount. UNVERIFIED_SCHEMA: the price field name ' +
          'may differ from what this adapter expects.',
        meta.retrievedAt,
      );
    }

    const isDemo = this.config.environment === 'demo';
    const status = isDemo ? ('SANDBOX_QUOTE' as const) : ('LIVE_QUOTE' as const);
    const provenance = {
      source_name: `DSV Quote API (${this.config.environment})`,
      source_url: QUOTE_ENDPOINTS[this.config.environment],
      query: describeShipment(request),
      fetched_at: meta.retrievedAt,
    };

    return {
      id: `quote-dsv-${request.id}-${String(meta.index)}`,
      shipment_request_id: request.id,
      provider: 'dsv',
      provider_display: this.displayName,
      // Verbatim from DSV, never rewritten.
      service: quote.serviceName ?? quote.serviceCode ?? 'DSV service',
      service_normalised: normaliseMode(quote.transportMode),
      price: this.toPrice(amount, isDemo, provenance),
      currency: 'INR',
      fx: toFx(quote.totalPrice?.currency, meta.retrievedAt),
      transit_hours: toTransitHours(quote, provenance),
      pickup_estimate: quote.pickupDate ?? null,
      delivery_estimate: quote.deliveryDate ?? null,
      // Copied from the documented capability table rather than read off the
      // quote payload: a quote that omits GDP has not told us DSV is not GDP
      // compliant, and the gate needs the documented claim.
      ...quoteCapabilityFields(),
      quote_status: status,
      unavailable_reason: null,
      source: `DSV Quote API ${this.config.environment}`,
      raw_response_ref: meta.rawRef,
      confidence: QUOTE_STATUS_CONFIDENCE[status],
      retrieved_at: meta.retrievedAt,
      provenance,
    };
  }

  /**
   * The price envelope.
   *
   * The tag is the whole point: a demo-environment price has a real API shape
   * and is **not real commercial pricing**, so it is SCENARIO with the reason on
   * it. Tagging it REAL would make a sandbox number indistinguishable from a
   * quote someone could actually book.
   */
  private toPrice(amount: number, isDemo: boolean, provenance: DsvProvenance): Quantity {
    return {
      value: amount,
      unit: 'INR',
      tag: isDemo ? 'SCENARIO' : 'REAL',
      provenance: isDemo
        ? {
            ...provenance,
            calculation_method:
              'Returned by the DSV DEMO environment. The API shape is real; the price is not ' +
              'real commercial pricing and must never be presented as a live quote.',
          }
        : provenance,
    };
  }

  private unavailable(
    request: ShipmentRequest,
    reason: UnavailableReason,
    detail: string,
    retrievedAt: string,
  ): CarrierQuote {
    return unavailableQuote({
      shipmentRequestId: request.id,
      carrierId: this.id,
      displayName: this.displayName,
      reason,
      detail,
      retrievedAt,
    });
  }
}

/** Maps a `ConnectorError` kind onto the reason the UI shows. */
