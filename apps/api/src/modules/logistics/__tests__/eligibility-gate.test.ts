/**
 * The eligibility gate: all nine rules, each with a passing and a failing case.
 *
 * The spec asks for exactly this coverage, and the reason is that a gate failure
 * is not a scoring nudge — it eliminates a carrier. A rule that silently stopped
 * firing would let a carrier that cannot hold 2-8 °C win a cold-chain shipment,
 * and nothing downstream would notice.
 *
 * Two structural tests matter as much as the nine rules: that `'unknown'` fails a
 * constraint requiring the capability, and that the gate reports **every** failure
 * rather than short-circuiting on the first.
 */

import { describe, expect, it } from 'vitest';

import { checkEligibility, summariseGate } from '../domain/eligibility-gate';

import {
  DEADLINE,
  NOW,
  makeCapabilities,
  makeQuote,
  makeShipmentRequest,
} from './factories/logistics.factory';

/** The baseline passes every rule, so each test can break exactly one thing. */
function gate(overrides: Partial<Parameters<typeof checkEligibility>[0]> = {}) {
  return checkEligibility({
    request: makeShipmentRequest(),
    quote: makeQuote(),
    capabilities: makeCapabilities(),
    prohibitedRanges: [],
    now: NOW,
    ...overrides,
  });
}

describe('the baseline', () => {
  it('is eligible, so every other test breaks exactly one rule', () => {
    const result = gate();

    expect(result.isEligible).toBe(true);
    expect(result.failures).toEqual([]);
    expect(summariseGate(result)).toBe('ELIGIBLE');
  });
});

