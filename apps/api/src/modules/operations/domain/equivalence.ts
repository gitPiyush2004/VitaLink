/**
 * Resolving a Drugs@FDA approval record onto one NDC listing.
 *
 * An application can hold many approved products — `NDA017029` carries sixteen
 * — so the application number alone does not identify which TE code and
 * marketing status belong to the listing in hand. The product is selected by
 * comparing printed strengths, and when that cannot be done unambiguously the
 * TE code is withheld rather than guessed: attaching the wrong product's code
 * would make an equivalence claim the evidence does not support.
 */

import type { CandidateEquivalence } from '@vitalink/contracts';

import { compareStrength } from './strength';

export const TE_CODE_ABSENT_NOTE =
  'FDA publishes no therapeutic equivalence code for this approved product. That is an absence of evidence, not a finding of non-equivalence.';

export const TE_CODE_AMBIGUOUS_NOTE =
  'The available presentation evidence does not identify a matching approved product. The equivalence code is withheld rather than guessed.';

export const TE_CODE_CONFLICT_NOTE =
  'Several approved products share this strength and FDA does not publish the same equivalence code for all of them. The code is withheld because the evidence disagrees.';

function teCodePresentNote(code: string): string {
  return `FDA publishes therapeutic equivalence code ${code} for this approved product. The code applies to the approved product; confirm it covers this presentation and lot before relying on it.`;
}

/**
 * The single value every candidate agrees on, or `conflict`.
 *
 * Several approved products routinely share one strength — `NDA018609` lists
 * three at 2 USP units/mL — and when they all carry the same code there is
 * nothing ambiguous to withhold. Only genuine disagreement is suppressed.
 */
function agreed<T>(values: T[]): { value: T } | 'conflict' | null {
  if (values.length === 0) return null;
  const first = values[0] as T;
  return values.every((one) => one === first) ? { value: first } : 'conflict';
}

/** The shape this resolver needs from a Drugs@FDA record. */
export type ApprovalRecord = {
  applicationNumber: string;
  sponsor: string | null;
  products: {
    brandName: string | null;
    teCode: string | null;
    marketingStatus: string | null;
    referenceDrug: string | null;
    strengths: (string | null)[];
  }[];
};

type ApprovalProduct = ApprovalRecord['products'][number];

/**
 * The approved products this listing's printed strength identifies.
 *
 * An application holding exactly one product needs no strength to disambiguate.
 * Otherwise the strength must select at least one; an empty result means the
 * listing could not be placed within the application at all.
 */
function selectProducts(record: ApprovalRecord, strength: string | null): ApprovalProduct[] {
  if (record.products.length <= 1) {
    const only = record.products[0];
    const contradicted =
      strength !== null &&
      only !== undefined &&
      only.strengths.length > 0 &&
      only.strengths.every((one) => compareStrength(strength, one) === 'differs');
    return contradicted ? [] : record.products;
  }
  if (strength === null) return [];
  return record.products.filter((product) =>
    product.strengths.some((one) => compareStrength(strength, one) === 'same'),
  );
}

function teCodeOf(matched: ApprovalProduct[]): Pick<CandidateEquivalence, 'teCode' | 'teCodeNote'> {
  const consensus = agreed(matched.map((one) => one.teCode));
  if (consensus === null) return { teCode: null, teCodeNote: TE_CODE_AMBIGUOUS_NOTE };
  if (consensus === 'conflict') return { teCode: null, teCodeNote: TE_CODE_CONFLICT_NOTE };
  const code = consensus.value;
  return {
    teCode: code,
    teCodeNote: code === null ? TE_CODE_ABSENT_NOTE : teCodePresentNote(code),
  };
}

export function resolveEquivalence(
  record: ApprovalRecord,
  strength: string | null,
  ingredientCount = 1,
): CandidateEquivalence {
  const matched = ingredientCount === 1 ? selectProducts(record, strength) : [];
  const status = agreed(matched.map((one) => one.marketingStatus));
  return {
    applicationNumber: record.applicationNumber,
    sponsor: record.sponsor,
    ...teCodeOf(matched),
    ...(ingredientCount !== 1
      ? {
          teCodeNote:
            'Combination-product approval matching requires every active ingredient and strength; the equivalence code is withheld.',
        }
      : {}),
    // A conflicting marketing status is withheld for the same reason as a
    // conflicting code: reporting one of several disagreeing values as the
    // answer would be a fabrication.
    marketingStatus: status !== null && status !== 'conflict' ? status.value : null,
    isReferenceDrug: matched.some((one) => one.referenceDrug?.toLowerCase() === 'yes'),
  };
}
