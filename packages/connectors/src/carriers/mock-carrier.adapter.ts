/**
 * The development mock carrier.
 *
 * This is the one file in the whole system that is allowed to produce a price
 * without a carrier having said it, and it is hedged four ways.
 *
 *  1. **It can only be constructed when `CARRIER_MOCK_MODE` is true**, and
 *     `config/env.ts` refuses to boot with that flag set under
 *     `NODE_ENV=production`.
 *  2. **Every quote it returns is `SANDBOX_QUOTE`** with a `SCENARIO`-tagged
 *     price. The live-quote status string does not appear anywhere in this file —
 *     not even in this comment, which is why it is described rather than quoted —
 *     and **CI gate 5 greps for it here specifically** and fails the build if it
 *     ever appears.
 *  3. **The price is deterministic**, computed from the shipment's own weight and
 *     distance rather than from a random number generator — there is no RNG in
 *     runtime code (spec appendix), and a reviewer can recompute the figure.
 *  4. **The provenance says what it is** in plain language, so the number carries
 *     its own disclaimer into any screenshot or report it appears in.
 *
 * Its purpose is narrow: to let the eligibility gate, the scoring function and
 * the recommendation explanation be developed and demonstrated before any real
 * carrier credentials exist. It is not a stand-in for a carrier, and a mock
 * response is never described as a real carrier quote — in the UI, in the report,
 * or in a demo.
 */

import type {
  CarrierCapabilities,
  CarrierQuote,
  CarrierService,
  Provenance,
  ShipmentRequest,
  ShipmentTrackingEvent,
} from '@vitalink/contracts';

import {
  QUOTE_STATUS_CONFIDENCE,
  type CarrierAdapter,
  type CarrierAdapterDeps,
  type TransitEstimate,
} from './carrier-adapter';

/**
 * A deterministic rate card, so the same shipment always produces the same
 * figure and a reviewer can check the arithmetic.
 */
const RATE_CARD = {
  /** Base charge per shipment, INR. */
  baseInr: 4_000,
  /** Per kilogram, INR. */
  perKgInr: 85,
  /** Cold-chain surcharge as a multiplier. */
  coldChainMultiplier: 1.45,
  /** Express surcharge as a multiplier. */
  expressMultiplier: 1.8,
  /** Air freight surcharge over road, as a multiplier. */
  airMultiplier: 1.3,
} as const;

const HOURS = { express: 24, air: 48, road: 96 } as const;

const MOCK_CAPABILITIES: CarrierCapabilities = {
  modes: ['air', 'road', 'express'],
  temperature_ranges: ['2-8C', '15-25C', 'ambient', 'frozen'],
  // Deliberately generous, because the mock's job is to exercise the gate's
  // *passing* paths. The Tier C adapters exercise the failing ones.
  cold_chain_certified: true,
  gdp_compliant: true,
  dangerous_goods: true,
  customs_brokerage: true,
  temperature_monitoring: true,
  serves_lanes: 'international',
  tracking_granularity: 'event',
  provenance: {
    source_name: 'Vitalink development mock carrier',
    source_url: 'https://github.com/gitPiyush2004/VitaLink/blob/main/docs/CARRIER_STATUS.md',
    query: null,
    fetched_at: '2026-09-01T00:00:00.000Z',
    calculation_method:
      'NOT A REAL CARRIER. A development affordance, enabled only by CARRIER_MOCK_MODE, ' +
      'which cannot be set under NODE_ENV=production. Its capabilities are declared ' +
      'permissive so that the eligibility gate has something that passes; its prices are ' +
      'deterministic and are never real commercial pricing.',
  },
};

/** Three services, so the comparison table has something to compare. */
const SERVICES = [
  { code: 'MOCK-EXPRESS', name: 'Mock Express', mode: 'express' as const },
  { code: 'MOCK-AIR', name: 'Mock Air Freight', mode: 'air' as const },
  { code: 'MOCK-ROAD', name: 'Mock Road', mode: 'road' as const },
];

export class MockCarrierAdapter implements CarrierAdapter {
  readonly id = 'mock' as const;
  readonly displayName = 'Mock Carrier (development only)';
  /** Tier C: it has no public API because it is not a carrier. */
  readonly tier = 'C' as const;

  /**
   * @param enabled must be the value of `CARRIER_MOCK_MODE`. The constructor
   *   throws when it is false, so the adapter cannot be registered by accident.
   */
  constructor(
    private readonly deps: CarrierAdapterDeps,
    enabled: boolean,
  ) {
    if (!enabled) {
      throw new Error(
        'MockCarrierAdapter was constructed with CARRIER_MOCK_MODE off. It exists only as a ' +
          'development affordance and must not be reachable otherwise.',
      );
    }
  }

  /** Always true: if it was constructed at all, mock mode is on. */
  isConfigured(): boolean {
    return true;
  }

  getCapabilities(): Promise<CarrierCapabilities> {
    return Promise.resolve(MOCK_CAPABILITIES);
  }

