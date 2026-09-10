/**
 * Urgency, and the delivery deadline derived from it (spec 6.5).
 *
 * Urgency is not an operator dropdown with a sensible default. It is **derived**
 * from days of cover, alert severity and affected population, because those are
 * the three things that actually determine how much a late arrival costs. The
 * derivation is printed alongside the answer, so an operator who disagrees can
 * see which input they disagree with rather than just overriding a label.
 *
 * ## Cover is a band, and urgency reads the low edge
 *
 * `coverDaysBand.low` drives the classification, not the midpoint. Cover is
 * MODELLED from published procurement policy — we do not know it — and if the
 * pessimistic edge of that band says two days, planning for the midpoint's five
 * days is planning for a number nobody measured. The conservative edge is the
 * only edge it is safe to plan against.
 *
 * Pure functions. `now` is passed in.
 */

import type { Urgency } from '@vitalink/contracts';

import {
  DEADLINE_SAFETY_MARGIN_DAYS,
  MS_PER_DAY,
  URGENCY_COVER_DAYS,
  URGENCY_ESCALATION_POPULATION,
  URGENCY_ESCALATION_SEVERITY,
} from '@config/constants';
import { WEIGHT_PROFILES, type WeightProfile } from '@config/weights';

const LADDER: Urgency[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

/** One step up the ladder, saturating at CRITICAL. */
function escalate(urgency: Urgency): Urgency {
  const next = LADDER[Math.min(LADDER.indexOf(urgency) + 1, LADDER.length - 1)];
  // The index is bounded above, and `urgency` is always in the ladder, so this
  // cannot be undefined. `noUncheckedIndexedAccess` cannot see that.
  return next ?? 'CRITICAL';
}

export type UrgencyInput = {
  /** Days of cover as a band. The LOW edge drives the answer — see above. */
  coverDaysBand: { low: number; high: number } | null;
  /** Alert severity 1-5, or null when this shipment is not shock-driven. */
  alertSeverity: number | null;
  /** People served by the affected facilities, when known. */
  affectedPopulation: number | null;
  /** Whether the drug is on India's National List of Essential Medicines. */
  isNlemCritical: boolean;
};

export type UrgencyDecision = {
  urgency: Urgency;
  /** Every step of the derivation, in order. Rendered next to the profile. */
  derivation: string[];
};

/**
 * Classifies urgency from cover, severity and population.
 *
 * When cover is unknown the result is NORMAL rather than LOW: an unknown runway
 * is not a comfortable one, and defaulting to the cost-dominated profile because
 * we failed to model inventory would be optimising on our own ignorance.
 */
export function deriveUrgency(input: UrgencyInput): UrgencyDecision {
  const base = classifyByCover(input.coverDaysBand);
  const bySeverity = escalateForSeverity(base, input.alertSeverity);
  const byPopulation = escalateForPopulation(bySeverity, input);

  return {
    urgency: byPopulation.urgency,
    derivation: [...base.derivation, ...bySeverity.derivation, ...byPopulation.derivation],
  };
}

/** One step of the derivation: a level plus the sentence that explains it. */
type Step = { urgency: Urgency; derivation: string[] };

/** The cover thresholds. Reads the LOW edge of the band — see the file header. */
function classifyByCover(band: UrgencyInput['coverDaysBand']): Step {
  if (band === null) {
    return {
      urgency: 'NORMAL',
      derivation: [
        'Days of cover could not be modelled for this drug, so urgency starts at NORMAL. ' +
          'An unknown runway is not a comfortable one, so it does not start at LOW.',
      ],
    };
  }

  const { low } = band;
  const urgency: Urgency =
    low <= URGENCY_COVER_DAYS.critical
      ? 'CRITICAL'
      : low <= URGENCY_COVER_DAYS.high
        ? 'HIGH'
        : low <= URGENCY_COVER_DAYS.normal
          ? 'NORMAL'
          : 'LOW';

  return {
    urgency,
    derivation: [
      `Days of cover band is ${band.low.toFixed(1)}-${band.high.toFixed(1)}; the LOW edge of ` +
        `${low.toFixed(1)} days classifies as ${urgency} (thresholds: ` +
        `<=${String(URGENCY_COVER_DAYS.critical)} CRITICAL, ` +
        `<=${String(URGENCY_COVER_DAYS.high)} HIGH, ` +
        `<=${String(URGENCY_COVER_DAYS.normal)} NORMAL).`,
    ],
  };
}

/**
 * A severe alert lifts anything below HIGH to HIGH.
 *
 * It lifts *to* HIGH rather than escalating by one step, so a severe alert on a
 * comfortable cover position does not land on CRITICAL — severity says the shock
 * is bad, not that the runway is gone.
 */
function escalateForSeverity(step: Step, severity: number | null): Step {
  if (severity === null || severity < URGENCY_ESCALATION_SEVERITY) {
    return { urgency: step.urgency, derivation: [] };
  }

  const urgency: Urgency =
    step.urgency === 'LOW' || step.urgency === 'NORMAL' ? 'HIGH' : step.urgency;

  return {
    urgency,
    derivation: [
      `Alert severity ${String(severity)} is at or above the escalation threshold of ` +
        `${String(URGENCY_ESCALATION_SEVERITY)}` +
        (step.urgency === urgency
          ? ', which does not raise the level further.'
          : `, raising ${step.urgency} to ${urgency}.`),
    ],
  };
}

/** A large affected population escalates a critical drug by one step. */
function escalateForPopulation(step: Step, input: UrgencyInput): Step {
  const population = input.affectedPopulation;
  const applies =
    input.isNlemCritical && population !== null && population >= URGENCY_ESCALATION_POPULATION;

  if (!applies || population === null) return { urgency: step.urgency, derivation: [] };

  const urgency = escalate(step.urgency);
  return {
    urgency,
    derivation: [
      `The drug is NLEM-critical and ${population.toLocaleString('en-IN')} people are ` +
        `affected, above the ${URGENCY_ESCALATION_POPULATION.toLocaleString('en-IN')} ` +
        'escalation threshold' +
        (step.urgency === urgency
          ? ', already at the top of the scale.'
          : `, raising ${step.urgency} to ${urgency}.`),
    ],
  };
}

/** The weight profile in force, carrying the derivation that selected it. */
export function selectProfile(decision: UrgencyDecision): WeightProfile {
  return WEIGHT_PROFILES[decision.urgency];
}

/**
 * The delivery deadline implied by the cover runway.
 *
 * `now + (cover_low - safety margin)`, floored at now. The margin exists because
 * a shipment that arrives on the exact day cover runs out has already failed —
 * receiving, QC and distribution all take time that the cover model does not
 * account for.
 *
 * @returns an ISO instant, or null when cover is unknown and a deadline therefore
 *   cannot be derived. A caller must then ask for one rather than invent it.
 */
export function deriveDeadline(
  coverDaysBand: { low: number; high: number } | null,
  now: Date,
): { deadlineIso: string; derivation: string } | null {
  if (coverDaysBand === null) return null;

  const usableDays = Math.max(0, coverDaysBand.low - DEADLINE_SAFETY_MARGIN_DAYS);
  const deadlineIso = new Date(now.getTime() + usableDays * MS_PER_DAY).toISOString();

  return {
    deadlineIso,
    derivation:
      `${coverDaysBand.low.toFixed(1)} days of cover (LOW edge) minus a ` +
      `${String(DEADLINE_SAFETY_MARGIN_DAYS)}-day receiving and QC margin gives ` +
      `${usableDays.toFixed(1)} usable days, so the deadline is ${deadlineIso}.`,
  };
}
