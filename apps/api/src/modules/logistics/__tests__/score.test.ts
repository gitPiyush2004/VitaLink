/**
 * Weight profiles, sub-scores, and the ranking.
 *
 * The test the spec asks for by name is `describe('the weighting is responsive')`
 * below: with a CRITICAL profile a carrier that is ₹6 k cheaper but 25 hours
 * slower must lose to the faster one, and with a LOW profile the same pair must
 * reverse. If that does not hold, the profiles are decoration — the system would
 * be printing "CRITICAL" next to a decision it would have made anyway.
 */

import { describe, expect, it } from 'vitest';

import {
  MIN_COLD_CHAIN_WEIGHT,
  WEIGHT_PROFILES,
  validateProfile,
  type WeightProfile,
} from '@config/weights';

import { recommend, type QuoteWithCapabilities } from '../domain/recommend';
import { applyPreference, explainScore, rankCandidates, scoreCandidate } from '../domain/score';
import { coldChainSubScore, reliabilitySubScore, riskSubScore } from '../domain/sub-scores';

import {
  DEADLINE,
  NOW,
  makeCapabilities,
  makeQuote,
  makeShipmentRequest,
} from './factories/logistics.factory';

describe('the weight profiles', () => {
  it('all sum to 1', () => {
    // A sub-score is 0-100 and the final score is a weighted sum, so weights
    // summing to 1.2 would produce a score of 120 and break every threshold
    // comparison downstream without any test noticing.
    for (const profile of Object.values(WEIGHT_PROFILES)) {
      expect(validateProfile(profile), `${profile.name} is malformed`).toEqual([]);
    }
  });

  it('never let cold chain fall below the floor', () => {
    for (const profile of Object.values(WEIGHT_PROFILES)) {
      expect(profile.weights.cold_chain).toBeGreaterThanOrEqual(MIN_COLD_CHAIN_WEIGHT);
    }
  });

  it('rejects a profile whose weights do not sum to 1', () => {
    const broken: WeightProfile = {
      name: 'NORMAL',
      weights: { cost: 0.5, transit: 0.5, reliability: 0.2, cold_chain: 0.2, risk: 0, service: 0 },
      rationale: 'deliberately broken',
    };

    expect(validateProfile(broken)[0]).toContain('not 1');
  });

  it('rejects a profile that drops cold chain below the floor', () => {
    const broken: WeightProfile = {
      name: 'CRITICAL',
      weights: { cost: 0.1, transit: 0.7, reliability: 0.1, cold_chain: 0.1, risk: 0, service: 0 },
      rationale: 'transit at any cost, including the cold chain',
    };

    expect(validateProfile(broken).join(' ')).toContain('floor this system requires');
  });

  it('shifts weight from cost to transit as urgency rises', () => {
    // The profiles have to actually differ in the direction they claim to, or
    // the responsiveness test below would be passing by coincidence.
    expect(WEIGHT_PROFILES.CRITICAL.weights.cost).toBeLessThan(WEIGHT_PROFILES.LOW.weights.cost);
    expect(WEIGHT_PROFILES.CRITICAL.weights.transit).toBeGreaterThan(
      WEIGHT_PROFILES.LOW.weights.transit,
    );
  });
});

// ---------------------------------------------------------------------------
// The sanity check the spec demands
// ---------------------------------------------------------------------------

/**
 * Two carriers, identical in every respect except price and arrival.
 *
 * FAST costs ₹48,000 and arrives 2026-09-12 (48h out, 48h of slack).
 * CHEAP costs ₹42,000 and arrives 2026-09-13T01:00 (25h later, 23h of slack).
 *
 * Confidence is 1 on both so the cost sub-score is undamped: this test is about
 * the weighting, and blending towards neutral by quote confidence would mute the
 * very axis under test.
 */