  getServiceOptions(_request: ShipmentRequest): Promise<CarrierService[]> {
    return Promise.resolve(
      SERVICES.map((service) => ({
        carrier_id: this.id,
        service_code: service.code,
        service_name: service.name,
        service_normalised: service.mode,
        provenance: MOCK_CAPABILITIES.provenance,
      })),
    );
  }

  async getQuote(request: ShipmentRequest): Promise<CarrierQuote[]> {
    const retrievedAt = this.deps.clock.now().toISOString();
    // Archived like a real payload, so the audit path is exercised too — and so
    // the archive shows plainly that this was a mock.
    const rawRef = await this.deps.archiveRawPayload(
      this.id,
      JSON.stringify({ mock: true, shipment: request.id, generated_at: retrievedAt }),
    );

    return SERVICES.map((service) => this.buildQuote(request, service, retrievedAt, rawRef));
  }

  async getTransitTime(request: ShipmentRequest): Promise<TransitEstimate[]> {
    const quotes = await this.getQuote(request);

    return quotes.map((quote) => ({
      serviceCode: quote.service,
      transitHours: quote.transit_hours?.value ?? 0,
      pickupEstimate: quote.pickup_estimate,
      deliveryEstimate: quote.delivery_estimate,
    }));
  }

  getTracking(_carrierReference: string): Promise<ShipmentTrackingEvent[]> {
    return Promise.resolve([]);
  }

  /**
   * The deterministic figure and the arithmetic that produced it.
   *
   * There is no random number here, which is the point: the same shipment
   * always produces the same figure, and `calculation_method` states the whole
   * formula so a reader can recompute it. That is the difference between a
   * transparent placeholder and a fabrication — and the text leads with NOT A
   * REAL CARRIER QUOTE because that string travels with the number everywhere it
   * is rendered.
   */
  private price(
    request: ShipmentRequest,
    service: (typeof SERVICES)[number],
    retrievedAt: string,
  ): { amount: number; provenance: Provenance } {
    const weightKg = request.weight_kg.value;
    const needsColdChain = request.temperature_requirement === '2-8C';

    const modeMultiplier =
      service.mode === 'express'
        ? RATE_CARD.expressMultiplier
        : service.mode === 'air'
          ? RATE_CARD.airMultiplier
          : 1;
    const coldMultiplier = needsColdChain ? RATE_CARD.coldChainMultiplier : 1;

    const amount = Math.round(
      (RATE_CARD.baseInr + weightKg * RATE_CARD.perKgInr) * modeMultiplier * coldMultiplier,
    );

    return {
      amount,
      provenance: {
        source_name: this.displayName,
        source_url: 'https://github.com/gitPiyush2004/VitaLink/blob/main/docs/CARRIER_STATUS.md',
        query: null,
        fetched_at: retrievedAt,
        calculation_method:
          'NOT A REAL CARRIER QUOTE. Deterministic development figure: ' +
          `(base ${String(RATE_CARD.baseInr)} + ${String(weightKg)}kg * ` +
          `${String(RATE_CARD.perKgInr)}) * mode ${String(modeMultiplier)} * cold chain ` +
          `${String(coldMultiplier)} = ${String(amount)} INR. No random number is involved, so ` +
          'the figure is reproducible — but it is not commercial pricing and must never be ' +
          'presented as a live quote.',
      },
    };
  }

  /**
   * One quote, priced deterministically.
   *
   * The formula is in the `calculation_method` so a reader can recompute it,
   * which is the difference between a transparent placeholder and a fabrication.
   */
  private buildQuote(
    request: ShipmentRequest,
    service: (typeof SERVICES)[number],
    retrievedAt: string,
    rawRef: string,
  ): CarrierQuote {
    const { amount, provenance } = this.price(request, service, retrievedAt);
    const transitHours = HOURS[service.mode];

    return {
      id: `quote-mock-${request.id}-${service.code}`,
      shipment_request_id: request.id,
      provider: this.id,
      provider_display: this.displayName,
      service: service.name,
      service_normalised: service.mode,
      price: {
        value: amount,
        unit: 'INR',
        // SCENARIO, because it is a what-if figure and not an observation.
        tag: 'SCENARIO',
        provenance,
      },
      currency: 'INR',
      fx: null,
      transit_hours: { value: transitHours, unit: 'hours', tag: 'SCENARIO', provenance },
      pickup_estimate: null,
      delivery_estimate: addHours(retrievedAt, transitHours),
      temperature_control: true,
      temperature_range_supported: MOCK_CAPABILITIES.temperature_ranges,
      cold_chain: true,
      gdp_compliant: true,
      tracking_available: true,
      tracking_granularity: 'event',
      // The only status this file may ever produce. CI gate 5 enforces it.
      quote_status: 'SANDBOX_QUOTE',
      unavailable_reason: null,
      source: 'Vitalink development mock carrier',
      raw_response_ref: rawRef,
      confidence: QUOTE_STATUS_CONFIDENCE.SANDBOX_QUOTE,
      retrieved_at: retrievedAt,
      provenance,
    };
  }
}

const MS_PER_HOUR = 3_600_000;

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * MS_PER_HOUR).toISOString();
}
