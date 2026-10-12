import { describe, expect, it } from 'vitest';

import type { CandidateEquivalence, ProductCandidate } from '@vitalink/contracts';

import {
  buildCandidate,
  rankCandidates,
  type CandidateReference,
  type CandidateSource,
} from '../domain/candidates';

const AS_OF = new Date('2026-10-12T00:00:00.000Z');

const reference: CandidateReference = {
  productNdc: '63323-519',
  label: 'HEPARIN SODIUM',
  ingredient: 'HEPARIN SODIUM',
  ingredientNames: ['HEPARIN SODIUM'],
  strength: "5000 [USP'U]/mL",
  dosageForm: 'INJECTION, SOLUTION',
  routes: ['INTRAVENOUS', 'SUBCUTANEOUS'],
  marketingCategory: 'ANDA',
};

function source(over: Partial<CandidateSource> = {}): CandidateSource {
  return {
    productNdc: '71288-406',
    genericName: 'Heparin Sodium',
    brandName: 'Heparin Sodium',
    labeler: 'Meitheal Pharmaceuticals Inc.',
    ingredients: [{ name: 'HEPARIN SODIUM', strength: "5000 [USP'U]/mL" }],
    dosageForm: 'INJECTION, SOLUTION',
    routes: ['INTRAVENOUS', 'SUBCUTANEOUS'],
    marketingCategory: 'ANDA',
    marketingStartDate: '20200715',
    listingExpiryDate: '20271231',
    finished: true,
    ...over,
  };
}

function build(
  over: Partial<CandidateSource> = {},
  equivalence: CandidateEquivalence | null = null,
) {
  return buildCandidate({
    reference,
    source: source(over),
    equivalence,
    reportedShortage: null,
    asOf: AS_OF,
  });
}

const verdictOf = (one: ProductCandidate, attribute: string): string =>
  one.attributes.find((a) => a.attribute === attribute)?.verdict ?? 'missing';

describe('attribute comparison', () => {
  it('matches every attribute on an equivalent listing', () => {
    const candidate = build();
    expect(candidate.attributes.every((one) => one.verdict === 'match')).toBe(true);
    expect(candidate.exclusions).toEqual([]);
  });

  it('reports a different concentration rather than matching on the printed number', () => {
    const candidate = build({
      ingredients: [{ name: 'HEPARIN SODIUM', strength: "5000 [USP'U]/100mL" }],
    });
    expect(verdictOf(candidate, 'strength')).toBe('differs');
  });

  it('calls an unreadable strength unknown, never a match', () => {
    const candidate = build({ ingredients: [{ name: 'HEPARIN SODIUM', strength: null }] });
    expect(verdictOf(candidate, 'strength')).toBe('unknown');
  });

  it('does not claim complete strength agreement from one ingredient of a combination', () => {
    const combination = { ...reference, ingredientNames: ['HEPARIN SODIUM', 'SODIUM CHLORIDE'] };
    const candidate = buildCandidate({
      reference: combination,
      source: source({
        ingredients: [
          { name: 'HEPARIN SODIUM', strength: "5000 [USP'U]/mL" },
          { name: 'SODIUM CHLORIDE', strength: '9 mg/mL' },
        ],
      }),
      equivalence: null,
      reportedShortage: null,
      asOf: AS_OF,
    });
    expect(verdictOf(candidate, 'ingredients')).toBe('match');
    expect(verdictOf(candidate, 'strength')).toBe('unknown');
  });

  it('flags a combination product as carrying extra active ingredients', () => {
    const candidate = build({
      ingredients: [
        { name: 'HEPARIN SODIUM', strength: "5000 [USP'U]/mL" },
        { name: 'SODIUM CHLORIDE', strength: '9 mg/mL' },
      ],
    });
    expect(verdictOf(candidate, 'ingredients')).toBe('differs');
    expect(candidate.attributes.find((one) => one.attribute === 'ingredients')?.note).toContain(
      '1 active ingredient',
    );
    // A different ingredient set is a fact to weigh, not a disqualification.
    expect(candidate.exclusions).toEqual([]);
  });

  it('does not treat differently spelled dosage forms as equal', () => {
    expect(verdictOf(build({ dosageForm: 'INJECTABLE' }), 'dosageForm')).toBe('differs');
  });

  it('separates a partial route overlap from no overlap', () => {
    expect(verdictOf(build({ routes: ['INTRAVENOUS'] }), 'route')).toBe('differs');
    expect(build({ routes: ['INTRAVENOUS'] }).exclusions).toEqual([]);
    expect(build({ routes: ['ORAL'] }).exclusions).toContain(
      'No administration route in common with the investigated product.',
    );
  });

  it('does not exclude on route when a listing states none', () => {
    const candidate = build({ routes: [] });
    expect(verdictOf(candidate, 'route')).toBe('unknown');
    expect(candidate.exclusions).toEqual([]);
  });
});

describe('hard exclusions', () => {
  it('excludes the investigated product itself', () => {
    expect(build({ productNdc: '63323-519' }).exclusions).toContain(
      'This is the product under investigation.',
    );
  });

  it('excludes bulk ingredient listings', () => {
    expect(build({ finished: false }).exclusions).toContain(
      'Not a finished drug product: this listing is a bulk or unfinished ingredient.',
    );
  });

  it('excludes an expired listing but keeps a future one', () => {
    expect(build({ listingExpiryDate: '2025-01-31' }).exclusions.join(' ')).toContain('expired');
    expect(build({ listingExpiryDate: null }).exclusions).toEqual([]);
  });

  it('handles compact dates, expiry-day boundaries, and invalid calendar dates', () => {
    expect(build({ listingExpiryDate: '20250131' }).exclusions.join(' ')).toContain('expired');
    expect(build({ listingExpiryDate: '20261012' }).exclusions).toEqual([]);
    expect(build({ listingExpiryDate: '20260230' }).exclusions).toEqual([]);
    expect(build({ listingExpiryDate: 'not a date' }).exclusions).toEqual([]);
  });

  it('excludes a discontinued approved product', () => {
    const equivalence: CandidateEquivalence = {
      applicationNumber: 'ANDA212061',
      sponsor: 'EMERGE BIOSCIENCE',
      teCode: null,
      teCodeNote: 'unused here',
      marketingStatus: 'Discontinued',
      isReferenceDrug: false,
    };
    expect(build({}, equivalence).exclusions).toContain(
      'Drugs@FDA records this approved product as Discontinued.',
    );
  });
});

describe('ranking', () => {
  it('sinks excluded products and prefers confirmed matches over absent evidence', () => {
    const excluded = build({ productNdc: '63323-519' });
    const unknownStrength = build({
      productNdc: '11111-111',
      ingredients: [{ name: 'HEPARIN SODIUM', strength: null }],
    });
    const full = build({ productNdc: '22222-222' });

    const order = rankCandidates([excluded, unknownStrength, full]).map((one) => one.productNdc);
    expect(order).toEqual(['22222-222', '11111-111', '63323-519']);
  });

  it('is a pure function of its input', () => {
    const input = [build({ productNdc: '33333-333' }), build({ productNdc: '22222-222' })];
    const copy = [...input];
    rankCandidates(input);
    expect(input).toEqual(copy);
  });
});
