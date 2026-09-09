/**
 * Tests for the redundancy derivation.
 *
 * The share distributions here are **real**, observed from openFDA on
 * 8-9 September 2026. They are in the tests rather than synthetic numbers
 * because a synthetic distribution would not have caught the mistake this file
 * documents: an earlier version fed labeler counts into `z_api` and returned the
 * same saturated value for every drug in the catalogue.
 */

import { describe, expect, it } from 'vitest';

import { deriveRedundancy, type LabelerObservation } from '../domain/redundancy-derivation';

function labelers(counts: number[]): LabelerObservation[] {
  return counts.map((productCount, index) => ({
    name: `Labeler ${String(index)}`,
    productCount,
  }));
}

/**
 * Heparin sodium, openFDA `count=labeler_name.exact`, 8 September 2026.
 * 47 labelers over 161 product listings, led by Fresenius Kabi with 24.
 */
const HEPARIN_SODIUM_REAL = labelers([
  24, 10, 10, 9, 9, 8, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
]);

/** Insulin glargine: 11 labelers, a genuinely concentrated finished-dose market. */
const INSULIN_GLARGINE_REAL = labelers([8, 6, 4, 3, 2, 2, 1, 1, 1, 1, 1]);

describe('the API tier is not claimed to be observed', () => {
  it('assumes a single API supplier when no trade data is supplied', () => {
    // The correction at the heart of this file. openFDA describes the
    // finished-dose market; it cannot see who makes the active ingredient.
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL);

    expect(result.zApi).toBe(1);
    expect(result.zApiIsAssumed).toBe(true);
    expect(result.apiTierVisibility).toBe('NOT_OBSERVED');
  });

  it('says the assumption overstates fragility, rather than implying precision', () => {
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL);

    expect(result.caveat).toContain('OVERSTATES fragility');
    expect(result.zApiMethod).toContain('ASSUMED');
  });

  it('does not let 47 labelers become 47 API suppliers', () => {
    // 1 - 0.065^47 is 1.0 to forty decimal places, which would report a
    // Fragility Index of zero for a drug that has been in recorded shortage.
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL);

    expect(result.rawLabelerCount).toBe(47);
    expect(result.zApi).not.toBe(47);
  });

  it('derives z_api from country concentration when trade data exists', () => {
    // Two countries at 50% each -> HHI 0.5 -> numbers-equivalent 2. A genuine
    // API-tier signal: if one country supplies most of the ingredient, upstream
    // redundancy is low however many firms label the finished product.
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL, {
      trade: { countryShares: [0.5, 0.5], sourceDescription: 'UN Comtrade HS 2941, 2025' },
    });

    expect(result.zApi).toBe(2);
    expect(result.zApiIsAssumed).toBe(false);
    expect(result.apiTierVisibility).toBe('OBSERVED_FROM_TRADE_DATA');
    expect(result.caveat).toBeNull();
  });

  it('reports a dominant supplier country as effectively single-source', () => {
    // 90/10 -> HHI 0.82 -> numbers-equivalent 1.22 -> floor 1.
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL, {
      trade: { countryShares: [0.9, 0.1], sourceDescription: 'UN Comtrade' },
    });

    expect(result.zApi).toBe(1);
    expect(result.zApiIsAssumed).toBe(false);
  });

  it('cites the trade source in the method, so the number is checkable', () => {
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL, {
      trade: { countryShares: [0.4, 0.35, 0.25], sourceDescription: 'UN Comtrade HS 2941, 2025' },
    });

    expect(result.zApiMethod).toContain('UN Comtrade HS 2941, 2025');
    expect(result.zApiMethod).toContain('HHI =');
  });
});

