import { describe, expect, it } from 'vitest';

import { compareStrength, parseStrength } from '../domain/strength';

describe('parseStrength', () => {
  it('reads the concentration formats openFDA actually prints', () => {
    expect(parseStrength("5000 [USP'U]/mL")).toMatchObject({
      amount: 5000,
      amountFamily: 'usp_unit',
      per: 1,
      perFamily: 'volume',
    });
    // A denominator with its own count: 5000 units spread across 100 mL.
    expect(parseStrength('5,000 UNITS/100ML')).toMatchObject({ amount: 5000, per: 100 });
    expect(parseStrength('500 mg')).toMatchObject({ amount: 500, per: null, perFamily: null });
    // Units are normalised onto the family base: 1 g is 1000 mg.
    expect(parseStrength('1 g')).toMatchObject({ amount: 1000, amountFamily: 'mass' });
    expect(parseStrength('250 mcg/mL')).toMatchObject({ amount: 0.25, per: 1 });
  });

  it('returns null rather than a guess when the text cannot be read', () => {
    for (const raw of ['', '   ', 'as directed', '10 widgets', null, undefined, '5 mg/0 mL']) {
      expect(parseStrength(raw)).toBeNull();
    }
  });
});

describe('compareStrength', () => {
  it('does not call two different concentrations the same because the numbers match', () => {
    // The failure this function exists to prevent. Both print "5000"; one is a
    // hundredfold weaker.
    expect(compareStrength("5000 [USP'U]/mL", '5,000 UNITS/100ML')).toBe('differs');
  });

  it('matches equal concentrations across unit spellings and scales', () => {
    expect(compareStrength("5000 [USP'U]/mL", '5000 UNITS/mL')).toBe('same');
    expect(compareStrength('1 g', '1000 mg')).toBe('same');
    expect(compareStrength('1 mg/mL', '1000 mcg/mL')).toBe('same');
  });

  it('separates an absolute amount from a concentration', () => {
    expect(compareStrength('500 mg', '500 mg/mL')).toBe('differs');
  });

  it('answers unknown when either side is unreadable', () => {
    expect(compareStrength('500 mg', 'as directed')).toBe('unknown');
    expect(compareStrength(null, '500 mg')).toBe('unknown');
    expect(compareStrength(undefined, undefined)).toBe('unknown');
  });

  it('refuses to equate International Units with USP Units', () => {
    // Not interchangeable for every substance, so the honest answer is unknown.
    expect(compareStrength('5000 [IU]/mL', "5000 [USP'U]/mL")).toBe('unknown');
  });

  it('answers unknown across incommensurable families rather than differs', () => {
    expect(compareStrength('500 mg', "500 [USP'U]")).toBe('unknown');
  });
});

/**
 * Every distinct strength openFDA printed for `active_ingredients.name:"HEPARIN
 * SODIUM"` on 12 October 2026, copied verbatim. These are the shapes the parser
 * has to survive, including `.5mL` — a leading decimal point with no integer
 * part, which the first version of the number pattern rejected outright.
 */
const PUBLISHED_HEPARIN_STRENGTHS = [
  '1 g/g',
  '1 kg/kg',
  "1000 [USP'U]/mL",
  "10000 [USP'U]/100mL",
  "10000 [USP'U]/mL",
  "140 [USP'U]/140[USP'U]",
  "200 [USP'U]/100mL",
  "2000 [USP'U]/2mL",
  "20000 [USP'U]/mL",
  "4000 [USP'U]/100mL",
  '5 g/100mL',
  '5 kg/5kg',
  "5000 [USP'U]/.5mL",
  "5000 [USP'U]/100mL",
  "5000 [USP'U]/mL",
  '7 kg/7kg',
];

describe('against strengths openFDA actually published', () => {
  it('parses every published heparin strength', () => {
    expect(PUBLISHED_HEPARIN_STRENGTHS.filter((one) => parseStrength(one) === null)).toEqual([]);
  });

  it('resolves the concentrations those listings describe', () => {
    // Same concentration, printed over different volumes.
    expect(compareStrength("5000 [USP'U]/.5mL", "10000 [USP'U]/mL")).toBe('same');
    expect(compareStrength("5000 [USP'U]/100mL", "50 [USP'U]/mL")).toBe('same');
    // Bulk API listings: a mass ratio of one, however it is spelled.
    expect(compareStrength('1 g/g', '1 kg/kg')).toBe('same');
    // The pair a string comparison would call equal and a naive numeric
    // comparison would also call equal.
    expect(compareStrength("5000 [USP'U]/mL", "5000 [USP'U]/100mL")).toBe('differs');
    // A dimensionless activity ratio against a dimensionless mass ratio.
    expect(compareStrength("140 [USP'U]/140[USP'U]", '1 kg/kg')).toBe('unknown');
  });
});
