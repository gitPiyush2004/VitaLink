/**
 * Scoring weight profiles. Configuration, not code (spec 6.8).
 *
 * The profiles are **risk-responsive**: which one applies is derived from the
 * urgency, which is itself derived from days of cover and alert severity. The
 * profile in force is always displayed, and the operator can override it and
 * re-run — because a weighting is a business judgement, and one the system
 * should surface rather than embed.
 *
 * Two rules hold across every profile, and both are asserted by tests:
 *
 *  - **The weights sum to 1.** Not for neatness: a sub-score is 0-100 and the
 *    final score is a weighted sum, so weights that summed to 1.2 would produce
 *    a "score" of 120 and quietly break every comparison against a threshold.
 *  - **Cold chain never drops below 20%.** This is a pharmaceutical system. A
 *    profile that let cold-chain capability fall away under time pressure would
 *    be optimising exactly the wrong thing at exactly the wrong moment.
 *
 * The table is transcribed from spec 6.8. The `risk` weight is zero in the
 * NORMAL and CRITICAL columns *in the spec*, which looks like an oversight — but
 * it is reproduced as published rather than quietly corrected, and the reasoning
 * is recorded in `docs/adr/0012-weight-profiles.md`.
 */

import type { Urgency } from '@vitalink/contracts';

export type SubScoreKey = 'cost' | 'transit' | 'reliability' | 'cold_chain' | 'risk' | 'service';

export type WeightProfile = {
  name: Urgency;
  weights: Record<SubScoreKey, number>;
  /** Why this profile is in force. Rendered next to the score breakdown. */
  rationale: string;
};

/** Cold chain never goes below this share, in any profile. */
export const MIN_COLD_CHAIN_WEIGHT = 0.2;

export const WEIGHT_PROFILES: Record<Urgency, WeightProfile> = {
  LOW: {
    name: 'LOW',
    weights: {
      cost: 0.45,
      transit: 0.15,
      reliability: 0.15,
      cold_chain: 0.2,
      risk: 0.05,
      service: 0,
    },
    rationale:
      'Plenty of days of cover, so cost dominates: there is time to wait for the cheaper ' +
      'option and no reason to pay for speed.',
  },
  NORMAL: {
    name: 'NORMAL',
    weights: { cost: 0.4, transit: 0.2, reliability: 0.2, cold_chain: 0.2, risk: 0, service: 0 },
    rationale: 'Adequate cover. Cost still leads, with transit and reliability weighted equally.',
  },
  HIGH: {
    name: 'HIGH',
    weights: { cost: 0.2, transit: 0.3, reliability: 0.2, cold_chain: 0.2, risk: 0.1, service: 0 },
    rationale:
      'Cover is short or the alert is severe. Transit overtakes cost, because arriving late ' +
      'costs more than the freight does.',
  },
  CRITICAL: {
    name: 'CRITICAL',
    weights: { cost: 0.1, transit: 0.45, reliability: 0.25, cold_chain: 0.2, risk: 0, service: 0 },
    rationale:
      'Days of cover are almost gone. Transit dominates and cost is nearly irrelevant: the ' +
      'cheaper option that arrives after stockout has no value at all.',
  },
};

/**
 * The objective weights for the joint scenario matrix (spec 6.11).
 *
 * Separate from the carrier weights above because they weigh different things:
 * these trade shortage against money, time, criticality and carbon across whole
 * *scenarios*, not carriers within one shipment.
 */
export const OBJECTIVE_WEIGHTS = {
  alpha_shortage: 0.45,
  beta_cost: 0.2,
  gamma_recovery: 0.2,
  delta_criticality: 0.1,
  epsilon_co2: 0.05,
} as const;

/**
 * Validates a profile.
 *
 * Exported and called by a test rather than at import time: a malformed profile
 * should fail the build, and failing at import would also take down a process
 * that never scores anything.
 */
export function validateProfile(profile: WeightProfile): string[] {
  const problems: string[] = [];
  const total = Object.values(profile.weights).reduce((sum, weight) => sum + weight, 0);
  const TOLERANCE = 1e-9;

  if (Math.abs(total - 1) > TOLERANCE) {
    problems.push(`weights sum to ${String(total)}, not 1`);
  }
  if (profile.weights.cold_chain < MIN_COLD_CHAIN_WEIGHT) {
    problems.push(
      `cold_chain weight ${String(profile.weights.cold_chain)} is below the ` +
        `${String(MIN_COLD_CHAIN_WEIGHT)} floor this system requires`,
    );
  }
  for (const [key, weight] of Object.entries(profile.weights)) {
    if (weight < 0 || weight > 1) {
      problems.push(`${key} weight ${String(weight)} is outside [0, 1]`);
    }
  }

  return problems;
}
