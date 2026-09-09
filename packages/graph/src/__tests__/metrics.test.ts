/**
 * Structural metric tests.
 *
 * Every function here produces a number the user sees, so each one is tested
 * with literal shares and no graph. `herfindahl` in particular is the
 * concentration penalty in the exposure formula: if it is wrong, every exposure
 * score in the system is wrong by the same factor.
 */

import { describe, expect, it } from 'vitest';

import {
  concentrationPenalty,
  herfindahl,
  isSingleSource,
  maxDependencyShare,
  toShares,
  unaffectedRedundancy,
} from '../metrics';
import { slugify } from '../supply-graph';

describe('herfindahl', () => {
  it('is 1 for a monopoly', () => {
    expect(herfindahl([1])).toBe(1);
  });

  it('is 0.5 for two equal players', () => {
    expect(herfindahl([0.5, 0.5])).toBeCloseTo(0.5, 10);
  });

  it('is 0.1 for ten equal players', () => {
    expect(herfindahl(Array.from({ length: 10 }, () => 0.1))).toBeCloseTo(0.1, 10);
  });

  it('distinguishes a dominant player from an even split at the same count', () => {
    // This is the whole reason HHI is used instead of a count. Both drugs have
    // two manufacturers; one of them is far more exposed.
    const dominated = herfindahl([0.9, 0.1]);
    const even = herfindahl([0.5, 0.5]);

    expect(dominated).toBeGreaterThan(even);
  });

  it('is 0 for an empty set', () => {
    expect(herfindahl([])).toBe(0);
  });
});

describe('toShares', () => {
  it('normalises counts into shares that sum to one', () => {
    const shares = toShares([24, 10, 10, 6]);

    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10);
    expect(shares[0]).toBeCloseTo(0.48, 10);
  });

  it('returns an empty list rather than dividing by zero', () => {
    expect(toShares([0, 0])).toEqual([]);
    expect(toShares([])).toEqual([]);
  });
});

describe('unaffectedRedundancy', () => {
  it('counts the makers a shock does not touch', () => {
    expect(unaffectedRedundancy(5, 2)).toBe(3);
  });

  it('never returns zero, so the exposure divisor cannot explode', () => {
    // A drug whose every maker is affected has redundancy 1 — "no help
    // available" — not 0, which would make exposure infinite.
    expect(unaffectedRedundancy(3, 3)).toBe(1);
    expect(unaffectedRedundancy(3, 9)).toBe(1);
  });
});

describe('concentrationPenalty', () => {
  it('is 1 when manufacture is perfectly dispersed', () => {
    expect(concentrationPenalty(0)).toBe(1);
  });

  it('doubles exposure for a monopoly', () => {
    expect(concentrationPenalty(1)).toBe(2);
  });

  it('is linear in HHI, so no single term dominates the exposure sum', () => {
    expect(concentrationPenalty(0.5)).toBeCloseTo(1.5, 10);
  });
});

describe('maxDependencyShare', () => {
  it('reports the largest single-country dependency', () => {
    expect(maxDependencyShare([0.68, 0.2, 0.12])).toBeCloseTo(0.68, 10);
  });

  it('returns null rather than zero when there is no trade data', () => {
    // Null renders as an empty state with a reason. Zero would claim we know
    // the drug has no country dependency, which is a different, false statement.
    expect(maxDependencyShare([])).toBeNull();
  });
});

describe('isSingleSource', () => {
  it('flags a drug with one observed maker', () => {
    expect(isSingleSource(1)).toBe(true);
  });

  it('does not flag a drug with two', () => {
    expect(isSingleSource(2)).toBe(false);
  });

  it('treats zero observed makers as single source', () => {
    // Zero makers means the catalogue could not resolve any, which is at least
    // as bad as one. Reporting it as "not single source" would be perverse.
    expect(isSingleSource(0)).toBe(true);
  });
});

describe('slugify', () => {
  it('normalises case and punctuation to one form', () => {
    // If these produced different slugs, the graph would hold two manufacturer
    // nodes for one company, z_api would be inflated, and the Fragility Index
    // would be understated for exactly the drugs that matter.
    expect(slugify('Fresenius Kabi USA, LLC')).toBe('fresenius-kabi-usa-llc');
    expect(slugify('FRESENIUS KABI USA LLC')).toBe('fresenius-kabi-usa-llc');
  });

  it('strips combining marks so lookalike hyphens collapse together', () => {
    expect(slugify('Sanofi-Aventis')).toBe('sanofi-aventis');
    expect(slugify('Sanofi  Aventis')).toBe('sanofi-aventis');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  Hospira, Inc.  ')).toBe('hospira-inc');
  });

  it('bounds the length, so an id stays usable in a URL', () => {
    expect(slugify('x'.repeat(400)).length).toBeLessThanOrEqual(120);
  });
});
