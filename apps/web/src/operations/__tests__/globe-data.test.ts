import { describe, expect, it } from 'vitest';

import type { Incident } from '@vitalink/contracts';

import { groupPlaces, hasMappedLocation, scopeRecords, sourceFreshness } from '../globe-data';

const incident = (id: string, overrides: Partial<Incident> = {}): Incident => ({
  id,
  kind: 'RECALL',
  title: 'Source record',
  product: 'Listed product',
  company: 'Reported firm',
  status: 'Ongoing',
  classification: 'Class II',
  reason: 'Reported reason',
  publishedAt: null,
  updatedAt: '2026-10-13T00:00:00.000Z',
  sourceUrl: 'https://api.fda.gov/drug/enforcement.json',
  provenance: {
    source_name: 'FDA',
    source_url: 'https://api.fda.gov/drug/enforcement.json',
    fetched_at: '2026-10-13T00:00:00.000Z',
    query: 'test',
  },
  productNdcs: [],
  genericNames: [],
  substances: [],
  lots: null,
  distribution: null,
  presentation: null,
  availability: null,
  location: {
    label: 'Reported city',
    city: 'Reported city',
    country: 'US',
    coordinates: [-97, 30],
    precision: 'recalling-firm city',
    provenance: null,
  },
  ...overrides,
});
describe('geographic evidence boundaries', () => {
  it('never gives national shortage records a city marker even if stale location fields exist', () => {
    const shortage = incident('shortage', { kind: 'SHORTAGE' });
    expect(hasMappedLocation(shortage)).toBe(false);
    expect(groupPlaces([shortage])).toEqual([]);
    expect(scopeRecords([shortage], 'unmapped', [])).toEqual([shortage]);
  });
  it('groups shared city coordinates without dropping individual records or inflating critical counts', () => {
    const critical = incident('one', { classification: 'Class I' });
    const ordinary = incident('two');
    const unlocated = incident('three', { location: null });
    const groups = groupPlaces([critical, ordinary, critical, unlocated]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.incidentIds).toEqual(['one', 'two']);
    expect(groups[0]?.criticalCount).toBe(1);
    expect(scopeRecords([critical, ordinary, unlocated], 'place', groups[0]!.incidentIds)).toEqual([
      critical,
      ordinary,
    ]);
  });
  it('keeps invalid or missing coordinates accessible outside the geographic layer', () => {
    const invalid = incident('invalid', {
      location: {
        label: '',
        city: '',
        country: '',
        coordinates: [200, 95],
        precision: 'recalling-firm city',
        provenance: null,
      },
    });
    const missing = incident('missing', { location: null });
    const valid = incident('valid');
    expect(scopeRecords([invalid, missing, valid], 'mapped', [])).toEqual([valid]);
    expect(scopeRecords([invalid, missing, valid], 'unmapped', [])).toEqual([invalid, missing]);
  });
  it('distinguishes separate geographic places with the same printed city name', () => {
    const first = incident('first');
    const second = incident('second', { location: { ...first.location!, coordinates: [-80, 25] } });
    expect(groupPlaces([first, second])).toHaveLength(2);
  });
  it('reports a real successful ingestion timestamp, never a fabricated live clock', () => {
    expect(sourceFreshness([{ succeededAt: null }, { succeededAt: 'bad date' }])).toBeNull();
    expect(
      sourceFreshness([
        { succeededAt: '2026-10-12T00:00:00.000Z' },
        { succeededAt: '2026-10-13T00:00:00.000Z' },
      ]),
    ).toBe('2026-10-13T00:00:00.000Z');
  });
});
