/**
 * Building the joint (sourcing x logistics) scenario matrix (spec 6.11).
 *
 * A scenario is a pair: what we do about supply, and who physically moves it.
 * The matrix is the cross product, which is why it needs a cap — five sourcing
 * options against seven carriers is thirty-five rows before anything is scored.
 *
 * ## DO_NOTHING is mandatory and is always the baseline
 *
 * Every other scenario is reported as a delta against it. That is not a
 * formality: "spend ₹40,000 and get 12 more days of cover" is a decision an
 * operator can make, and "expected shortage 0.31" on its own is not. A matrix
 * without a baseline is a list of numbers with nothing to compare them to.
 *
 * ## What is derived and what is assumed
 *
 * The honest accounting, because this file is where the temptation to invent is
 * strongest — a scenario engine can produce any number you like.
 *
 * DERIVED from real data: expected shortage and fragility (from the cascade's
 * exposure, which came from openFDA listings), days of cover (from the cascade's
 * projection), freight cost and transit (from the carrier quotes), CO2 (from
 * published tonne-km emission factors), recovery days (from the Tucker-Daskin
 * mean-uptime figure the Python service computes).
 *
 * SCENARIO — the operator's assumption, no default: how many units an
 * intervention adds, what it costs, and how long it takes to start delivering.
 * No public source states any of those for a specific plant, and a default would
 * be the single most consequential invisible number in the system.
 *
 * NOT AVAILABLE, and reported null rather than guessed: facilities at risk,
 * population affected, and rupee loss. All three need the physical layer —
 * geocoded facilities and district populations — which is not ingested. A
 * plausible-looking "₹2.4 crore avoided loss" would be the most quotable number
 * this system produces and would be entirely fabricated.
 *
 * Pure functions.
 */

import { derived, type Quantity } from '@vitalink/contracts';

import { MAX_SCENARIOS_PER_MATRIX, MS_PER_HOUR } from '@config/constants';

import { co2, coverBand, expectedShortage, recoveryDays } from './outcome-terms';

const PERCENT = 100;
/**
 * The multiplier on an NLEM-critical drug's impact.
 *
 * Two, because doubling is the least arbitrary way to say "this one matters
 * more" without claiming a measured ratio. The NLEM list is not ingested yet, so
 * the flag is false for every drug in the catalogue and the term is currently
 * inert — which the calculation method states.
 */
const NLEM_MULTIPLIER = 2;

/** The provenance stub every derived field on a scenario inherits. */
export type DerivationSource = { name: string; url: string; query: null; fetchedAt: string };

/** One sourcing option the operator has described. */
export type SourcingOption = {
  kind:
    | 'DO_NOTHING'
    | 'ALTERNATE_SUPPLIER'
    | 'REALLOCATE_FROM_HUB'
    | 'INCREASE_SAFETY_STOCK'
    | 'QUALIFY_SECOND_SOURCE';
  label: string;
  targetNodeId: string | null;
  /** The operator's assumptions. No defaults — see the file header. */
  leadTimeDays: number;
  interventionCostInr: number;
  /** How much of the shortage this intervention closes, as a fraction in [0,1]. */
  shortageReductionFraction: number;
};

/** One carrier option, from the logistics recommendation. */
export type CarrierOption = {
  quoteId: string;
  carrierId: string;
  carrierDisplay: string;
  service: string;
  quoteStatus: string;
  priceInr: number;
  transitHours: number;
  arrivalIso: string | null;
  mode: string;
};

/** What the cascade contributes about this drug at this shock. */
export type CascadeFacts = {
  drugId: string;
  drugLabel: string;
  cascadeId: string;
  /** Exposure in [0,1], DERIVED by the cascade from live listings. */
  exposure: number;
  exposureMethod: string;
  coverDaysLow: number;
  coverDaysHigh: number;
  /** Mean uptime from the reliability model, or null when it was not computed. */
  meanUptimeDays: number | null;
  isNlemCritical: boolean;
  /** Consignment weight, for the CO2 term. The operator's figure. */
  weightKg: number;
  /** Great-circle or routed distance in km, or null when geography is unknown. */
  distanceKm: number | null;
  /**
   * How long the shock lasts, from the cascade request.
   *
   * Needed because DO_NOTHING has no lead time, and reporting its recovery as
   * zero made doing nothing look like instant recovery — see `recoveryDays`.
   */
  shockDurationDays: number;
};

export type Scenario = {
  id: string;
  label: string;
  sourcing: SourcingOption;
  logistics: CarrierOption | null;
  isBaseline: boolean;
  outcome: OutcomeVector;
};

/**
 * Every scenario produces exactly these fields, so the comparison is a matrix.
 *
 * The three nulls are the point. A field that cannot be computed is null with
 * `unavailable` naming it, rather than zero — because zero facilities at risk
 * and unknown facilities at risk are opposite claims, and a table of zeros
 * reads as the reassuring one.
 */