describe('rule 1 — deadline', () => {
  it('passes when the arrival beats the deadline', () => {
    expect(gate().isEligible).toBe(true);
  });

  it('fails when the arrival is after the deadline', () => {
    const result = gate({
      quote: makeQuote({ delivery_estimate: '2026-09-20T00:00:00.000Z' }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('deadline_miss');
  });

  it('falls back to transit hours when no delivery date is given', () => {
    // 200 hours from NOW overshoots a four-day deadline.
    const result = gate({
      quote: makeQuote({
        delivery_estimate: null,
        transit_hours: {
          value: 200,
          unit: 'hours',
          tag: 'SCENARIO',
          provenance: makeQuote().provenance,
        },
      }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('deadline_miss');
  });

  it('treats an unproven deadline as unmet, not as probably fine', () => {
    // Neither an arrival date nor a transit time. A carrier that cannot show it
    // will arrive on time has not shown it will arrive on time.
    const result = gate({
      quote: makeQuote({ delivery_estimate: null, transit_hours: null }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('deadline_miss');
    expect(result.failures.find((one) => one.reason === 'deadline_miss')?.detail).toContain(
      'Unproven is treated as unmet',
    );
  });
});

describe('rule 2 — temperature', () => {
  it('passes when the required range is supported', () => {
    expect(gate().isEligible).toBe(true);
  });

  it('fails when the required range is not supported', () => {
    const result = gate({
      request: makeShipmentRequest({ temperature_requirement: '2-8C' }),
      capabilities: makeCapabilities({ temperature_ranges: ['ambient'] }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('temperature_unsupported');
  });

  it('eliminates a refrigerated-only carrier for a drug whose label forbids refrigeration', () => {
    // Cisplatin's real label says "Do not refrigerate". A reefer-only carrier is
    // the wrong choice, and the prohibition is carried all the way from the label
    // parser to here so the gate can act on it.
    const result = gate({
      request: makeShipmentRequest({ temperature_requirement: '2-8C' }),
      capabilities: makeCapabilities({ temperature_ranges: ['2-8C'] }),
      prohibitedRanges: ['2-8C'],
    });

    expect(result.failures.map((one) => one.reason)).toContain('temperature_unsupported');
    expect(
      result.failures.find((one) => one.reason === 'temperature_unsupported')?.detail,
    ).toContain('FORBIDS');
  });

  it('does not eliminate a carrier that also offers a permitted range', () => {
    const result = gate({
      request: makeShipmentRequest({ temperature_requirement: '15-25C' }),
      capabilities: makeCapabilities({ temperature_ranges: ['2-8C', '15-25C'] }),
      prohibitedRanges: ['2-8C'],
    });

    expect(result.failures.map((one) => one.reason)).not.toContain('temperature_unsupported');
  });
});

describe('rule 3 — lane', () => {
  it('passes for an international carrier on any lane', () => {
    expect(gate().isEligible).toBe(true);
  });

  it('passes for a domestic-India carrier on a domestic India lane', () => {
    const result = gate({ capabilities: makeCapabilities({ serves_lanes: 'domestic_in' }) });

    expect(result.failures.map((one) => one.reason)).not.toContain('route_not_served');
  });

  it('fails for a domestic-India carrier on an export lane', () => {
    const result = gate({
      request: makeShipmentRequest({
        destination: { ...makeShipmentRequest().destination, country: 'DE', city: 'Frankfurt' },
      }),
      capabilities: makeCapabilities({ serves_lanes: 'domestic_in' }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('route_not_served');
  });

  it('fails when the lane is absent from an explicit lane list', () => {
    const result = gate({ capabilities: makeCapabilities({ serves_lanes: ['IN-DE', 'IN-US'] }) });

    expect(result.failures.map((one) => one.reason)).toContain('route_not_served');
  });

  it('passes when the lane is present in an explicit lane list', () => {
    const result = gate({ capabilities: makeCapabilities({ serves_lanes: ['IN-IN'] }) });

    expect(result.failures.map((one) => one.reason)).not.toContain('route_not_served');
  });
});

describe('rule 4 — special handling', () => {
  it('passes when every required handling is documented true', () => {
    const result = gate({
      request: makeShipmentRequest({ special_handling: ['cold_chain', 'gdp'] }),
    });

    expect(result.failures.map((one) => one.reason)).not.toContain('handling_unsupported');
  });

  it('fails when a required handling is documented false', () => {
    const result = gate({
      request: makeShipmentRequest({ special_handling: ['gdp'] }),
      capabilities: makeCapabilities({ gdp_compliant: false }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('handling_unsupported');
  });

  it("fails when a required handling is 'unknown'", () => {
    // The rule that keeps the tri-state honest. Treating unknown as probably
    // fine would put a pharmaceutical shipment on unverified handling.
    const result = gate({
      request: makeShipmentRequest({ special_handling: ['gdp'] }),
      capabilities: makeCapabilities({ gdp_compliant: 'unknown' }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('handling_unsupported');
    expect(result.failures.find((one) => one.reason === 'handling_unsupported')?.detail).toContain(
      'a guessed yes is not a yes',
    );
  });

  it('fails for a handling no carrier documents at all', () => {
    const result = gate({
      request: makeShipmentRequest({ special_handling: ['controlled_substance'] }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('handling_unsupported');
  });
});

describe('rules 5 and 6 — dangerous goods and customs', () => {
  it('passes hazardous material when the carrier documents DG handling', () => {
    const result = gate({ request: makeShipmentRequest({ hazardous_material: true }) });

    expect(result.failures.map((one) => one.reason)).not.toContain('dg_unsupported');
  });

  it("fails hazardous material when DG handling is 'unknown'", () => {
    const result = gate({
      request: makeShipmentRequest({ hazardous_material: true }),
      capabilities: makeCapabilities({ dangerous_goods: 'unknown' }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('dg_unsupported');
  });

  it('passes a customs shipment when the carrier documents brokerage', () => {
    const result = gate({ request: makeShipmentRequest({ customs_required: true }) });

    expect(result.failures.map((one) => one.reason)).not.toContain('customs_unsupported');
  });

  it("fails a customs shipment when brokerage is 'unknown'", () => {
    const result = gate({
      request: makeShipmentRequest({ customs_required: true }),
      capabilities: makeCapabilities({ customs_brokerage: 'unknown' }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('customs_unsupported');
  });
});

describe('rule 7 — quote availability', () => {
  it('passes when a price was obtained', () => {
    expect(gate().isEligible).toBe(true);
  });

  it("fails an UNAVAILABLE quote and carries the carrier's own reason", () => {
    const result = gate({
      quote: makeQuote({
        quote_status: 'UNAVAILABLE',
        unavailable_reason: 'no_credentials',
        price: null,
      }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('quote_unavailable');
    expect(result.failures.find((one) => one.reason === 'quote_unavailable')?.detail).toContain(
      'no_credentials',
    );
  });
});

describe('rule 8 — budget ceiling', () => {
  it('passes when no ceiling is set', () => {
    expect(gate().isEligible).toBe(true);
  });

  it('passes when the price is within the ceiling', () => {
    const result = gate({
      request: makeShipmentRequest({
        budget_ceiling_inr: {
          value: 50_000,
          unit: 'INR',
          tag: 'SCENARIO',
          provenance: makeQuote().provenance,
        },
      }),
    });

    expect(result.failures.map((one) => one.reason)).not.toContain('over_budget');
  });

  it('fails when the price exceeds the ceiling', () => {
    // Spec 6.12's example: setting a 35,000 ceiling makes a 42,000 quote
    // NOT ELIGIBLE rather than merely lower-scoring.
    const result = gate({
      request: makeShipmentRequest({
        budget_ceiling_inr: {
          value: 35_000,
          unit: 'INR',
          tag: 'SCENARIO',
          provenance: makeQuote().provenance,
        },
      }),
    });

    expect(result.failures.map((one) => one.reason)).toContain('over_budget');
    expect(result.failures.find((one) => one.reason === 'over_budget')?.detail).toContain('35,000');
  });
});

describe('rule 9 — mode preference', () => {
  it('passes when the preference is "any"', () => {
    expect(gate().isEligible).toBe(true);
  });

  it('passes when the service mode is in the preference list', () => {
    const result = gate({ request: makeShipmentRequest({ shipping_mode_preference: ['air'] }) });

    expect(result.failures.map((one) => one.reason)).not.toContain('mode_excluded');
  });

  it('fails when the service mode is excluded', () => {
    const result = gate({ request: makeShipmentRequest({ shipping_mode_preference: ['sea'] }) });

    expect(result.failures.map((one) => one.reason)).toContain('mode_excluded');
  });

  it('does not exclude a multimodal service, which means the mode is unknown', () => {
    // Excluding it would eliminate a freight forwarder for being vague about its
    // mode, which is a documentation gap rather than a capability gap.
    const result = gate({
      request: makeShipmentRequest({ shipping_mode_preference: ['air'] }),
      quote: makeQuote({ service_normalised: 'multimodal' }),
    });

    expect(result.failures.map((one) => one.reason)).not.toContain('mode_excluded');
  });
});

describe('an unavailable quote reports only that', () => {
  it('does not also claim the carrier missed the deadline', () => {
    // The one place the gate stops early. An UNAVAILABLE quote has no arrival
    // date, no price and no capability fields, so the other eight rules would
    // each report a failure derived from an empty payload — which reads as eight
    // findings where there is one. Claiming "DSV misses the deadline" about a
    // carrier that returned nothing is a claim we cannot support.
    const result = gate({
      request: makeShipmentRequest({ temperature_requirement: '2-8C', special_handling: ['gdp'] }),
      quote: makeQuote({
        quote_status: 'UNAVAILABLE',
        unavailable_reason: 'no_credentials',
        price: null,
        delivery_estimate: null,
        transit_hours: null,
        temperature_range_supported: [],
      }),
      capabilities: makeCapabilities({ temperature_ranges: [], gdp_compliant: 'unknown' }),
    });

    expect(result.isEligible).toBe(false);
    expect(result.failures.map((one) => one.reason)).toEqual(['quote_unavailable']);
  });

  it('still reports every failure for a carrier that did quote', () => {
    // The short-circuit is specific to rule 7 and must not have swallowed the
    // no-short-circuit guarantee for everyone else.
    const result = gate({
      request: makeShipmentRequest({ temperature_requirement: '2-8C', special_handling: ['gdp'] }),
      capabilities: makeCapabilities({ temperature_ranges: ['ambient'], gdp_compliant: false }),
    });

    expect(result.failures.length).toBeGreaterThan(1);
  });
});

describe('the gate reports every failure, not just the first', () => {
  it('lists all three problems for a carrier that has three', () => {
    // A supply chain manager deciding whether to phone this carrier needs all
    // three. Reporting only "deadline_miss" would send someone to negotiate a
    // faster service from a carrier that could never carry the product anyway.
    const result = gate({
      request: makeShipmentRequest({
        temperature_requirement: '2-8C',
        special_handling: ['gdp'],
        destination: { ...makeShipmentRequest().destination, country: 'DE', city: 'Frankfurt' },
      }),
      quote: makeQuote({ delivery_estimate: '2026-09-30T00:00:00.000Z' }),
      capabilities: makeCapabilities({
        temperature_ranges: ['ambient'],
        gdp_compliant: 'unknown',
        serves_lanes: 'domestic_in',
      }),
    });

    const reasons = result.failures.map((one) => one.reason);
    expect(reasons).toContain('deadline_miss');
    expect(reasons).toContain('temperature_unsupported');
    expect(reasons).toContain('route_not_served');
    expect(reasons).toContain('handling_unsupported');
    expect(result.failures.length).toBeGreaterThanOrEqual(4);
  });

  it('summarises as NOT ELIGIBLE with the reasons, and never as a score', () => {
    const result = gate({ request: makeShipmentRequest({ shipping_mode_preference: ['sea'] }) });

    expect(summariseGate(result)).toContain('NOT ELIGIBLE');
    expect(summariseGate(result)).toContain('mode_excluded');
  });
});

describe('the deadline is compared as an absolute instant', () => {
  it('does not depend on when the test runs', () => {
    // `now` is injected precisely so this holds. A gate that read the clock would
    // pass today and fail after the hardcoded deadline passed.
    const early = checkEligibility({
      request: makeShipmentRequest(),
      quote: makeQuote(),
      capabilities: makeCapabilities(),
      prohibitedRanges: [],
      now: new Date('2026-09-10T00:00:00.000Z'),
    });
    const late = checkEligibility({
      request: makeShipmentRequest(),
      quote: makeQuote(),
      capabilities: makeCapabilities(),
      prohibitedRanges: [],
      now: new Date('2030-01-01T00:00:00.000Z'),
    });

    // The quote's own delivery estimate still beats the deadline in both, because
    // the comparison is estimate-vs-deadline, not now-vs-deadline.
    expect(early.isEligible).toBe(true);
    expect(late.isEligible).toBe(true);
    expect(DEADLINE).toBe('2026-09-14T00:00:00.000Z');
  });
});
