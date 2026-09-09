/**
 * Exposure formula tests. No mocks, no graph, no database — the traversal has
 * already run and this is arithmetic over literal path weights.
 *
 * The tests worth reading are the ones that pin *why* the formula is shaped the
 * way it is: that it sums over paths rather than taking the maximum, and that
 * concentration and redundancy multiply the sum rather than each path.
 */

import { describe, expect, it } from 'vitest';

import type { Path } from '@vitalink/graph';

import { computeExposure, rankByExposure } from '../domain/exposure';

/** A path of the given length and total weight. Hops are irrelevant here. */
function path(pathWeight: number, length: number): Path {
  return { hops: [], pathWeight, length };
}

const NO_CONCENTRATION = { hhi: 0, totalMakers: 2, affectedMakers: 1 };

describe('computeExposure', () => {
  it('is zero when nothing reached the drug', () => {
    const result = computeExposure({ paths: [], decay: 1, ...NO_CONCENTRATION });

    expect(result.score).toBe(0);
    expect(result.pathCount).toBe(0);
  });

  it('passes a single unattenuated path straight through', () => {
    const result = computeExposure({
      paths: [path(0.68, 1)],
      decay: 1,
      hhi: 0,
      totalMakers: 2,
      affectedMakers: 1,
    });

    // 0.68 * decay^1 = 0.68, * (1 + 0) = 0.68, / max(1, 2-1) = 0.68
    expect(result.score).toBeCloseTo(0.68, 10);
  });

  it('sums over paths rather than taking the strongest', () => {
    // Two weak dependencies on one country are a different risk from one strong
    // one. A shortest-path search would report 0.4 here and miss half the story.
    const result = computeExposure({
      paths: [path(0.4, 1), path(0.3, 1)],
      decay: 1,
      ...NO_CONCENTRATION,
    });

    expect(result.pathSum).toBeCloseTo(0.7, 10);
    expect(result.score).toBeCloseTo(0.7, 10);
  });

  it('attenuates a longer path more than a shorter one', () => {
    const near = computeExposure({ paths: [path(1, 1)], decay: 0.5, ...NO_CONCENTRATION });
    const far = computeExposure({ paths: [path(1, 3)], decay: 0.5, ...NO_CONCENTRATION });

    expect(near.score).toBeCloseTo(0.5, 10);
    expect(far.score).toBeCloseTo(0.125, 10);
  });

  it('does not attenuate at all when decay is 1', () => {
    const result = computeExposure({ paths: [path(1, 5)], decay: 1, ...NO_CONCENTRATION });

    expect(result.score).toBeCloseTo(1, 10);
  });

  it('kills everything beyond the first hop when decay is 0', () => {
    const result = computeExposure({ paths: [path(1, 2)], decay: 0, ...NO_CONCENTRATION });

    expect(result.score).toBe(0);
  });

  it('rejects a decay above 1, which would amplify with distance', () => {
    // Not a parameter choice, a bug: a shock further away must not be scored as
    // more severe than the same shock adjacent.
    expect(() => computeExposure({ paths: [path(1, 1)], decay: 1.5, ...NO_CONCENTRATION })).toThrow(
      RangeError,
    );
  });

  it('rejects a negative decay', () => {
    expect(() =>
      computeExposure({ paths: [path(1, 1)], decay: -0.1, ...NO_CONCENTRATION }),
    ).toThrow(RangeError);
  });

  it('doubles exposure for a monopoly', () => {
    const dispersed = computeExposure({
      paths: [path(0.4, 1)],
      decay: 1,
      hhi: 0,
      totalMakers: 2,
      affectedMakers: 1,
    });
    const monopoly = computeExposure({
      paths: [path(0.4, 1)],
      decay: 1,
      hhi: 1,
      totalMakers: 2,
      affectedMakers: 1,
    });

    expect(monopoly.concentrationMultiplier).toBe(2);
    expect(monopoly.score).toBeCloseTo(dispersed.score * 2, 10);
  });

  it('divides by the makers the shock did not touch', () => {
    const noHelp = computeExposure({
      paths: [path(0.9, 1)],
      decay: 1,
      hhi: 0,
      totalMakers: 5,
      affectedMakers: 5,
    });
    const someHelp = computeExposure({
      paths: [path(0.9, 1)],
      decay: 1,
      hhi: 0,
      totalMakers: 5,
      affectedMakers: 1,
    });

    // Five makers is no help if the shock hits all five.
    expect(noHelp.redundancyDivisor).toBe(1);
    expect(someHelp.redundancyDivisor).toBe(4);
    expect(someHelp.score).toBeLessThan(noHelp.score);
  });

  it('applies concentration once, not once per path', () => {
    // Applying it per path would make a drug reachable by ten weak paths look
    // more concentrated than the same drug reachable by one strong path.
    const onePath = computeExposure({
      paths: [path(0.2, 1)],
      decay: 1,
      hhi: 1,
      totalMakers: 2,
      affectedMakers: 1,
    });
    const twoPaths = computeExposure({
      paths: [path(0.1, 1), path(0.1, 1)],
      decay: 1,
      hhi: 1,
      totalMakers: 2,
      affectedMakers: 1,
    });

    expect(twoPaths.score).toBeCloseTo(onePath.score, 10);
  });

  it('clamps to 1 and says that it did', () => {
    // A concentrated drug can push the product above 1. Reporting 1.0 without
    // flagging it would look like a computed maximum rather than a ceiling.
    const result = computeExposure({
      paths: [path(0.9, 1)],
      decay: 1,
      hhi: 1,
      totalMakers: 1,
      affectedMakers: 1,
    });

    expect(result.score).toBe(1);
    expect(result.wasClamped).toBe(true);
    expect(result.calculationMethod).toContain('maximally exposed by this model');
  });

  it('does not report clamping when the score is genuinely 1', () => {
    const result = computeExposure({
      paths: [path(1, 1)],
      decay: 1,
      hhi: 0,
      totalMakers: 2,
      affectedMakers: 1,
    });

    expect(result.score).toBe(1);
    expect(result.wasClamped).toBe(false);
  });

  it("writes the formula out with this run's numbers substituted in", () => {
    // The whole claim of the cascade is that a reader can check the arithmetic
    // from what is on screen.
    const result = computeExposure({
      paths: [path(0.68, 1)],
      decay: 0.75,
      hhi: 0.5,
      totalMakers: 3,
      affectedMakers: 1,
    });

    expect(result.calculationMethod).toContain('exposure = [sum over paths');
    expect(result.calculationMethod).toContain('decay 0.75');
    expect(result.calculationMethod).toContain('redundancy divisor of 2');
  });
});

