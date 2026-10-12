import { describe, expect, it } from 'vitest';

import type { NdcProduct } from '@vitalink/connectors';

import { candidateReference } from '../domain/candidate-reference';

const listing: NdcProduct = {
  product_ndc: '63323-519',
  generic_name: 'HEPARIN SODIUM',
  active_ingredients: [{ name: 'HEPARIN SODIUM', strength: "5000 [USP'U]/mL" }],
  dosage_form: 'INJECTION, SOLUTION',
  route: ['INTRAVENOUS'],
};

describe('candidate baseline identity', () => {
  it('does not use an unrelated incident NDC for a medicine linked only by company', () => {
    const result = candidateReference([listing], 'AMOXICILLIN');
    expect(result.productNdc).toBeNull();
    expect(result.strength).toBeNull();
    expect(result.ingredientNames).toEqual([]);
    expect(result.limits?.length).toBeGreaterThan(0);
  });

  it('finds the selected medicine even when its incident identifier is not first', () => {
    const result = candidateReference(
      [{ ...listing, product_ndc: '11111-111', generic_name: 'AMOXICILLIN' }, listing],
      'heparin sodium',
    );
    expect(result.productNdc).toBe(listing.product_ndc);
    expect(result.strength).toBe("5000 [USP'U]/mL");
  });

  it('withholds the presentation baseline when the incident names several strengths', () => {
    const result = candidateReference(
      [
        listing,
        {
          ...listing,
          product_ndc: '63323-520',
          active_ingredients: [{ name: 'HEPARIN SODIUM', strength: "1000 [USP'U]/mL" }],
        },
      ],
      'HEPARIN SODIUM',
    );
    expect(result.productNdc).toBeNull();
    expect(result.strength).toBeNull();
  });

  it('cannot treat a capped lookup as an unambiguous reference', () => {
    expect(candidateReference([listing], 'HEPARIN SODIUM', true).productNdc).toBeNull();
  });
});
