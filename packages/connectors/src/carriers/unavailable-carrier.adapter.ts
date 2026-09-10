/**
 * Tier C carriers: a real adapter, honestly unable to quote.
 *
 * Kuehne+Nagel and CEVA have **no public self-serve developer portal** (see
 * `docs/CARRIER_STATUS.md`, verified 8 September 2026). myKN "Connectivity" is an
 * account-arranged EDI integration; no official CEVA developer portal could be
 * found at all.
 *
 * The spec is explicit about what to do (6.1, consequence 2): they get a real
 * adapter implementing the full interface, and they return `SANDBOX_QUOTE` or
 * `UNAVAILABLE` — **never** `LIVE_QUOTE`.
 *
 * ## What this adapter deliberately does not do
 *
 * **It does not scrape their customer portals.** A logged-in myKN session is not
 * a public API. Scraping it would be a terms violation and a dependency that
 * breaks on the next page redesign, and the resulting number would be presented
 * as a carrier quote while actually being a screen-scrape.
 *
 * **It does not route through a third-party tracking aggregator undisclosed.**
 * CEVA tracking is reachable that way. If that route is ever taken, the
 * provenance must name the aggregator rather than CEVA, because the aggregator is
 * what was actually asked.
 *
 * So it returns `UNAVAILABLE` with reason `not_publicly_available`, and the
 * comparison table shows that row with its reason. A supply chain manager reading
 * it learns something true: this carrier cannot be compared on price without a
 * commercial account. That is more useful than a plausible number.
 */

import type {
  CarrierCapabilities,
  CarrierId,
  CarrierQuote,
  CarrierService,
  ShipmentRequest,
  ShipmentTrackingEvent,
} from '@vitalink/contracts';

import {
  unavailableQuote,
  type CarrierAdapter,
  type CarrierAdapterDeps,
  type TransitEstimate,
} from './carrier-adapter';

export type UnavailableCarrierConfig = {
  id: CarrierId;
  displayName: string;
  /** The verified reason, which appears in the UI verbatim. */
  integrationNote: string;
  /** Where the claim was checked, so a reader can re-check it. */
  documentationUrl: string;
  /** Set only when an operator has arranged account-level access. */
  apiKey: string;
};

/**
 * Capabilities where almost everything is `'unknown'`.
 *
 * That is the honest state for a carrier whose developer documentation does not
 * exist publicly, and it has a real consequence: a shipment requiring GDP
 * handling **eliminates** this carrier at the gate, because the gate treats
 * `'unknown'` as a failure. Declaring `true` to make the table look fuller would
 * put a pharmaceutical shipment on a carrier whose handling nobody has verified.
 */
function unknownCapabilities(config: UnavailableCarrierConfig): CarrierCapabilities {
  return {
    // Both are global freight forwarders, which is a matter of public record.
    modes: ['air', 'road', 'sea'],
    temperature_ranges: [],
    cold_chain_certified: 'unknown',
    gdp_compliant: 'unknown',
    dangerous_goods: 'unknown',
    customs_brokerage: 'unknown',
    temperature_monitoring: 'unknown',
    serves_lanes: 'international',
    tracking_granularity: 'none',
    provenance: {
      source_name: `${config.displayName} — public information only`,
      source_url: config.documentationUrl,
      query: 'checked for a public developer portal, 8 September 2026',
      fetched_at: '2026-09-08T00:00:00.000Z',
      calculation_method:
        `${config.integrationNote} Every capability this carrier does not publicly document ` +
        "is 'unknown' rather than assumed. A hard constraint requiring an unknown capability " +
        'eliminates the carrier, which is the safe direction for a pharmaceutical shipment.',
    },
  };
}

export class UnavailableCarrierAdapter implements CarrierAdapter {
  readonly id: CarrierId;
  readonly displayName: string;
  /** Tier C: no public self-serve API. */
  readonly tier = 'C' as const;

  constructor(
    private readonly deps: CarrierAdapterDeps,
    private readonly config: UnavailableCarrierConfig,
  ) {
    this.id = config.id;
    this.displayName = config.displayName;
  }

  /**
   * False unless an operator has arranged account access.
   *
   * Even then this adapter cannot quote, because there is no documented endpoint
   * to call — which is why `getQuote` reports `not_publicly_available` rather
   * than `no_credentials` when a key *is* present. The two reasons are different
   * findings and the UI should not conflate them.
   */
  isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }

  getCapabilities(): Promise<CarrierCapabilities> {
    return Promise.resolve(unknownCapabilities(this.config));
  }

  getServiceOptions(_request: ShipmentRequest): Promise<CarrierService[]> {
    return Promise.resolve([]);
  }

  getQuote(request: ShipmentRequest): Promise<CarrierQuote[]> {
    const retrievedAt = this.deps.clock.now().toISOString();

    return Promise.resolve([
      unavailableQuote({
        shipmentRequestId: request.id,
        carrierId: this.id,
        displayName: this.displayName,
        // The distinction matters: with a key present the blocker is the missing
        // public API, not the missing credential.
        reason: this.isConfigured() ? 'not_publicly_available' : 'no_credentials',
        detail: this.config.integrationNote,
        retrievedAt,
      }),
    ]);
  }

  getTransitTime(_request: ShipmentRequest): Promise<TransitEstimate[]> {
    return Promise.resolve([]);
  }

  getTracking(_carrierReference: string): Promise<ShipmentTrackingEvent[]> {
    // Reachable through third-party aggregators, deliberately not used. See the
    // note at the top of this file.
    return Promise.resolve([]);
  }
}

/** The two Tier C carriers, with their verified reasons. */
export const TIER_C_CARRIERS: Omit<UnavailableCarrierConfig, 'apiKey'>[] = [
  {
    id: 'kuehne_nagel',
    displayName: 'Kuehne+Nagel',
    integrationNote:
      'No public self-serve developer portal. myKN "Connectivity" is an account-arranged ' +
      'EDI/API integration, and no quotation API is publicly documented. Verified ' +
      '8 September 2026.',
    documentationUrl: 'https://home.kuehne-nagel.com/',
  },
  {
    id: 'ceva',
    displayName: 'CEVA Logistics',
    integrationNote:
      'No official public developer portal could be found. Tracking is reachable only ' +
      'through third-party aggregators, which this system deliberately does not use without ' +
      'naming the aggregator in the provenance. Verified 8 September 2026.',
    documentationUrl: 'https://www.cevalogistics.com/',
  },
];