describe('rankByExposure', () => {
  const make = (drugId: string, score: number, pathCount: number) => ({
    drugId,
    exposure: {
      score,
      pathSum: score,
      concentrationMultiplier: 1,
      redundancyDivisor: 1,
      pathCount,
      wasClamped: false,
      calculationMethod: '',
    },
  });

  it('puts the most exposed drug first', () => {
    const ranked = rankByExposure([make('a', 0.2, 1), make('b', 0.9, 1), make('c', 0.5, 1)]);

    expect(ranked.map((one) => one.drugId)).toEqual(['b', 'c', 'a']);
  });

  it('breaks a score tie on path count', () => {
    const ranked = rankByExposure([make('a', 0.5, 1), make('b', 0.5, 4)]);

    expect(ranked[0]?.drugId).toBe('b');
  });

  it('breaks a full tie on id, so the order is deterministic', () => {
    // The evaluation harness measures precision@k over exactly this list. An
    // unstable sort would make "the top 10 exposed drugs" differ per run.
    const ranked = rankByExposure([make('z', 0.5, 1), make('a', 0.5, 1)]);

    expect(ranked.map((one) => one.drugId)).toEqual(['a', 'z']);
  });

  it('does not mutate its argument', () => {
    const input = [make('a', 0.2, 1), make('b', 0.9, 1)];

    rankByExposure(input);

    expect(input[0]?.drugId).toBe('a');
  });
});
