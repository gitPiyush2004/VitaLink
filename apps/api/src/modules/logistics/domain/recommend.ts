/**
 * The recommendation, assembled from quotes (spec 6.6, 6.9, 6.13).
 *
 * This is the whole DECIDE step for logistics, and it is deliberately a pure
 * function of `(request, quotes, capabilities, urgency inputs, now)`. The service
 * above it does the I/O — fan out to carriers, persist the result — and none of
 * the judgement lives there. That split is what makes the sanity check in
 * `__tests__/score.test.ts` possible: the spec's "cheaper but slower must lose
 * under CRITICAL and win under LOW" is a two-line assertion against this function
 * rather than an integration test with mocked HTTP.
 *
 * ## Nothing is dropped
 *
 * Every carrier attempted appears in `eligibility`, including the ones that
 * returned nothing. A comparison table that silently omitted the three carriers
 * we have no credentials for would read as "these are the three options", which
 * is false — they are the three options *we could see*. `coverage_note` states
 * that ratio in words on every recommendation.
 *
 * ## NO_ELIGIBLE_CARRIER is an answer
 *
 * When the gate eliminates everyone, `recommendedQuoteId` is null and the
 * failures explain why. That is a finding — "no carrier can hold 2-8 °C to
 * Frankfurt by Friday" is exactly what an operator needs to hear — and it is not
 * an error, and it must never be papered over by relaxing a constraint that the
 * operator did not choose to relax.
 */

import type {
  CarrierCapabilities,
  CarrierId,
  CarrierQuote,
  ShipmentRequest,
  TemperatureRange,
} from '@vitalink/contracts';

import { MS_PER_HOUR } from '@config/constants';
import type { WeightProfile } from '@config/weights';

import { checkEligibility, type GateResult } from './eligibility-gate';
import { rankCandidates, scoreCandidate, type ScoredCandidate } from './score';
import {
  coldChainSubScore,
  costSubScore,
  reliabilitySubScore,
  riskSubScore,
  serviceSubScore,
  transitSubScore,
  type SubScore,
} from './sub-scores';

/** What one carrier returned, plus what its published capabilities say. */
export type QuoteWithCapabilities = {
  quote: CarrierQuote;
  capabilities: CarrierCapabilities;
  /**
   * Observed on-time performance from Vitalink's own tracking history, or null.
   * Null in the MVP for every carrier: tracking ingestion is a later phase, and
   * the reliability sub-score says so on its row rather than guessing.
   */
  observedReliability: { onTimeRate: number; shipments: number } | null;
  /**
   * Exposure of this carrier's lane to the same shock, or null when the lane's
   * nodes cannot be mapped onto the graph. Null in the MVP — see `riskSubScore`.
   */
  laneExposure: { exposure: number; sharedNodes: string[] } | null;
};

export type RecommendInput = {
  request: ShipmentRequest;
  candidates: QuoteWithCapabilities[];
  /** Ranges the drug's label forbids, from the label parser. */
  prohibitedRanges: TemperatureRange[];
  profile: WeightProfile;
  /** Carrier id to bonus points. Empty unless an operator configured one. */
  preference: Record<string, number>;
  /** Carriers we tried, including ones that returned nothing at all. */
  carriersAttempted: number;
  now: Date;
};

export type Counterfactual = {
  runnerUpQuoteId: string;
  runnerUpDisplay: string;
  runnerUpScore: number;
  priceDeltaInr: number;
  transitDeltaHours: number;
  verdict: string;
};

export type Recommendation = {
  recommendedQuoteId: string | null;
  profile: WeightProfile;
  eligibility: { quoteId: string; carrierId: CarrierId; result: GateResult }[];
  scored: ScoredCandidate[];
  counterfactual: Counterfactual | null;
  coverageNote: string;
  carriersAttempted: number;
  carriersQuoted: number;
};

/**
 * The quote's price, or zero for an unpriced one.
 *
 * Only ever called on a quote that passed the gate, and rule 7 eliminates an
 * unpriced quote — so the zero is unreachable rather than a silent default.
 */
function priceOf(quote: CarrierQuote): number {
  return quote.price?.value ?? 0;
}

/** Arrival instant from the delivery estimate, or from transit hours, or null. */
function arrivalMs(quote: CarrierQuote, now: Date): number | null {
  if (quote.delivery_estimate !== null) return Date.parse(quote.delivery_estimate);
  if (quote.transit_hours !== null) return now.getTime() + quote.transit_hours.value * MS_PER_HOUR;
  return null;
}

