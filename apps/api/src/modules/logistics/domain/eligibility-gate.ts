/**
 * The eligibility gate (spec 6.6). Nine hard constraints.
 *
 * ## Hard constraints eliminate; they do not reduce a score
 *
 * That distinction is the whole design. A carrier that cannot hold 2-8 °C is not
 * "a worse option" — it is not an option, and giving it a low score would imply
 * it was considered on the merits and merely lost. So an ineligible carrier
 * appears in the comparison table marked NOT ELIGIBLE, **with its reason and with
 * no score at all**.
 *
 * ## Every failure is reported, not just the first
 *
 * The gate does not short-circuit. A carrier that misses the deadline *and*
 * cannot hold the temperature *and* does not serve the lane has three problems,
 * and a supply chain manager deciding whether to phone them needs all three. A
 * gate that returned only "deadline_miss" would send someone to negotiate a
 * faster service from a carrier that could never carry the product anyway.
 *
 * The single exception is rule 7. A carrier that returned no quote at all has
 * nothing for the other rules to read, so they would each report a failure
 * derived from an empty payload — "misses the deadline", "supports no
 * temperature range" — which reads as eight findings where there is really one.
 * See `checkEligibility`.
 *
 * ## `'unknown'` fails a constraint that requires the capability
 *
 * This is the rule that keeps the tri-state honest. If a carrier's documentation
 * does not state GDP compliance, requiring GDP eliminates them. Treating unknown
 * as "probably fine" would put a pharmaceutical shipment on a carrier whose
 * handling nobody has verified — and the whole reason capabilities are a
 * tri-state is so that a guess cannot masquerade as a fact.
 *
 * Pure functions throughout. `now` is passed in, so a deadline test does not
 * depend on when it runs.
 */

import type {
  CapabilityFlag,
  CarrierCapabilities,
  CarrierQuote,
  IneligibilityReason,
  ShipmentRequest,
  TemperatureRange,
} from '@vitalink/contracts';

export type GateInput = {
  request: ShipmentRequest;
  quote: CarrierQuote;
  capabilities: CarrierCapabilities;
  /**
   * Temperature ranges the drug's label explicitly forbids — cisplatin's "do not
   * refrigerate". A carrier whose only service is refrigerated is wrong for it.
   */
  prohibitedRanges: TemperatureRange[];
  now: Date;
};

export type GateFailure = { reason: IneligibilityReason; detail: string };

export type GateResult = {
  isEligible: boolean;
  /** Every failure, in the order the rules are numbered in the spec. */
  failures: GateFailure[];
};

/** A capability satisfies a requirement only when it is explicitly `true`. */
function isSatisfied(flag: CapabilityFlag): boolean {
  return flag === true;
}

/**
 * Rule 1: the arrival estimate must not be after the deadline.
 *
 * Compares absolute instants, which is why `ShipmentRequest` carries an ISO
 * `required_delivery_deadline` rather than "72 hours" — a relative duration would
 * need a reference point, and two parts of the system would pick different ones.
 */
function checkDeadline(input: GateInput): GateFailure | null {
  const { quote, request } = input;
  const deadlineMs = Date.parse(request.required_delivery_deadline);

  if (quote.delivery_estimate !== null) {
    const arrivalMs = Date.parse(quote.delivery_estimate);
    if (arrivalMs > deadlineMs) {
      const HOURS = 3_600_000;
      const lateHours = (arrivalMs - deadlineMs) / HOURS;
      return {
        reason: 'deadline_miss',
        detail:
          `Arrives ${quote.delivery_estimate}, which is ${lateHours.toFixed(1)}h after the ` +
          `required deadline of ${request.required_delivery_deadline}.`,
      };
    }
    return null;
  }

  if (quote.transit_hours !== null) {
    const HOURS = 3_600_000;
    const arrivalMs = input.now.getTime() + quote.transit_hours.value * HOURS;
    if (arrivalMs > deadlineMs) {
      return {
        reason: 'deadline_miss',
        detail:
          `No delivery date given; ${String(quote.transit_hours.value)}h transit from now ` +
          `arrives after the deadline of ${request.required_delivery_deadline}.`,
      };
    }
    return null;
  }

  // Neither an arrival date nor a transit time. That is not "probably fine": a
  // deadline cannot be shown to be met, so the constraint is not satisfied.
  return {
    reason: 'deadline_miss',
    detail:
      'The carrier returned neither a delivery estimate nor a transit time, so the deadline ' +
      'cannot be shown to be met. Unproven is treated as unmet.',
  };
}