function pair(): QuoteWithCapabilities[] {
  const base = {
    capabilities: makeCapabilities(),
    observedReliability: null,
    laneExposure: null,
  } as const;
  const priceOf = (value: number) => ({
    value,
    unit: 'INR' as const,
    tag: 'SCENARIO' as const,
    provenance: { ...makeQuote().provenance, calculation_method: 'test rate card' },
  });

  return [
    {
      ...base,
      quote: makeQuote({
        id: 'quote-fast',
        // Distinct providers, because coverage counts providers rather than
        // quotes: two services from one carrier is one carrier that quoted.
        provider: 'dsv',
        provider_display: 'Fast Carrier',
        price: priceOf(48_000),
        delivery_estimate: '2026-09-12T00:00:00.000Z',
        transit_hours: null,
        confidence: 1,
      }),
    },
    {
      ...base,
      quote: makeQuote({
        id: 'quote-cheap',
        provider: 'mock',
        provider_display: 'Cheap Carrier',
        price: priceOf(42_000),
        delivery_estimate: '2026-09-13T01:00:00.000Z',
        transit_hours: null,
        confidence: 1,
      }),
    },
  ];
}

function recommendUnder(profile: WeightProfile) {
  return recommend({
    request: makeShipmentRequest(),
    candidates: pair(),
    prohibitedRanges: [],
    profile,
    preference: {},
    carriersAttempted: 2,
    now: NOW,
  });
}

describe('the weighting is responsive', () => {
  it('under CRITICAL, the ₹6,000-cheaper but 25h-slower carrier loses', () => {
    const result = recommendUnder(WEIGHT_PROFILES.CRITICAL);

    expect(result.recommendedQuoteId).toBe('quote-fast');
    expect(result.scored[1]?.quoteId).toBe('quote-cheap');
  });

  it('under LOW, the same pair reverses', () => {
    const result = recommendUnder(WEIGHT_PROFILES.LOW);

    expect(result.recommendedQuoteId).toBe('quote-cheap');
    expect(result.scored[1]?.quoteId).toBe('quote-fast');
  });

  it('reverses because cost and transit weights swapped, not because inputs changed', () => {
    // Guards against the failure mode where the reversal is real but happens for
    // the wrong reason. The sub-score *values* must be identical under both
    // profiles; only the weights and therefore the contributions may differ.
    const critical = recommendUnder(WEIGHT_PROFILES.CRITICAL);
    const low = recommendUnder(WEIGHT_PROFILES.LOW);

    const valuesOf = (result: typeof critical, quoteId: string) =>
      result.scored
        .find((one) => one.quoteId === quoteId)
        ?.subScores.map((one) => [one.key, one.value]);

    expect(valuesOf(critical, 'quote-fast')).toEqual(valuesOf(low, 'quote-fast'));
    expect(valuesOf(critical, 'quote-cheap')).toEqual(valuesOf(low, 'quote-cheap'));
  });

  it('is a narrow win under CRITICAL, and the breakdown says why', () => {
    // Worth pinning: with only a ₹6k spread the CRITICAL margin is a couple of
    // points, not a landslide. An operator reading "faster wins" should be able
    // to see it was close, so the recorded arithmetic is what makes that visible.
    const result = recommendUnder(WEIGHT_PROFILES.CRITICAL);
    const [winner, runnerUp] = result.scored;
    expect(winner).toBeDefined();
    expect(runnerUp).toBeDefined();

    const margin = winner!.finalScore - runnerUp!.finalScore;
    expect(margin).toBeGreaterThan(0);
    expect(margin).toBeLessThan(5);

    const transit = winner!.subScores.find((one) => one.key === 'transit');
    expect(transit?.inputs.formula).toContain('(deadline - arrival) / (deadline - now)');
    expect(transit?.inputs.slack_hours).toBeCloseTo(48, 5);
  });

  it('records the cost normalisation range so the row is reproducible', () => {
    const result = recommendUnder(WEIGHT_PROFILES.LOW);
    const cost = result.scored
      .find((one) => one.quoteId === 'quote-cheap')
      ?.subScores.find((one) => one.key === 'cost');

    expect(cost?.value).toBeCloseTo(100, 5);
    expect(cost?.inputs.cheapest_eligible_inr).toBe(42_000);
    expect(cost?.inputs.dearest_eligible_inr).toBe(48_000);
  });
});

