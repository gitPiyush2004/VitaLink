import { describe, expect, it } from 'vitest';

import { real } from '@vitalink/contracts';
import { materialise } from '@vitalink/graph';

import type { DrugEntity, ManufacturerEntity } from '@modules/catalog';

import { buildGraph } from '../domain/build-graph';

const provenance = {
  source_name: 'Test FDA listing',
  source_url: 'https://api.fda.gov/drug/ndc.json',
  query: null,
  fetched_at: '2026-10-12T00:00:00.000Z',
};
function drug(): DrugEntity {
  return {
    id: 'drug:test',
    genericName: 'Test',
    brandNames: [],
    ndcProductCodes: [],
    ingredientIds: ['ingredient:test', 'ingredient:test'],
    manufacturerIds: ['manufacturer:test', 'manufacturer:test'],
    dosageForm: null,
    route: null,
    atcCode: null,
    whoEml: false,
    nlemCritical: false,
    temperatureRequirement: null,
    storageTextRaw: null,
    storageParseReason: null,
    coldChain: false,
    excursionUpperC: null,
    prohibitedTemperatureRanges: [],
    ceilingPriceInr: null,
    dddMg: null,
    zApi: null,
    zPlant: null,
    rawLabelerCount: null,
    labelerCountWasTruncated: false,
    hhiManufacturers: null,
    isSingleSource: false,
    apiTierVisibility: 'NOT_OBSERVED',
    storageConditionsStated: [],
    provenance,
    createdAt: provenance.fetched_at,
  };
}
const maker: ManufacturerEntity = {
  id: 'manufacturer:test',
  name: 'Test',
  nameRaw: 'Test',
  country: null,
  capacityIndex: null,
  registeredFacilityCount: null,
  distinctProductCount: real({
    value: 3,
    unit: 'listings',
    source: {
      name: provenance.source_name,
      url: provenance.source_url,
      query: null,
      fetchedAt: provenance.fetched_at,
    },
  }),
  provenance,
  createdAt: provenance.fetched_at,
};
describe('normalised graph identities', () => {
  it('does not reuse shared labeler counts from another medicine as this medicine’s edge shares', () => {
    const one = {
      ...drug(),
      manufacturerIds: ['manufacturer:test', 'manufacturer:other'],
      ingredientIds: [],
    };
    const other = {
      ...maker,
      id: 'manufacturer:other',
      nameRaw: 'Other labeler',
      distinctProductCount: null,
    };
    const before = buildGraph({ drugs: [one], manufacturers: [maker, other], ingredients: [] });
    const after = buildGraph({
      drugs: [one],
      manufacturers: [{ ...maker, distinctProductCount: null }, other],
      ingredients: [],
    });
    expect(before.edges).toEqual(after.edges);
    expect(before.edges).toHaveLength(2);
    expect(
      before.edges.every((edge) => edge.weight.value === 1 && edge.provenance === one.provenance),
    ).toBe(true);
    expect(before.edges[0]?.weight.provenance.calculation_method).toContain('No production');
  });
  it('does not count a duplicate labeler identity twice or emit duplicate edges', () => {
    const built = buildGraph({
      drugs: [drug()],
      manufacturers: [maker],
      ingredients: [
        {
          id: 'ingredient:test',
          name: 'Test',
          nameRaw: 'Test',
          unii: null,
          atcCode: null,
          hsCodes: [],
          maxCountryDependencyShare: null,
          provenance,
          createdAt: provenance.fetched_at,
        },
      ],
    });
    expect(built.edges).toHaveLength(2);
    expect(built.edges.find((edge) => edge.rel === 'MADE_BY')?.weight.value).toBe(1);
    expect(materialise(built.nodes, built.edges).graph.size).toBe(2);
  });
});
