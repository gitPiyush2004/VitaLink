import { describe, expect, it } from 'vitest';

import type { FdaPage, NdcProduct } from '@vitalink/connectors';

import { candidateReference } from '../domain/candidate-reference';
import { CandidateDiscovery } from '../operations.candidates';

const provenance = {
  source_name: 'FDA test port',
  source_url: 'https://api.fda.gov/drug/ndc.json',
  query: 'unit regression',
  fetched_at: '2026-10-12T00:00:00.000Z',
};
const baseline: NdcProduct = {
  product_ndc: 'baseline-1',
  generic_name: 'HEPARIN SODIUM',
  active_ingredients: [{ name: 'HEPARIN SODIUM', strength: '5000 UNITS/mL' }],
  dosage_form: 'INJECTION, SOLUTION',
  route: ['INTRAVENOUS'],
  marketing_category: 'ANDA',
  finished: true,
};
function page<T>(data: T[], total: number | null): FdaPage<T> {
  return { data, total, provenance, rawBody: '{}', fromCache: false };
}
function discovery(products: NdcProduct[], total: number | null, shortageTotal = 0) {
  return new CandidateDiscovery({
    searchNdc: () => Promise.resolve(page(products, total)),
    searchDrugsFda: () => Promise.resolve(page([], 0)),
    searchShortages: () => Promise.resolve(page([], shortageTotal)),
  });
}
const reference = candidateReference([baseline], 'HEPARIN SODIUM');
const fullPage = Array.from({ length: 100 }, (_, index) => ({
  ...baseline,
  product_ndc: `candidate-${String(index)}`,
}));

describe('candidate discovery source coverage', () => {
  it('retains and excludes competing listings with the same NDC rather than selecting one silently', async () => {
    const first = { ...baseline, product_ndc: 'duplicate' };
    const second = {
      ...first,
      finished: false,
      route: [],
      marketing_category: 'DRUG FOR FURTHER PROCESSING',
    };
    const result = await discovery([first, second], 2).discover(reference);
    expect(result.candidates).toHaveLength(2);
    expect(
      result.candidates.every((one) =>
        one.exclusions.some((reason) => reason.includes('Multiple retrieved listings')),
      ),
    ).toBe(true);
    expect(result.candidates.some((one) => one.routes.length === 0)).toBe(true);
  });
  it('distinguishes a complete 100-row result from a capped one', async () => {
    const complete = await discovery(fullPage, 100).discover(reference);
    expect(complete.coverage).toMatchObject({
      reportedTotal: 100,
      retrieved: 100,
      truncated: false,
    });
    expect(complete.limits.some((limit) => limit.includes('Retrieval is incomplete'))).toBe(false);
    const capped = await discovery(fullPage, 101).discover(reference);
    expect(capped.coverage.truncated).toBe(true);
    expect(capped.limits.some((limit) => limit.includes('Retrieval is incomplete'))).toBe(true);
  });

  it('preserves unknown total instead of fabricating one from the page length', async () => {
    const result = await discovery(fullPage, null).discover(reference);
    expect(result.coverage).toMatchObject({ reportedTotal: null, retrieved: 100, truncated: true });
  });

  it('discloses incomplete shortage joins and unreadable listing dates', async () => {
    const result = await discovery(
      [{ ...baseline, product_ndc: 'candidate-1', listing_expiration_date: '20270230' }],
      1,
      101,
    ).discover(reference);
    expect(result.limits.join(' ')).toContain('Shortage retrieval is incomplete');
    expect(result.limits.join(' ')).toContain('listing currency is unknown');
    expect(result.candidates[0]?.exclusions.join(' ')).not.toContain('expired');
  });

  it('selects the medicine being analysed even when an incident names another medicine first', async () => {
    const service = discovery(
      [{ ...baseline, product_ndc: 'other', generic_name: 'AMOXICILLIN' }, baseline],
      2,
    );
    const result = await service.reference({
      productNdcs: ['other', 'baseline-1'],
      genericName: 'HEPARIN SODIUM',
    });
    expect(result.reference.productNdc).toBe('baseline-1');
    const missing = await service.reference({
      productNdcs: ['other'],
      genericName: 'HEPARIN SODIUM',
    });
    expect(missing.reference.productNdc).toBeNull();
    expect(missing.reference.strength).toBeNull();
  });
});