/** Rule 2: the required temperature range must be supported. */
function checkTemperature(input: GateInput): GateFailure | null {
  const required = input.request.temperature_requirement;

  if (!input.capabilities.temperature_ranges.includes(required)) {
    return {
      reason: 'temperature_unsupported',
      detail:
        `Requires ${required}. The carrier documents ` +
        `${input.capabilities.temperature_ranges.length === 0 ? 'no temperature ranges' : input.capabilities.temperature_ranges.join(', ')}.`,
    };
  }

  // The mirror image, and the reason cisplatin's prohibition is carried this far:
  // a carrier whose ONLY service is refrigerated cannot carry a drug whose label
  // forbids refrigeration.
  const forbidden = input.prohibitedRanges.filter((range) =>
    input.capabilities.temperature_ranges.includes(range),
  );
  const onlyForbidden =
    forbidden.length > 0 &&
    input.capabilities.temperature_ranges.every((range) => forbidden.includes(range));

  if (onlyForbidden) {
    return {
      reason: 'temperature_unsupported',
      detail:
        `The drug's label FORBIDS ${forbidden.join(', ')}, and every range this carrier ` +
        'documents is one of those.',
    };
  }

  return null;
}

/** Rule 3: the lane must be served. */
function checkLane(input: GateInput): GateFailure | null {
  const { serves_lanes: serves } = input.capabilities;
  const isDomestic = input.request.origin.country === input.request.destination.country;
  const lane = `${input.request.origin.country}-${input.request.destination.country}`;

  if (serves === 'domestic_in') {
    return isDomestic && input.request.origin.country === 'IN'
      ? null
      : {
          reason: 'route_not_served',
          detail: `Carrier serves domestic India only; lane is ${lane}.`,
        };
  }

  if (serves === 'international') return null;

  return serves.includes(lane)
    ? null
    : {
        reason: 'route_not_served',
        detail: `Lane ${lane} is not in the carrier's documented lane list.`,
      };
}

/** Rule 4: every requested special handling must be supported. */
function checkSpecialHandling(input: GateInput): GateFailure[] {
  const capabilityFor: Record<string, CapabilityFlag> = {
    cold_chain: input.capabilities.cold_chain_certified,
    temperature_monitoring: input.capabilities.temperature_monitoring,
    gdp: input.capabilities.gdp_compliant,
    // Not separately documented by any of the six carriers, so requiring either
    // eliminates every carrier — which is the honest outcome rather than a pass.
    controlled_substance: 'unknown',
    fragile: 'unknown',
    light_sensitive: 'unknown',
  };

  return input.request.special_handling
    .filter((handling) => !isSatisfied(capabilityFor[handling] ?? 'unknown'))
    .map((handling) => ({
      reason: 'handling_unsupported' as const,
      detail:
        `Requires ${handling}; the carrier's capability is ` +
        `'${String(capabilityFor[handling] ?? 'unknown')}'. An undocumented capability fails a ` +
        'constraint that requires it, because a guessed yes is not a yes.',
    }));
}