// ---------------------------------------------------------------------------
// Neutral fallbacks
// ---------------------------------------------------------------------------

describe('a missing input falls back to neutral and says so', () => {
  it('scores reliability neutral with the reason, not zero and not 100', () => {
    const subScore = reliabilitySubScore(null);

    expect(subScore.value).toBe(50);
    expect(subScore.neutralFallbackReason).toContain('no machine-readable on-time figure');
    // The distinction that matters: zero would punish the carrier for our
    // ignorance, 100 would reward them for it.
    expect(subScore.value).not.toBe(0);
    expect(subScore.value).not.toBe(100);
  });

  it('uses observed history when there is any', () => {
    const subScore = reliabilitySubScore({ onTimeRate: 0.92, shipments: 25 });

    expect(subScore.value).toBeCloseTo(92, 5);
    expect(subScore.neutralFallbackReason).toBeNull();
    expect(subScore.inputs.observed_shipments).toBe(25);
  });

  it('scores lane risk neutral while the physical layer is not ingested', () => {
    const subScore = riskSubScore(null);

    expect(subScore.value).toBe(50);
    expect(subScore.neutralFallbackReason).toContain('physical layer');
  });

  it('computes lane risk from exposure once the lane is known', () => {
    const subScore = riskSubScore({ exposure: 0.4, sharedNodes: ['hub:mumbai'] });

    expect(subScore.value).toBeCloseTo(60, 5);
    expect(subScore.neutralFallbackReason).toBeNull();
  });

  it('surfaces every neutral fallback in the explanation', () => {
    const result = recommendUnder(WEIGHT_PROFILES.NORMAL);
    const lines = explainScore(result.scored[0]!, WEIGHT_PROFILES.NORMAL).join('\n');

    expect(lines).toContain('reliability');
    expect(lines).toContain('(neutral fallback)');
  });
});

describe('cold chain is scored as capability depth, not a boolean', () => {
  it('gives a full score to an ambient shipment regardless of reefer capability', () => {
    const subScore = coldChainSubScore(makeQuote(), 'ambient');

    expect(subScore.value).toBe(100);
    expect(subScore.inputs.reason).toContain('ambient');
  });

  it('ranks an active monitored reefer above one that only supports the range', () => {
    const full = coldChainSubScore(makeQuote(), '2-8C');
    const shallow = coldChainSubScore(
      makeQuote({ cold_chain: false, temperature_control: false, gdp_compliant: false }),
      '2-8C',
    );

    expect(full.value).toBe(100);
    expect(shallow.value).toBe(40);
    expect(full.value).toBeGreaterThan(shallow.value);
  });
});

// ---------------------------------------------------------------------------
// The preference, and the ranking
// ---------------------------------------------------------------------------

