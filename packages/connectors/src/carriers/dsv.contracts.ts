/**
 * DSV's wire contracts, capability table, and pure mappers.
 *
 * Split out of `dsv.adapter.ts` so the adapter file is the *behaviour* — token
 * lifecycle, the quote call, the failure mapping — and this file is the facts:
 * which endpoints, which response shape, which capabilities the documentation
 * states.
 *
 * The `UNVERIFIED_SCHEMA` markers matter and are not decoration. DSV's OAuth
 * flow is documented publicly; the quote request and response *field names* are
 * inferred from the portal's product layout and have not been confirmed against
 * a live response. Anything the adapter cannot read produces an UNAVAILABLE
 * quote naming the field, rather than a plausible default.
 */

import { z } from 'zod';

import type {
  CarrierCapabilities,
  CarrierQuote,
  Quantity,
  ShipmentRequest,
  UnavailableReason,
} from '@vitalink/contracts';

import { ConnectorError } from '../http/connector-error';

export const MS_PER_SECOND = 1000;
/**
 * Refresh the token this long before it expires.
 *
 * DSV's access token lives ten minutes. Ninety seconds of margin means a quote
 * fan-out that starts with a nearly-expired token refreshes first rather than
 * failing halfway through and retrying.
 */
const TOKEN_SAFETY_MARGIN_SECONDS = 90;
export const TOKEN_SAFETY_MARGIN_MS = TOKEN_SAFETY_MARGIN_SECONDS * MS_PER_SECOND;
/** Spec 6.10: per-carrier timeout on the parallel fan-out. */
const CARRIER_TIMEOUT_SECONDS = 8;
export const CARRIER_TIMEOUT_MS = CARRIER_TIMEOUT_SECONDS * MS_PER_SECOND;
/** One retry on a carrier call. A quote fan-out cannot afford four. */
export const CARRIER_MAX_ATTEMPTS = 2;

export type DsvConfig = {
  environment: 'demo' | 'production';
  clientId: string;
  clientSecret: string;
  subscriptionKey: string;
};

/** Both endpoints, verbatim from the OAuth guide. */
export const TOKEN_ENDPOINTS = {
  demo: 'https://api.dsv.com/my-demo/oauth/v1/token',
  production: 'https://api.dsv.com/my/oauth/v1/token',
} as const;

/**
 * The quote endpoints.
 *
 * The `-demo` product naming matches what the portal publishes
 * (`generic-quote-demo`). The **path** is inferred from the portal's product
 * layout and is one of the `UNVERIFIED_SCHEMA` items above.
 */
export const QUOTE_ENDPOINTS = {
  demo: 'https://api.dsv.com/my-demo/quote/v1/quotes',
  production: 'https://api.dsv.com/my/quote/v1/quotes',
} as const;

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
});

/**
 * UNVERIFIED_SCHEMA — the quote response.
 *
 * Every field is optional and the object is permissive, deliberately. A strict
 * schema written from a documentation summary would reject the first real
 * response over a field name we guessed wrong, and the useful failure is "we
 * could not find a price in this response", not "field 42 was unexpected".
 */