/**
 * All six sub-scores for one candidate.
 *
 * `eligiblePrices` is the whole eligible set because cost is normalised against
 * the options actually available, not against an absolute idea of a fair price.
 * Which means this cannot be computed per-candidate in isolation — hence the
 * two-pass structure in `recommend`.
 */
export function buildSubScores(
  candidate: QuoteWithCapabilities,
  input: RecommendInput,
  eligiblePrices: number[],
): SubScore[] {
  return [
    costSubScore(candidate.quote, eligiblePrices),
    transitSubScore(candidate.quote, input.request.required_delivery_deadline, input.now),
    reliabilitySubScore(candidate.observedReliability),
    coldChainSubScore(candidate.quote, input.request.temperature_requirement),
    riskSubScore(candidate.laneExposure),
    serviceSubScore(candidate.quote),
  ];
}

/**
 * The counterfactual: what the runner-up would have cost and saved (spec 6.13).
 *
 * Present only when there is a runner-up. A single eligible carrier has no
 * counterfactual, and inventing one against an ineligible carrier would compare
 * the recommendation against an option that was never available.
 *
 * The cover-days and avoided-loss deltas from spec 6.13 are absent here: they
 * need the cascade's cover projection, which the service joins on. The verdict
 * therefore talks only about price and time, which are the two quantities this
 * function can actually see.
 */
export function buildCounterfactual(
  ranked: ScoredCandidate[],
  byQuoteId: Map<string, QuoteWithCapabilities>,
  now: Date,
): Counterfactual | null {
  const [winner, runnerUp] = ranked;
  if (winner === undefined || runnerUp === undefined) return null;

  const winnerQuote = byQuoteId.get(winner.quoteId)?.quote;
  const runnerUpQuote = byQuoteId.get(runnerUp.quoteId)?.quote;
  if (winnerQuote === undefined || runnerUpQuote === undefined) return null;

  const priceDelta = priceOf(winnerQuote) - priceOf(runnerUpQuote);
  const transitDelta = transitDeltaHours(winnerQuote, runnerUpQuote, now);

  return {
    runnerUpQuoteId: runnerUp.quoteId,
    runnerUpDisplay: runnerUp.carrierDisplay,
    runnerUpScore: runnerUp.finalScore,
    priceDeltaInr: priceDelta,
    transitDeltaHours: transitDelta,
    verdict:
      `The recommendation ${describeMoney(priceDelta)} ${runnerUp.carrierDisplay}, and ` +
      `${describeTime(transitDelta)}. Scores ${winner.finalScore.toFixed(1)} against ` +
      `${runnerUp.finalScore.toFixed(1)}.`,
  };
}

/**
 * Hours the recommendation arrives after the runner-up. Negative means earlier.
 *
 * Zero when either arrival is unknown, which is honest rather than convenient:
 * an unknown difference is not a difference we can state, and the verdict says
 * "arrives at the same time" rather than inventing a gap.
 */
function transitDeltaHours(winner: CarrierQuote, runnerUp: CarrierQuote, now: Date): number {
  const winnerArrival = arrivalMs(winner, now);
  const runnerUpArrival = arrivalMs(runnerUp, now);
  if (winnerArrival === null || runnerUpArrival === null) return 0;
  return (winnerArrival - runnerUpArrival) / MS_PER_HOUR;
}

/**
 * Phrased from the recommendation's point of view, so "costs INR 6,000 more and
 * arrives 25h earlier" reads as the trade the operator is being asked to accept.
 */
function describeMoney(priceDelta: number): string {
  if (priceDelta === 0) return 'costs the same as';
  const verb = priceDelta > 0 ? 'costs' : 'saves';
  return `${verb} INR ${Math.abs(priceDelta).toLocaleString('en-IN')} against`;
}

function describeTime(transitDelta: number): string {
  if (transitDelta === 0) return 'arrives at the same time';
  const direction = transitDelta < 0 ? 'earlier' : 'later';
  return `arrives ${Math.abs(transitDelta).toFixed(1)}h ${direction}`;
}