export type OutcomeVector = {
  expectedShortage: Quantity;
  fragilityIndex: Quantity;
  daysOfCoverBand: Quantity;
  recoveryDays: Quantity;
  criticalityWeightedImpact: Quantity;
  logisticsCostInr: Quantity | null;
  transitHours: Quantity | null;
  arrivalEstimate: string | null;
  deadlineMet: boolean | null;
  co2Kg: Quantity | null;
  quoteStatusWorst: string | null;
  totalCostInr: number;
  /** Fields that could not be computed, each with the reason. */
  unavailable: { field: string; reason: string }[];
};

export type EnumerateInput = {
  facts: CascadeFacts;
  sourcing: SourcingOption[];
  carriers: CarrierOption[];
  deadlineIso: string;
  now: Date;
  provenanceUrl: string;
};

export type EnumerateResult = {
  scenarios: Scenario[];
  /** Non-null when the cap truncated the matrix. Never silent. */
  truncation: string | null;
};

/**
 * The cross product, capped and with the truncation reported.
 *
 * DO_NOTHING is paired with `null` logistics — doing nothing ships nothing — and
 * is always first, so the baseline survives any truncation. Everything else is
 * ordered cheapest-carrier-first inside each sourcing option, so a cap keeps the
 * options most likely to matter.
 */
export function enumerateScenarios(input: EnumerateInput): EnumerateResult {
  const baselineOption = input.sourcing.find((one) => one.kind === 'DO_NOTHING');
  if (baselineOption === undefined) {
    throw new Error(
      'the scenario matrix must include a DO_NOTHING option: every other row is reported as a ' +
        'delta against it, and a matrix without a baseline is a list of numbers with nothing ' +
        'to compare them to',
    );
  }

  const baseline: Scenario = {
    id: `${input.facts.cascadeId}:do-nothing`,
    label: baselineOption.label,
    sourcing: baselineOption,
    logistics: null,
    isBaseline: true,
    outcome: buildOutcome(baselineOption, null, input),
  };

  const cheapestFirst = [...input.carriers].sort((left, right) => left.priceInr - right.priceInr);
  const interventions = input.sourcing.filter((one) => one.kind !== 'DO_NOTHING');

  const paired: Scenario[] = [];
  for (const option of interventions) {
    for (const carrier of cheapestFirst) {
      paired.push({
        id: `${input.facts.cascadeId}:${option.kind.toLowerCase()}:${carrier.quoteId}`,
        label: `${option.label} via ${carrier.carrierDisplay} ${carrier.service}`,
        sourcing: option,
        logistics: carrier,
        isBaseline: false,
        outcome: buildOutcome(option, carrier, input),
      });
    }
  }

  const room = MAX_SCENARIOS_PER_MATRIX - 1;
  const kept = paired.slice(0, room);

  return {
    scenarios: [baseline, ...kept],
    truncation:
      paired.length <= room
        ? null
        : `The matrix was capped at ${String(MAX_SCENARIOS_PER_MATRIX)} scenarios: ` +
          `${String(interventions.length)} sourcing option(s) against ` +
          `${String(input.carriers.length)} carrier quote(s) is ${String(paired.length)} pairs, ` +
          `so ${String(paired.length - room)} were dropped. Carriers were ordered cheapest ` +
          'first, so the dropped pairs are the most expensive ones. The baseline is never ' +
          'dropped.',
  };
}

/**
 * The outcome fields this system cannot compute, each with the reason.
 *
 * A table rather than a set of nulls scattered through the assembly, because
 * this list is the most important thing the scenario engine says about itself. A
 * scenario engine can produce any number you like; what makes one trustworthy is
 * the part where it declines.
 *
 * Every entry names what is missing and *why*, so the UI can render an empty
 * state that explains itself instead of a zero that reassures.
 */
export function unavailableFields(co2Reason: string | null): { field: string; reason: string }[] {
  return [
    {
      field: 'facilities_at_risk',
      reason:
        'Needs the physical layer: which facilities depend on this drug, and where they are. ' +
        'Not ingested in the MVP. Zero would read as "no facilities at risk", which is the ' +
        'opposite of what is true.',
    },
    {
      field: 'population_band',
      reason:
        'Needs district populations joined to facility catchments. Neither is ingested, and a ' +
        'population figure is the most quotable number this system could produce.',
    },
    {
      field: 'loss_inr_band',
      reason:
        'Needs a rupee value per unit short, which requires NPPA ceiling prices joined to ' +
        'demand. The NPPA client is not built, so there is no honest rupee basis.',
    },
    {
      field: 'cold_chain_excursion_prob',
      reason:
        'Needs per-lane temperature history and carrier excursion rates. No carrier publishes ' +
        'the second, and the first needs the physical layer.',
    },
    ...(co2Reason === null ? [] : [{ field: 'co2_kg', reason: co2Reason }]),
  ];
}

