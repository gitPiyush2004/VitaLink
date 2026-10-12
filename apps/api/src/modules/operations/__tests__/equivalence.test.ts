import { describe, expect, it } from 'vitest';

import {
  resolveEquivalence,
  TE_CODE_ABSENT_NOTE,
  TE_CODE_AMBIGUOUS_NOTE,
  TE_CODE_CONFLICT_NOTE,
  type ApprovalRecord,
} from '../domain/equivalence';

function product(over: Partial<ApprovalRecord['products'][number]> = {}) {
  return {
    brandName: 'HEPARIN SODIUM',
    teCode: 'AP' as string | null,
    marketingStatus: 'Prescription' as string | null,
    referenceDrug: 'No' as string | null,
    strengths: ['200 UNITS/100ML'] as (string | null)[],
    ...over,
  };
}

function record(products: ApprovalRecord['products']): ApprovalRecord {
  return { applicationNumber: 'NDA018609', sponsor: 'BAXTER HLTHCARE', products };
}

describe('resolveEquivalence', () => {
  it('uses the only product when an application holds one', () => {
    const result = resolveEquivalence(record([product()]), null);
    expect(result).toMatchObject({ teCode: 'AP', marketingStatus: 'Prescription' });
  });

  it('selects by strength across differently printed units', () => {
    // 2,000 units in 1000 mL is the same concentration as 200 in 100 mL.
    const result = resolveEquivalence(
      record([
        product({ teCode: 'AB', strengths: ['500 UNITS/100ML'] }),
        product({ teCode: 'AP', strengths: ['2,000 UNITS/1000ML'] }),
      ]),
      "200 [USP'U]/100mL",
    );
    expect(result.teCode).toBe('AP');
  });

  it('reports a code the matching products agree on rather than withholding it', () => {
    // The real NDA018609 shape: several products at one concentration, all AP.
    const result = resolveEquivalence(
      record([
        product({ teCode: 'AP' }),
        product({ teCode: 'AP' }),
        product({ teCode: 'AB', strengths: ['500 UNITS/100ML'] }),
      ]),
      "200 [USP'U]/100mL",
    );
    expect(result.teCode).toBe('AP');
  });

  it('withholds a code the matching products disagree about', () => {
    const result = resolveEquivalence(
      record([product({ teCode: 'AP' }), product({ teCode: null })]),
      "200 [USP'U]/100mL",
    );
    expect(result.teCode).toBeNull();
    expect(result.teCodeNote).toBe(TE_CODE_CONFLICT_NOTE);
  });

  it('withholds when the strength places the listing nowhere in the application', () => {
    const result = resolveEquivalence(
      record([product({ strengths: ['500 UNITS/100ML'] }), product({ strengths: ['1 g'] })]),
      "200 [USP'U]/100mL",
    );
    expect(result.teCode).toBeNull();
    expect(result.teCodeNote).toBe(TE_CODE_AMBIGUOUS_NOTE);
    expect(result.marketingStatus).toBeNull();
  });

  it('says an absent code is an absence of evidence, not non-equivalence', () => {
    const result = resolveEquivalence(record([product({ teCode: null })]), null);
    expect(result.teCodeNote).toBe(TE_CODE_ABSENT_NOTE);
    expect(TE_CODE_ABSENT_NOTE).toContain('not a finding of non-equivalence');
  });

  it('withholds a marketing status the matching products disagree about', () => {
    const result = resolveEquivalence(
      record([
        product({ marketingStatus: 'Prescription' }),
        product({ marketingStatus: 'Discontinued' }),
      ]),
      "200 [USP'U]/100mL",
    );
    expect(result.marketingStatus).toBeNull();
  });

  it('marks a reference drug when any matching product is one', () => {
    expect(
      resolveEquivalence(record([product({ referenceDrug: 'Yes' })]), null).isReferenceDrug,
    ).toBe(true);
  });
});