/**
 * The coverage note (spec 6.9).
 *
 * Reads "Recommended from 1 of 7 providers: Mock Carrier (development only). 6
 * returned no quote — see the reason on each row."
 *
 * Always rendered, including when coverage is complete, because a reader should
 * never have to infer from the *absence* of a caveat that there was nothing to
 * caveat.
 *
 * Two details here were wrong in the first version and are worth stating.
 *
 * It counts **distinct providers**, not quotes. One carrier returning three
 * service options is one provider, and an earlier version that counted quotes
 * reported "3 of 7 providers" for a single carrier — overstating coverage
 * threefold on exactly the metric that exists to stop coverage being overstated.
 *
 * It **names** the providers that quoted. That is what keeps the mock honest
 * without this function needing to know what a mock is: its display name says
 * "development only", so naming the source makes the disclosure travel with the
 * note into any screenshot or report.
 */
export function buildCoverageNote(input: {
  attempted: number;
  quotedProviders: string[];
  eligibleProviders: number;
}): string {
  const quoted = input.quotedProviders.length;
  const unavailable = input.attempted - quoted;

  const head =
    quoted === 0
      ? `No quote was obtained from any of the ${String(input.attempted)} providers attempted.`
      : `Recommended from ${String(quoted)} of ${String(input.attempted)} providers: ` +
        `${input.quotedProviders.join(', ')}.`;

  const tail =
    unavailable > 0
      ? ` ${String(unavailable)} returned no quote — see the reason on each row.`
      : ' Every provider attempted returned a quote.';

  const ineligible = quoted - input.eligibleProviders;
  const gate =
    ineligible === 0
      ? ''
      : ` ${String(ineligible)} of the providers that did quote ` +
        `${ineligible === 1 ? 'was' : 'were'} ruled ineligible by a hard constraint.`;

  return head + tail + gate;
}

/**
 * The display names of the providers that returned a price, deduplicated.
 *
 * One carrier offering road, air and express is one provider that quoted, which
 * is the whole reason this is a Map keyed by provider rather than a count.
 */
function distinctProviders(candidates: QuoteWithCapabilities[]): string[] {
  return [
    ...new Map(
      candidates
        .filter((candidate) => candidate.quote.price !== null)
        .map((candidate) => [candidate.quote.provider, candidate.quote.provider_display]),
    ).values(),
  ];
}

/**
 * Gates, scores and ranks every candidate.
 *
 * Two passes, because cost is normalised against the eligible set: the gate has
 * to finish for every candidate before any cost sub-score can be computed. A
 * one-pass version would normalise against a set that grew as it went, and the
 * first carrier's cost score would depend on the order the carriers replied in.
 */
export function recommend(input: RecommendInput): Recommendation {
  const eligibility = input.candidates.map((candidate) => ({
    quoteId: candidate.quote.id,
    carrierId: candidate.quote.provider,
    result: checkEligibility({
      request: input.request,
      quote: candidate.quote,
      capabilities: candidate.capabilities,
      prohibitedRanges: input.prohibitedRanges,
      now: input.now,
    }),
  }));

  const eligibleIds = new Set(
    eligibility.filter((one) => one.result.isEligible).map((one) => one.quoteId),
  );
  const eligible = input.candidates.filter((candidate) => eligibleIds.has(candidate.quote.id));
  const eligiblePrices = eligible
    .map((candidate) => candidate.quote.price?.value)
    .filter((price): price is number => price !== undefined);

  const scored = eligible.map((candidate) =>
    scoreCandidate({
      quoteId: candidate.quote.id,
      carrierId: candidate.quote.provider,
      carrierDisplay: candidate.quote.provider_display,
      service: candidate.quote.service,
      subScores: buildSubScores(candidate, input, eligiblePrices),
      profile: input.profile,
      preference: input.preference,
    }),
  );

  const ranked = rankCandidates(scored);
  const byQuoteId = new Map(input.candidates.map((candidate) => [candidate.quote.id, candidate]));

  const quotedProviders = distinctProviders(input.candidates);
  const eligibleProviders = new Set(eligible.map((candidate) => candidate.quote.provider)).size;

  return {
    recommendedQuoteId: ranked[0]?.quoteId ?? null,
    profile: input.profile,
    eligibility,
    scored: ranked,
    counterfactual: buildCounterfactual(ranked, byQuoteId, input.now),
    coverageNote: buildCoverageNote({
      attempted: input.carriersAttempted,
      quotedProviders,
      eligibleProviders,
    }),
    carriersAttempted: input.carriersAttempted,
    carriersQuoted: quotedProviders.length,
  };
}