/** Rules 5 and 6: dangerous goods, and customs brokerage. */
function checkRegulatory(input: GateInput): GateFailure[] {
  const failures: GateFailure[] = [];

  if (input.request.hazardous_material && !isSatisfied(input.capabilities.dangerous_goods)) {
    failures.push({
      reason: 'dg_unsupported',
      detail:
        'Shipment is hazardous material; the carrier does not document dangerous-goods ' +
        `handling (capability '${String(input.capabilities.dangerous_goods)}').`,
    });
  }

  if (input.request.customs_required && !isSatisfied(input.capabilities.customs_brokerage)) {
    failures.push({
      reason: 'customs_unsupported',
      detail:
        'Shipment crosses a customs border; the carrier does not document customs brokerage ' +
        `(capability '${String(input.capabilities.customs_brokerage)}').`,
    });
  }

  return failures;
}

/** Rule 7: no quote, no eligibility. The carrier's own reason is carried through. */
function checkQuoteAvailable(input: GateInput): GateFailure | null {
  if (input.quote.quote_status !== 'UNAVAILABLE' && input.quote.price !== null) return null;

  return {
    reason: 'quote_unavailable',
    detail:
      input.quote.unavailable_reason === null
        ? 'No price was obtained.'
        : `${input.quote.unavailable_reason}: ${input.quote.provenance.calculation_method ?? ''}`,
  };
}

/** Rule 8: the budget ceiling, when the operator set one. */
function checkBudget(input: GateInput): GateFailure | null {
  const ceiling = input.request.budget_ceiling_inr;
  const price = input.quote.price;
  if (ceiling === null || price === null) return null;

  return price.value > ceiling.value
    ? {
        reason: 'over_budget',
        detail:
          `INR ${price.value.toLocaleString('en-IN')} exceeds the ceiling of ` +
          `INR ${ceiling.value.toLocaleString('en-IN')}.`,
      }
    : null;
}

/** Rule 9: the mode preference, when it is not 'any'. */
function checkMode(input: GateInput): GateFailure | null {
  const preference = input.request.shipping_mode_preference;
  if (preference === 'any') return null;

  const mode = input.quote.service_normalised;
  // `multimodal` means the carrier did not tell us the mode. Excluding it when a
  // preference is set would eliminate a freight forwarder for being vague; the
  // detail says so rather than silently allowing it.
  if (mode === 'multimodal') return null;

  return preference.includes(mode)
    ? null
    : {
        reason: 'mode_excluded',
        detail: `Service mode is ${mode}; the request allows only ${preference.join(', ')}.`,
      };
}

/**
 * Runs all nine rules.
 *
 * @returns eligibility plus **every** failure, in spec rule order.
 */
export function checkEligibility(input: GateInput): GateResult {
  // The one place the gate stops early, and it is not an optimisation.
  //
  // An UNAVAILABLE quote has no price, no arrival date, no service mode and no
  // capability fields — so running the other eight rules against it produces
  // verdicts that look like findings and are not. Reporting "DSV misses the
  // deadline" about a carrier that returned nothing at all is a claim we cannot
  // support, and it buries the one fact that matters underneath four that do
  // not. Rule 7 fires alone, carrying the carrier's own reason.
  const unavailable = checkQuoteAvailable(input);
  if (unavailable !== null) return { isEligible: false, failures: [unavailable] };

  const failures: GateFailure[] = [
    checkDeadline(input),
    checkTemperature(input),
    checkLane(input),
    ...checkSpecialHandling(input),
    ...checkRegulatory(input),
    checkBudget(input),
    checkMode(input),
  ].filter((failure): failure is GateFailure => failure !== null);

  return { isEligible: failures.length === 0, failures };
}

/**
 * A one-line summary for the comparison table.
 *
 * Says "NOT ELIGIBLE" rather than showing a score, because an ineligible carrier
 * has no score — see the note at the top of this file.
 */
export function summariseGate(result: GateResult): string {
  if (result.isEligible) return 'ELIGIBLE';

  return `NOT ELIGIBLE — ${result.failures.map((failure) => failure.reason).join(', ')}`;
}
