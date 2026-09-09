/**
 * Structural metrics computed from the graph.
 *
 * All pure functions over plain arrays, deliberately not over the graphology
 * instance. That means each one can be unit tested with a literal list of
 * shares and no graph at all — and every one of them is arithmetic that appears
 * in a number the user sees, so it needs to be testable that cheaply.
 *
 * These feed two places: `z_api` and the concentration penalty in the exposure
 * formula (TRACE), and the fragility board's "single source" flag.
 */

/**
 * Herfindahl-Hirschman index over a set of shares.
 *
 * ``HHI = sum of share^2``, on a 0..1 scale rather than the 0..10000 scale
 * competition authorities use, because every other index in this system is 0..1
 * and mixing scales is how a weighted sum ends up meaningless.
 *
 * Reads as: 1.0 is a monopoly, 0.5 is two equal players, 0.1 is ten. It is the
 * concentration penalty in the exposure formula because a drug made by one firm
 * with 90% share is far more exposed than one made by ten firms with 10% each,
 * even though both have the same *count* of manufacturers.
 *
 * @param shares shares that should sum to 1. Not normalised here: a caller
 *   passing shares that do not sum to 1 has a bug, and silently normalising
 *   would hide it.
 * @returns HHI in [0, 1], or 0 for an empty set.
 */
export function herfindahl(shares: number[]): number {
  if (shares.length === 0) return 0;
  return shares.reduce((sum, share) => sum + share * share, 0);
}

/** Turns raw counts into shares. Returns an empty list for a zero total. */
export function toShares(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];
  return counts.map((count) => count / total);
}

/**
 * Redundancy: makers that a given shock does *not* touch.
 *
 * This is the ``1 / redundancy`` divisor in the exposure formula. The point is
 * that a drug with five manufacturers is not resilient if the shock hits all
 * five — so the count that matters is the *unaffected* one, not the total.
 *
 * @returns at least 1, so the divisor never explodes. A drug whose every maker
 *   is affected has redundancy 1, meaning "no help available", rather than 0,
 *   which would make the exposure infinite.
 */
export function unaffectedRedundancy(totalMakers: number, affectedMakers: number): number {
  return Math.max(1, totalMakers - affectedMakers);
}

/**
 * The concentration penalty applied to a drug's exposure.
 *
 * A multiplier in [1, 2]: no penalty when manufacture is perfectly dispersed,
 * doubling when it is a monopoly. Linear in HHI rather than exponential, because
 * a super-linear penalty would let one term dominate the exposure sum and make
 * the path weights it multiplies effectively irrelevant.
 *
 * The formula is stored on every exposure value's `calculation_method`, so a
 * reader can see this exact expression next to the number.
 */
export function concentrationPenalty(hhi: number): number {
  return 1 + hhi;
}

/**
 * Largest single-country dependency across a set of import shares.
 *
 * The headline number for "how exposed is this ingredient to one country". It is
 * a probability derived from real trade value, and is labelled as such — never
 * as a supplier relationship.
 */
export function maxDependencyShare(shares: number[]): number | null {
  if (shares.length === 0) return null;
  return Math.max(...shares);
}

/** True when only one maker was observed. This is what `z_api === 1` means. */
export function isSingleSource(distinctMakerCount: number): boolean {
  return distinctMakerCount <= 1;
}