export const quoteResponseSchema = z.object({
  quotes: z
    .array(
      z.object({
        quoteId: z.string().optional(),
        serviceCode: z.string().optional(),
        serviceName: z.string().optional(),
        transportMode: z.string().optional(),
        totalPrice: z
          .object({ amount: z.number().optional(), currency: z.string().optional() })
          .optional(),
        transitTime: z
          .object({ hours: z.number().optional(), days: z.number().optional() })
          .optional(),
        pickupDate: z.string().optional(),
        deliveryDate: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Capabilities, from DSV's published service descriptions.
 *
 * Note how much of this is `'unknown'`. DSV publishes a healthcare division and
 * documents temperature-controlled transport, but its *developer* documentation
 * does not state GDP certification or dangerous-goods handling per service — so
 * those stay unknown, and a shipment that requires them eliminates DSV rather
 * than trusting a guess.
 */
export const DSV_CAPABILITIES: CarrierCapabilities = {
  modes: ['air', 'road', 'sea', 'rail'],
  temperature_ranges: ['2-8C', '15-25C', 'ambient'],
  cold_chain_certified: 'unknown',
  gdp_compliant: 'unknown',
  dangerous_goods: 'unknown',
  customs_brokerage: true,
  temperature_monitoring: 'unknown',
  serves_lanes: 'international',
  tracking_granularity: 'event',
  provenance: {
    source_name: 'DSV developer portal and published service descriptions',
    source_url: 'https://developer.dsv.com/',
    query: 'API catalogue, OAuth guide and Quote product pages, read 8 September 2026',
    fetched_at: '2026-09-08T00:00:00.000Z',
    calculation_method:
      'Transcribed from DSV documentation. Fields DSV does not state per service are ' +
      "'unknown' rather than assumed true: a hard constraint requiring an unknown " +
      'capability eliminates the carrier, which is the safe direction.',
  },
};

export type CachedToken = { accessToken: string; expiresAtMs: number };

/** One quote from DSV's response, as the schema parses it. */
export type DsvQuote = NonNullable<z.infer<typeof quoteResponseSchema>['quotes']>[number];

/** The provenance every field of one DSV quote shares. */
export type DsvProvenance = {
  source_name: string;
  source_url: string;
  query: string | null;
  fetched_at: string;
};

export const HOURS_PER_DAY = 24;

/** Transit as hours, from whichever field DSV populated. */
export function toTransitHours(quote: DsvQuote, provenance: DsvProvenance): Quantity | null {
  const hours =
    quote.transitTime?.hours ??
    (quote.transitTime?.days === undefined ? null : quote.transitTime.days * HOURS_PER_DAY);

  return hours === null ? null : { value: hours, unit: 'hours', tag: 'REAL', provenance };
}

/**
 * The FX note, when DSV quoted in something other than rupees.
 *
 * No conversion is applied. Reporting a converted figure without a real rate
 * would invent a number, so the original currency is surfaced instead and the
 * operator can see that it needs converting.
 */
export function toFx(currency: string | undefined, retrievedAt: string): CarrierQuote['fx'] {
  if (currency === undefined || currency === 'INR') return null;

  return {
    rate: 1,
    base: currency,
    source: 'no conversion applied — original currency reported as-is',
    fetched_at: retrievedAt,
  };
}

export function mapErrorToReason(error: unknown): UnavailableReason {
  if (!(error instanceof ConnectorError)) return 'upstream_error';

  switch (error.kind) {
    case 'timeout':
      return 'api_timeout';
    case 'rate_limited':
      return 'rate_limited';
    case 'missing_credentials':
      return 'no_credentials';
    case 'bad_request':
      return 'invalid_request';
    case 'not_found':
      return 'route_not_served';
    case 'malformed_response':
      // Deliberately distinguished: a malformed response usually means the
      // UNVERIFIED_SCHEMA mapping is wrong, not that DSV is broken.
      return 'invalid_request';
    default:
      return 'upstream_error';
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ConnectorError) {
    const status = error.httpStatus === null ? '' : ` (HTTP ${String(error.httpStatus)})`;
    return `${error.message}${status}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function describeShipment(request: ShipmentRequest): string {
  return [
    `${request.origin.city}, ${request.origin.country}`,
    '->',
    `${request.destination.city}, ${request.destination.country}`,
    `${String(request.weight_kg.value)}kg`,
    `${String(request.number_of_packages)} package(s)`,
    request.temperature_requirement,
  ].join(' ');
}

/** DSV's transport-mode strings onto our normalised set. */
export function normaliseMode(mode: string | undefined): CarrierQuote['service_normalised'] {
  switch (mode?.toLowerCase()) {
    case 'air':
      return 'air';
    case 'sea':
    case 'ocean':
      return 'sea';
    case 'road':
    case 'truck':
      return 'road';
    case 'rail':
      return 'rail';
    case 'express':
    case 'xpress':
      return 'express';
    default:
      // Unrecognised rather than guessed. `multimodal` is the honest default for
      // a freight forwarder whose mode string we do not know.
      return 'multimodal';
  }
}

/**
 * The capability fields a quote carries, from the documented table.
 *
 * A quote payload does not restate a carrier's certifications, so these come
 * from `DSV_CAPABILITIES` — which is transcribed from DSV's own documentation
 * with the URL in its provenance, and never inferred.
 */
export function quoteCapabilityFields(): Pick<
  CarrierQuote,
  | 'temperature_control'
  | 'temperature_range_supported'
  | 'cold_chain'
  | 'gdp_compliant'
  | 'tracking_available'
  | 'tracking_granularity'
> {
  return {
    temperature_control: DSV_CAPABILITIES.temperature_monitoring,
    temperature_range_supported: DSV_CAPABILITIES.temperature_ranges,
    cold_chain: DSV_CAPABILITIES.cold_chain_certified,
    gdp_compliant: DSV_CAPABILITIES.gdp_compliant,
    tracking_available: true,
    tracking_granularity: DSV_CAPABILITIES.tracking_granularity,
  };
}
