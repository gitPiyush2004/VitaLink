import type { NdcProduct } from '@vitalink/connectors';

import type { CandidateReference } from './candidates';
import { normalise } from './matching';

/** The incident may name several presentations, or a different related medicine. */
export function candidateReference(
  products: NdcProduct[],
  genericName: string,
  incomplete = false,
): CandidateReference {
  const matches = products.filter(
    (p) => normalise(p.generic_name ?? '') === normalise(genericName),
  );
  const fallback: CandidateReference = {
    productNdc: null,
    label: genericName,
    ingredient: genericName,
    ingredientNames: [],
    strength: null,
    dosageForm: null,
    routes: [],
    marketingCategory: null,
    limits: [
      'No unambiguous incident listing identifies the selected medicine. Presentation attributes remain unknown.',
    ],
  };
  if (incomplete || matches.length !== 1) return fallback;
  const product = matches[0];
  if (product === undefined) return fallback;
  return referenceFromListing(product, genericName);
}

function referenceFromListing(product: NdcProduct, genericName: string): CandidateReference {
  const ingredients = product.active_ingredients ?? [];
  return {
    productNdc: product.product_ndc,
    label: product.generic_name ?? genericName,
    ingredient: ingredients[0]?.name ?? genericName,
    ingredientNames: ingredients.map((one) => one.name),
    strength: ingredients[0]?.strength ?? null,
    dosageForm: product.dosage_form ?? null,
    routes: product.route ?? [],
    marketingCategory: product.marketing_category ?? null,
    limits: [],
  };
}
