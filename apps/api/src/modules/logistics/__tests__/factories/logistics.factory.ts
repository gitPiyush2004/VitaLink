/**
 * Factories for the logistics tests. Defaults plus overrides, not fixtures.
 *
 * The defaults describe a shipment and a carrier that **pass** every gate rule,
 * so each test can break exactly one thing and assert exactly one failure. A
 * fixture set where the baseline already failed two rules would make every test
 * ambiguous about what it was actually proving.
 */

import type {
  CarrierCapabilities,
  CarrierQuote,
  Provenance,
  ShipmentRequest,
} from '@vitalink/contracts';

export const NOW = new Date('2026-09-10T00:00:00.000Z');
/** Four days out, so a 48-hour service has comfortable slack. */
export const DEADLINE = '2026-09-14T00:00:00.000Z';

const PROVENANCE: Provenance = {
  source_name: 'test',
  source_url: 'https://example.test/doc',
  query: null,
  fetched_at: NOW.toISOString(),
};

export function makeShipmentRequest(overrides: Partial<ShipmentRequest> = {}): ShipmentRequest {
  return {
    id: 'ship-1',
    context: {
      disruption_id: null,
      cascade_id: 'cascade-1',
      drug_id: 'drug:heparin-sodium',
      hub_id_destination: 'hub:mumbai',
      triggered_by: 'cascade',
    },
    origin: {
      name: 'Hyderabad plant',
      city: 'Hyderabad',
      country: 'IN',
      point: { type: 'Point', coordinates: [78.4867, 17.385] },
      provenance: PROVENANCE,
    },
    destination: {
      name: 'Mumbai hub',
      city: 'Mumbai',
      country: 'IN',
      point: { type: 'Point', coordinates: [72.8777, 19.076] },
      provenance: PROVENANCE,
    },
    product: {
      drug_id: 'drug:heparin-sodium',
      name: 'heparin sodium',
      category: 'anticoagulant',
      nlem_critical: true,
    },
    weight_kg: {
      value: 120,
      unit: 'kg',
      tag: 'DERIVED',
      provenance: { ...PROVENANCE, calculation_method: 'test' },
    },
    dimensions_cm: [{ l: 40, w: 30, h: 30 }],
    volume_m3: {
      value: 0.36,
      unit: 'm3',
      tag: 'DERIVED',
      provenance: { ...PROVENANCE, calculation_method: 'test' },
    },
    number_of_packages: 4,
    temperature_requirement: '15-25C',
    required_delivery_deadline: DEADLINE,
    shipping_mode_preference: 'any',
    special_handling: [],
    hazardous_material: false,
    customs_required: false,
    urgency: 'NORMAL',
    budget_ceiling_inr: null,
    created_at: NOW.toISOString(),
    provenance: PROVENANCE,
    ...overrides,
  };
}

/** Capabilities that satisfy everything, so a test can turn one off. */
export function makeCapabilities(
  overrides: Partial<CarrierCapabilities> = {},
): CarrierCapabilities {
  return {
    modes: ['air', 'road', 'express'],
    temperature_ranges: ['2-8C', '15-25C', 'ambient'],
    cold_chain_certified: true,
    gdp_compliant: true,
    dangerous_goods: true,
    customs_brokerage: true,
    temperature_monitoring: true,
    serves_lanes: 'international',
    tracking_granularity: 'event',
    provenance: PROVENANCE,
    ...overrides,
  };
}

export function makeQuote(overrides: Partial<CarrierQuote> = {}): CarrierQuote {
  return {
    id: 'quote-1',
    shipment_request_id: 'ship-1',
    provider: 'mock',
    provider_display: 'Test Carrier',
    service: 'Test Air',
    service_normalised: 'air',
    price: {
      value: 42_000,
      unit: 'INR',
      tag: 'SCENARIO',
      provenance: { ...PROVENANCE, calculation_method: 'test rate card' },
    },
    currency: 'INR',
    fx: null,
    transit_hours: { value: 48, unit: 'hours', tag: 'SCENARIO', provenance: PROVENANCE },
    pickup_estimate: null,
    // Two days out, so it beats the four-day deadline with slack.
    delivery_estimate: '2026-09-12T00:00:00.000Z',
    temperature_control: true,
    temperature_range_supported: ['2-8C', '15-25C', 'ambient'],
    cold_chain: true,
    gdp_compliant: true,
    tracking_available: true,
    tracking_granularity: 'event',
    quote_status: 'SANDBOX_QUOTE',
    unavailable_reason: null,
    source: 'test',
    raw_response_ref: 'raw-1',
    confidence: 0.5,
    retrieved_at: NOW.toISOString(),
    provenance: PROVENANCE,
    ...overrides,
  };
}
