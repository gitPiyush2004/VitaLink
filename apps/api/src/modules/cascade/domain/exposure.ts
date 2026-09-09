/**
 * The exposure formula (spec stage 4).
 *
 * Pure arithmetic over path weights. No I/O, no clock, no graph — the traversal
 * has already happened, and this file turns its output into a number. That split
 * is what lets every term below be tested with literal values.
 *
 * The formula, exactly as the spec states it:
 *
 *     exposure(drug) = [ SUM over paths P of  prod(edge weights along P)
 *                                             * decay ^ length(P) ]
 *                      * concentration_penalty(HHI)
 *                      * 1 / redundancy(unaffected makers)
 *
 * Three things about it are worth understanding, because each is a decision that
 * could have gone the other way.
 *
 * **It sums over paths rather than taking the strongest.** Two weak dependencies
 * on one country are a different risk from one strong dependency, and a
 * shortest-path search would report only the latter. This is why the traversal
 * enumerates every path instead of running Dijkstra.
 *
 * **`decay ^ length` attenuates distance.** A shock four hops away is real but
 * weaker than the same shock adjacent, and without attenuation a large graph
 * would report everything as maximally exposed. `decay` is a declared parameter
 * on every cascade, not a constant buried here, so a reader can see what it was
 * and change it.
 *
 * **The last two terms multiply the sum, not each path.** Concentration and
 * redundancy are properties of the drug, not of the route the shock took, so
 * applying them per path would count them once per path — which would make a
 * drug reachable by ten weak paths look more concentrated than the same drug
 * reachable by one.
 */

import { concentrationPenalty, unaffectedRedundancy, type Path } from '@vitalink/graph';

/** Decimal places used when quoting a figure inside a calculation method. */
const DECIMALS = 4;

/** Everything the formula needs about one drug, already gathered. */
export type ExposureInput = {
  /** Every path the traversal found from the shock to this drug. */
  paths: Path[];
  /** Per-hop attenuation, 0..1. Declared per cascade run. */
  decay: number;
  /** Herfindahl index over the drug's makers, 0..1. 1 is a monopoly. */
  hhi: number;
  /** Total distinct makers observed for this drug. */
  totalMakers: number;
  /** Makers this particular shock touches. The rest are the redundancy. */
  affectedMakers: number;
};

export type ExposureBreakdown = {
  /** 0..1. Clamped, because the terms can multiply above 1 for a concentrated drug. */
  score: number;
  /** Each term, kept so the UI can show the arithmetic rather than the result. */
  pathSum: number;
  concentrationMultiplier: number;
  redundancyDivisor: number;
  pathCount: number;
  /** True when clamping bit, so "1.0" is not mistaken for a computed maximum. */
  wasClamped: boolean;
  /** The formula with this run's numbers substituted in. Stored on the Quantity. */
  calculationMethod: string;
};

/**
 * Computes one drug's exposure to one shock.
 *
 * @param input paths and drug structure. `decay` must be in [0, 1].
 * @returns the score plus every intermediate term.
 * @throws RangeError if `decay` is outside [0, 1], because a decay above 1 would
 *   amplify with distance rather than attenuate, which is not a parameter choice
 *   but a bug.
 */
export function computeExposure(input: ExposureInput): ExposureBreakdown {
  if (input.decay < 0 || input.decay > 1) {
    throw new RangeError(`decay must be in [0, 1], got ${String(input.decay)}`);
  }

  const pathSum = input.paths.reduce(
    (sum, path) => sum + path.pathWeight * input.decay ** path.length,
    0,
  );

  const concentrationMultiplier = concentrationPenalty(input.hhi);
  const redundancyDivisor = unaffectedRedundancy(input.totalMakers, input.affectedMakers);

  const raw = (pathSum * concentrationMultiplier) / redundancyDivisor;
  const score = Math.min(1, Math.max(0, raw));

  return {
    score,
    pathSum,
    concentrationMultiplier,
    redundancyDivisor,
    pathCount: input.paths.length,
    wasClamped: raw > 1,
    calculationMethod: describe(input, {
      pathSum,
      concentration: concentrationMultiplier,
      redundancy: redundancyDivisor,
      raw,
    }),
  };
}

/**
 * The formula with this run's numbers in it.
 *
 * Written out rather than left as "see the exposure formula", because the whole
 * claim of the cascade is that a reader can check the arithmetic from what is on
 * screen.
 */
function describe(
  input: ExposureInput,
  terms: { pathSum: number; concentration: number; redundancy: number; raw: number },
): string {
  const { pathSum, concentration, redundancy, raw } = terms;
  const parts = [
    'exposure = [sum over paths of prod(edge weights) * decay^length]',
    '* (1 + HHI) / max(1, total makers - affected makers), clamped to [0, 1].',
    `Here: ${String(input.paths.length)} path(s) summed to ${pathSum.toFixed(DECIMALS)} at`,
    `decay ${String(input.decay)};`,
    `HHI ${input.hhi.toFixed(DECIMALS)} gives a concentration multiplier of`,
    `${concentration.toFixed(DECIMALS)};`,
    `${String(input.totalMakers)} makers less ${String(input.affectedMakers)} affected gives a`,
    `redundancy divisor of ${String(redundancy)}.`,
    `Raw ${raw.toFixed(DECIMALS)}.`,
  ];

  if (raw > 1) {
    parts.push(
      'Clamped to 1.0 — the concentration multiplier pushed the product above one, which ' +
        'means "maximally exposed by this model" rather than a computed 100%.',
    );
  }

  return parts.join(' ');
}

/**
 * Ranks exposed drugs, most exposed first.
 *
 * Ties break on path count, then on id. Deterministic ordering matters more than
 * it looks: an unstable sort makes "the top 10 exposed drugs" a different list on
 * every run, and the evaluation harness measures precision@k over exactly that
 * list.
 */
export function rankByExposure<T extends { drugId: string; exposure: ExposureBreakdown }>(
  exposed: T[],
): T[] {
  return [...exposed].sort((left, right) => {
    if (right.exposure.score !== left.exposure.score) {
      return right.exposure.score - left.exposure.score;
    }
    if (right.exposure.pathCount !== left.exposure.pathCount) {
      return right.exposure.pathCount - left.exposure.pathCount;
    }
    return left.drugId.localeCompare(right.drugId);
  });
}