/** Assembles one row of the matrix. */
function buildOutcome(
  option: SourcingOption,
  carrier: CarrierOption | null,
  input: EnumerateInput,
): OutcomeVector {
  const at = input.now.toISOString();
  const source = {
    name: 'Vitalink scenario engine',
    url: input.provenanceUrl,
    query: null,
    fetchedAt: at,
  };

  const shortage = expectedShortage(option, input.facts, source);
  const emissions =
    carrier === null ? { quantity: null, reason: null } : co2(carrier, input.facts, source);

  return {
    ...supplyTerms(option, input.facts, shortage, source),
    ...logisticsTerms(carrier, emissions.quantity, input),
    // Intervention cost plus freight. The axis an operator trades against
    // shortage on the Pareto plot.
    totalCostInr: option.interventionCostInr + (carrier?.priceInr ?? 0),
    unavailable: unavailableFields(emissions.reason),
  };
}

/** The supply half: what the intervention does to shortage, cover and recovery. */
function supplyTerms(
  option: SourcingOption,
  facts: CascadeFacts,
  shortage: Quantity,
  source: DerivationSource,
): Pick<
  OutcomeVector,
  | 'expectedShortage'
  | 'fragilityIndex'
  | 'daysOfCoverBand'
  | 'recoveryDays'
  | 'criticalityWeightedImpact'
> {
  return {
    expectedShortage: shortage,
    fragilityIndex: derived({
      value: shortage.value * PERCENT,
      unit: 'percent',
      source,
      method: 'fragility index = expected shortage * 100, per the reliability model definition.',
    }),
    daysOfCoverBand: coverBand(option, facts, source),
    recoveryDays: recoveryDays(option, facts, source),
    criticalityWeightedImpact: derived({
      value: shortage.value * (facts.isNlemCritical ? NLEM_MULTIPLIER : 1),
      unit: 'score_0_1',
      source,
      method:
        "expected shortage, doubled when the drug is on India's National List of Essential " +
        `Medicines. Here NLEM-critical = ${String(facts.isNlemCritical)}. The NLEM list is not ` +
        'ingested yet, so this flag is false for every drug in the current catalogue and the ' +
        'term is currently inert.',
    }),
  };
}

/**
 * The logistics terms for a scenario that ships nothing.
 *
 * Null rather than zero, and the distinction is load-bearing: a freight cost of
 * zero on the DO_NOTHING row would make the baseline look like the cheapest
 * option on a cost axis it does not appear on at all.
 */
const SHIPS_NOTHING = {
  logisticsCostInr: null,
  transitHours: null,
  arrivalEstimate: null,
  deadlineMet: null,
  co2Kg: null,
  quoteStatusWorst: null,
} as const;

/** The logistics half. Every field is null when the scenario ships nothing. */
function logisticsTerms(
  carrier: CarrierOption | null,
  co2Quantity: Quantity | null,
  input: EnumerateInput,
): Pick<
  OutcomeVector,
  | 'logisticsCostInr'
  | 'transitHours'
  | 'arrivalEstimate'
  | 'deadlineMet'
  | 'co2Kg'
  | 'quoteStatusWorst'
> {
  if (carrier === null) return SHIPS_NOTHING;

  const source: DerivationSource = {
    name: 'Vitalink scenario engine',
    url: input.provenanceUrl,
    query: null,
    fetchedAt: input.now.toISOString(),
  };

  return {
    logisticsCostInr: derived({
      value: carrier.priceInr,
      unit: 'INR',
      source,
      method:
        `Carrier quote ${carrier.quoteId} from ${carrier.carrierDisplay}, ` +
        `status ${carrier.quoteStatus}.`,
    }),
    transitHours: derived({
      value: carrier.transitHours,
      unit: 'hours',
      source,
      method: `Transit time as quoted by ${carrier.carrierDisplay}.`,
    }),
    arrivalEstimate: carrier.arrivalIso,
    deadlineMet: arrivalMs(carrier, input.now) <= Date.parse(input.deadlineIso),
    co2Kg: co2Quantity,
    quoteStatusWorst: carrier.quoteStatus,
  };
}

function arrivalMs(carrier: CarrierOption, now: Date): number {
  if (carrier.arrivalIso !== null) return Date.parse(carrier.arrivalIso);
  return now.getTime() + carrier.transitHours * MS_PER_HOUR;
}

/**
 * The chosen scenario against the baseline, field by field.
 *
 * Only the fields both rows actually have. A delta against a null is not zero,
 * and reporting it as zero would say "this intervention changes nothing about
 * population at risk" when the truth is that neither row knows.
 */
export function deltaVsBaseline(chosen: Scenario, baseline: Scenario): Record<string, number> {
  const delta: Record<string, number> = {
    expected_shortage:
      chosen.outcome.expectedShortage.value - baseline.outcome.expectedShortage.value,
    fragility_index: chosen.outcome.fragilityIndex.value - baseline.outcome.fragilityIndex.value,
    days_of_cover: chosen.outcome.daysOfCoverBand.value - baseline.outcome.daysOfCoverBand.value,
    recovery_days: chosen.outcome.recoveryDays.value - baseline.outcome.recoveryDays.value,
    total_cost_inr: chosen.outcome.totalCostInr - baseline.outcome.totalCostInr,
  };

  if (chosen.outcome.co2Kg !== null && baseline.outcome.co2Kg !== null) {
    delta.co2_kg = chosen.outcome.co2Kg.value - baseline.outcome.co2Kg.value;
  }

  return delta;
}
