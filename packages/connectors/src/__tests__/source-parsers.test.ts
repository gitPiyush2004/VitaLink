/**
 * The pure parsing and derivation functions in the source clients.
 *
 * `toImportShares` matters most: it is the arithmetic behind every
 * `SOURCED_FROM` edge weight in the graph, and the `calculation_method` stored
 * on those edges cites it by name. If it is wrong, every country-dependency
 * claim in the system is wrong.
 */

import { describe, expect, it } from 'vitest';

import {
  excludeWorldAggregate,
  toImportShares,
  type ComtradeRecord,
} from '../sources/comtrade.client';
import { parseGdeltDate } from '../sources/gdelt.client';
import { toCoordinates } from '../sources/geo.client';

function record(overrides: Partial<ComtradeRecord>): ComtradeRecord {
  return { partnerCode: 156, partnerDesc: 'China', primaryValue: 100, ...overrides };
}

describe('toImportShares', () => {
  it('computes shares that sum to one', () => {
    const records = [
      record({ partnerCode: 156, partnerDesc: 'China', primaryValue: 700 }),
      record({ partnerCode: 276, partnerDesc: 'Germany', primaryValue: 200 }),
      record({ partnerCode: 842, partnerDesc: 'USA', primaryValue: 100 }),
    ];

    const shares = toImportShares(records);

    expect(shares.map((share) => share.share)).toEqual([0.7, 0.2, 0.1]);
    expect(shares.reduce((sum, share) => sum + share.share, 0)).toBeCloseTo(1, 10);
  });

  it('sorts by descending share, so the dominant dependency is first', () => {
    const shares = toImportShares([
      record({ partnerDesc: 'Small', primaryValue: 10 }),
      record({ partnerDesc: 'Large', primaryValue: 90 }),
    ]);

    expect(shares[0]?.partnerName).toBe('Large');
  });

  it('ignores records with no trade value rather than treating them as zero', () => {
    const shares = toImportShares([
      record({ partnerDesc: 'Reported', primaryValue: 100 }),
      record({ partnerDesc: 'Suppressed', primaryValue: null }),
    ]);

    // A suppressed value is unknown, not zero. Including it as a zero-share
    // partner would imply we know it imports nothing, which we do not.
    expect(shares).toHaveLength(1);
    expect(shares[0]?.share).toBe(1);
  });

  it('returns an empty list rather than dividing by zero', () => {
    expect(toImportShares([])).toEqual([]);
    expect(toImportShares([record({ primaryValue: 0 })])).toEqual([]);
  });
});

describe('excludeWorldAggregate', () => {
  it('drops the World row, which would otherwise double the denominator', () => {
    // Comtrade returns a "World" aggregate alongside the individual partners.
    // Leaving it in halves every share, which is the classic mistake with this
    // dataset and would understate every country dependency by exactly 50%.
    const records = [
      record({ partnerCode: 0, partnerDesc: 'World', primaryValue: 1000 }),
      record({ partnerCode: 156, partnerDesc: 'China', primaryValue: 700 }),
      record({ partnerCode: 276, partnerDesc: 'Germany', primaryValue: 300 }),
    ];

    const shares = toImportShares(excludeWorldAggregate(records));

    expect(shares.map((share) => share.partnerName)).toEqual(['China', 'Germany']);
    expect(shares[0]?.share).toBeCloseTo(0.7, 10);
  });
});

describe('parseGdeltDate', () => {
  it('converts GDELT compact form into an ISO instant', () => {
    expect(parseGdeltDate('20260901T143000Z')).toBe('2026-09-01T14:30:00.000Z');
  });

  it('returns null for a malformed value', () => {
    // A signal with a nonsense published_at would corrupt the time-series
    // collection it is written into, so the mapper must be able to reject it.
    expect(parseGdeltDate('not-a-date')).toBeNull();
    expect(parseGdeltDate('20260901')).toBeNull();
    expect(parseGdeltDate('')).toBeNull();
  });

  it('returns null for a syntactically valid but impossible date', () => {
    expect(parseGdeltDate('20261301T000000Z')).toBeNull();
  });
});

describe('toCoordinates', () => {
  it('returns [longitude, latitude] in GeoJSON order', () => {
    const result = toCoordinates({
      lat: '17.385',
      lon: '78.4867',
      display_name: 'Hyderabad',
    });

    // Latitude first is the classic bug: it puts Hyderabad in the Indian Ocean.
    expect(result).toEqual([78.4867, 17.385]);
  });

  it('returns null rather than NaN coordinates', () => {
    const result = toCoordinates({ lat: '', lon: 'north', display_name: 'nowhere' });

    expect(result).toBeNull();
  });
});