describe('the carrier preference is disclosed or it does not exist', () => {
  it('returns no note when there is no bonus', () => {
    expect(applyPreference('dsv', {})).toEqual({ bonus: 0, note: null });
  });

  it('cannot produce a bonus without a disclosure note', () => {
    const { bonus, note } = applyPreference('dsv', { dsv: 2 });

    expect(bonus).toBe(2);
    expect(note).toContain('DSV');
    expect(note).toContain('disclosed');
  });

  it('applies the bonus to the final score and shows it in the breakdown', () => {
    const result = recommend({
      request: makeShipmentRequest(),
      candidates: pair(),
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: { mock: 2 },
      carriersAttempted: 2,
      now: NOW,
    });

    const winner = result.scored[0]!;
    expect(winner.preferenceBonus).toBe(2);
    expect(winner.finalScore).toBeCloseTo(winner.weightedScore + 2, 5);
    expect(explainScore(winner, WEIGHT_PROFILES.NORMAL).join('\n')).toContain(
      'Operator preference applied',
    );
  });

  it('breaks ties on merit rather than reversing them', () => {
    // Two carriers tie on the weighted score; only one has a bonus. The bonus
    // decides. But when the bonus makes them equal, the one that earned more
    // without it must come first.
    const merit = scoreCandidate({
      quoteId: 'q-merit',
      carrierId: 'fedex',
      carrierDisplay: 'Merit',
      service: 'Air',
      subScores: [
        { key: 'cost', value: 60, inputs: {}, neutralFallbackReason: null },
        { key: 'transit', value: 60, inputs: {}, neutralFallbackReason: null },
        { key: 'reliability', value: 60, inputs: {}, neutralFallbackReason: null },
        { key: 'cold_chain', value: 60, inputs: {}, neutralFallbackReason: null },
        { key: 'risk', value: 60, inputs: {}, neutralFallbackReason: null },
        { key: 'service', value: 60, inputs: {}, neutralFallbackReason: null },
      ],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: {},
    });
    const bonused = scoreCandidate({
      quoteId: 'q-bonus',
      carrierId: 'dsv',
      carrierDisplay: 'Bonused',
      service: 'Air',
      subScores: [
        { key: 'cost', value: 58, inputs: {}, neutralFallbackReason: null },
        { key: 'transit', value: 58, inputs: {}, neutralFallbackReason: null },
        { key: 'reliability', value: 58, inputs: {}, neutralFallbackReason: null },
        { key: 'cold_chain', value: 58, inputs: {}, neutralFallbackReason: null },
        { key: 'risk', value: 58, inputs: {}, neutralFallbackReason: null },
        { key: 'service', value: 58, inputs: {}, neutralFallbackReason: null },
      ],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: { dsv: 2 },
    });

    // 60 vs 58 + 2 = a dead heat on the final score, so merit decides.
    expect(bonused.finalScore).toBeCloseTo(merit.finalScore, 5);
    expect(rankCandidates([bonused, merit])[0]?.quoteId).toBe('q-merit');
  });
});

// ---------------------------------------------------------------------------
// Coverage and the null recommendation
// ---------------------------------------------------------------------------

describe('nothing is dropped from the comparison', () => {
  it('lists ineligible carriers with no score at all', () => {
    const candidates = pair();
    // Make the cheap one miss the deadline outright.
    const late: QuoteWithCapabilities = {
      ...candidates[1]!,
      quote: makeQuote({
        id: 'quote-cheap',
        provider: 'mock',
        provider_display: 'Cheap Carrier',
        delivery_estimate: '2026-09-30T00:00:00.000Z',
      }),
    };

    const result = recommend({
      request: makeShipmentRequest(),
      candidates: [candidates[0]!, late],
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: {},
      carriersAttempted: 2,
      now: NOW,
    });

    expect(result.eligibility).toHaveLength(2);
    expect(result.eligibility.find((one) => one.quoteId === 'quote-cheap')?.result.isEligible).toBe(
      false,
    );
    // The ineligible carrier is visible but unscored: a low score would imply it
    // was considered on the merits and merely lost.
    expect(result.scored.map((one) => one.quoteId)).toEqual(['quote-fast']);
  });

  it('counts providers, not quotes', () => {
    // The bug this pins: one carrier offering road, air and express is ONE
    // carrier that quoted. Counting quotes reported "3 of 7 providers" for a
    // single carrier — overstating coverage threefold on exactly the metric that
    // exists to stop coverage being overstated.
    const oneCarrierThreeServices = pair().map((candidate) => ({
      ...candidate,
      quote: {
        ...candidate.quote,
        provider: 'mock' as const,
        provider_display: 'One Carrier',
      },
    }));

    const result = recommend({
      request: makeShipmentRequest(),
      candidates: oneCarrierThreeServices,
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: {},
      carriersAttempted: 7,
      now: NOW,
    });

    expect(result.carriersQuoted).toBe(1);
    expect(result.coverageNote).toContain('1 of 7 providers: One Carrier');
    // Both services are still scored — only the *coverage* count collapses.
    expect(result.scored).toHaveLength(2);
  });

  it('states the coverage ratio in words, even when coverage is complete', () => {
    const complete = recommendUnder(WEIGHT_PROFILES.NORMAL);
    expect(complete.coverageNote).toContain('2 of 2 providers');
    // Named, not just counted, so a mock's own display name does the disclosing.
    expect(complete.coverageNote).toContain('Fast Carrier, Cheap Carrier');
    expect(complete.coverageNote).toContain('Every provider attempted returned a quote');
  });

  it('counts carriers that returned nothing against the attempted total', () => {
    const result = recommend({
      request: makeShipmentRequest(),
      candidates: pair(),
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: {},
      // Six carriers attempted, two replied. The other four are invisible to
      // this function but must not be invisible to the reader.
      carriersAttempted: 6,
      now: NOW,
    });

    expect(result.coverageNote).toContain('2 of 6 providers');
    expect(result.coverageNote).toContain('4 returned no quote');
    expect(result.carriersQuoted).toBe(2);
  });

  it('returns a null recommendation rather than relaxing a constraint', () => {
    // No carrier can hold 2-8 °C. That is a finding, not an error, and it must
    // not be papered over by dropping the temperature requirement.
    const result = recommend({
      request: makeShipmentRequest({ temperature_requirement: '2-8C' }),
      candidates: pair().map((candidate) => ({
        ...candidate,
        capabilities: makeCapabilities({ temperature_ranges: ['ambient'] }),
      })),
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.CRITICAL,
      preference: {},
      carriersAttempted: 2,
      now: NOW,
    });

    expect(result.recommendedQuoteId).toBeNull();
    expect(result.scored).toEqual([]);
    expect(result.counterfactual).toBeNull();
    expect(
      result.eligibility.every((one) =>
        one.result.failures.some((failure) => failure.reason === 'temperature_unsupported'),
      ),
    ).toBe(true);
  });
});