describe('z_plant, the echelon openFDA actually measures', () => {
  it('discriminates between drugs instead of returning one value for all', () => {
    // The failure that forced the rewrite: every drug in the seed set came out
    // at the same saturated number, so the metric carried no information.
    const heparin = deriveRedundancy(HEPARIN_SODIUM_REAL);
    const insulin = deriveRedundancy(INSULIN_GLARGINE_REAL);

    expect(heparin.zPlant).not.toBe(insulin.zPlant);
    expect(heparin.zPlant).toBeGreaterThan(insulin.zPlant);
  });

  it('uses the numbers-equivalent of HHI, not the raw count', () => {
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL);

    // 47 labelers, but a numbers-equivalent near 20 once the long tail of
    // one-listing relabelers is discounted arithmetically.
    expect(result.rawLabelerCount).toBe(47);
    expect(result.zPlant).toBeLessThan(result.rawLabelerCount);
    expect(result.numbersEquivalent).toBeGreaterThan(15);
    expect(result.numbersEquivalent).toBeLessThan(25);
  });

  it('discounts the long tail without a hand-maintained repackager list', () => {
    const result = deriveRedundancy(HEPARIN_SODIUM_REAL);

    // Twenty-three labelers hold a single listing each. An exclusion list would
    // need constant upkeep and would still miss cases.
    expect(result.longTailCount).toBeGreaterThan(20);
    expect(result.hhi).toBeLessThan(0.1);
  });

  it('reports two equal makers as z_plant = 2', () => {
    expect(deriveRedundancy(labelers([10, 10])).zPlant).toBe(2);
  });

  it('reports a dominated duopoly as more fragile than an even one', () => {
    // Both have two labelers; one is effectively single-sourced. A raw count
    // cannot tell them apart, which is why HHI is used.
    const even = deriveRedundancy(labelers([10, 10]));
    const dominated = deriveRedundancy(labelers([19, 1]));

    expect(dominated.zPlant).toBe(1);
    expect(even.zPlant).toBe(2);
  });

  it('states the whole formula, with its inputs, in the method', () => {
    const result = deriveRedundancy(labelers([10, 10]));

    expect(result.zPlantMethod).toContain('z_plant = max(1, floor(1 / HHI)) = 2');
    expect(result.zPlantMethod).toContain('HHI = 0.50000');
    expect(result.zPlantMethod).toContain('2 distinct labelers');
    expect(result.zPlantMethod).toContain('FINISHED-DOSE');
  });
});

describe('a truncated openFDA count is reported as a floor', () => {
  it('flags truncation, so a floor is not mistaken for a total', () => {
    // Observed: a metformin labeler count returned exactly 100 buckets summing
    // to 629 listings, with a minimum bucket of 1 — a cut-off tail presented
    // with no indication it was cut off.
    const result = deriveRedundancy(labelers([54, 30, 20, 10, 5]), {
      wasCountTruncated: true,
    });

    expect(result.wasCountTruncated).toBe(true);
    expect(result.zPlantMethod).toContain('FLOOR');
  });

  it('says nothing about truncation when the count was complete', () => {
    const result = deriveRedundancy(labelers([10, 10]), { wasCountTruncated: false });

    expect(result.wasCountTruncated).toBe(false);
    expect(result.zPlantMethod).not.toContain('FLOOR');
  });
});

describe('missing data is never treated as good news', () => {
  it('assumes the most fragile configuration when no labeler is observed', () => {
    const result = deriveRedundancy([]);

    expect(result.zApi).toBe(1);
    expect(result.zPlant).toBe(1);
    expect(result.isSingleSource).toBe(true);
    expect(result.caveat).toContain('No openFDA labeler');
  });

  it('never returns a redundancy below 1, because the model rejects zero', () => {
    const result = deriveRedundancy(labelers([0, 0, 0]));

    expect(result.zApi).toBeGreaterThanOrEqual(1);
    expect(result.zPlant).toBeGreaterThanOrEqual(1);
  });

  it('flags a genuine single labeler', () => {
    const result = deriveRedundancy(labelers([12]));

    expect(result.zPlant).toBe(1);
    expect(result.isSingleSource).toBe(true);
  });

  it('does not flag two labelers as single source', () => {
    expect(deriveRedundancy(labelers([10, 10])).isSingleSource).toBe(false);
  });
});