describe('the counterfactual', () => {
  it('states what the runner-up would have cost and saved', () => {
    const result = recommendUnder(WEIGHT_PROFILES.CRITICAL);
    const counterfactual = result.counterfactual!;

    expect(counterfactual.runnerUpQuoteId).toBe('quote-cheap');
    expect(counterfactual.priceDeltaInr).toBe(6000);
    expect(counterfactual.transitDeltaHours).toBeCloseTo(-25, 5);
    expect(counterfactual.verdict).toContain('costs INR 6,000');
    expect(counterfactual.verdict).toContain('25.0h earlier');
  });

  it('is absent when there is only one eligible carrier', () => {
    const result = recommend({
      request: makeShipmentRequest(),
      candidates: [pair()[0]!],
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.NORMAL,
      preference: {},
      carriersAttempted: 1,
      now: NOW,
    });

    expect(result.recommendedQuoteId).toBe('quote-fast');
    // Inventing a comparison against an option that was never available would
    // be worse than admitting there was nothing to compare against.
    expect(result.counterfactual).toBeNull();
  });
});

describe('cost is normalised against the eligible set, not the whole set', () => {
  it('ignores an ineligible carrier when setting the cheapest price', () => {
    // A ₹10,000 quote that fails the gate must not become the yardstick that
    // makes every eligible option look expensive.
    const candidates = pair();
    const cheapButLate: QuoteWithCapabilities = {
      ...candidates[0]!,
      quote: makeQuote({
        id: 'quote-late',
        provider: 'fedex',
        provider_display: 'Late and cheap',
        price: {
          value: 10_000,
          unit: 'INR',
          tag: 'SCENARIO',
          provenance: { ...makeQuote().provenance, calculation_method: 'test rate card' },
        },
        delivery_estimate: '2026-09-30T00:00:00.000Z',
        confidence: 1,
      }),
    };

    const result = recommend({
      request: makeShipmentRequest(),
      candidates: [...candidates, cheapButLate],
      prohibitedRanges: [],
      profile: WEIGHT_PROFILES.LOW,
      preference: {},
      carriersAttempted: 3,
      now: NOW,
    });

    const cost = result.scored[0]?.subScores.find((one) => one.key === 'cost');
    expect(cost?.inputs.cheapest_eligible_inr).toBe(42_000);
    expect(DEADLINE).toBe('2026-09-14T00:00:00.000Z');
  });
});
