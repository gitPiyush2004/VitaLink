/**
 * Candidate comparison.
 *
 * Given the product under investigation and a product openFDA lists against the
 * same active ingredient, this decides — per attribute — whether the two
 * **match**, **differ**, or whether the evidence does not say (`unknown`).
 *
 * Three rules hold the design together:
 *
 * 1. **No aggregate score.** Veridion and Lyric both argue the same point from
 *    opposite ends: discovery is only useful if the analyst can see *why* a
 *    result appeared. A single number would collapse five independent findings
 *    — one of which may be `unknown` — into a false ranking.
 * 2. **Hard exclusions are separate from differences.** An expired listing or a
 *    route with no overlap is disqualifying. A different dosage form is a fact
 *    the analyst weighs. Mixing the two would hide the first inside the second.
 * 3. **A shared ingredient is not a substitution.** Nothing here establishes
 *    therapeutic equivalence; only an FDA-published TE code does, and that is
 *    carried separately in `equivalence`.
 */

import { parseFdaDate } from '@vitalink/connectors';
import type {
  CandidateAttribute,
  CandidateEquivalence,
  ProductCandidate,
} from '@vitalink/contracts';

import { normalise } from './matching';
import { ACTIVITY_NOTE, compareStrength, type StrengthVerdict } from './strength';

/** The product the investigation is about: the baseline every candidate is read against. */
export type CandidateReference = {
  productNdc: string | null;
  label: string;
  /** The ingredient the discovery query was run on. */
  ingredient: string;
  ingredientNames: string[];
  strength: string | null;
  dosageForm: string | null;
  routes: string[];
  marketingCategory: string | null;
  limits?: string[];
};

/** The subset of an openFDA NDC listing this comparison needs. */
export type CandidateSource = {
  productNdc: string;
  genericName: string;
  brandName: string | null;
  labeler: string | null;
  ingredients: { name: string; strength: string | null }[];
  dosageForm: string | null;
  routes: string[];
  marketingCategory: string | null;
  marketingStartDate: string | null;
  listingExpiryDate: string | null;
  finished: boolean | null;
};

function set(values: string[]): Set<string> {
  return new Set(values.map(normalise).filter((one) => one !== ''));
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((one) => right.has(one));
}

function ingredients(reference: CandidateReference, source: CandidateSource): CandidateAttribute {
  const ours = set(reference.ingredientNames);
  const theirs = set(source.ingredients.map((one) => one.name));
  const candidate = source.ingredients.map((one) => one.name).join(' + ');
  const common = {
    attribute: 'ingredients' as const,
    reference: reference.ingredientNames.join(' + '),
    candidate,
  };
  if (ours.size === 0 || theirs.size === 0) {
    return {
      ...common,
      verdict: 'unknown',
      note: 'One listing does not state its active ingredients.',
    };
  }
  if (sameSet(ours, theirs)) {
    return { ...common, verdict: 'match', note: 'The same active ingredients are listed.' };
  }
  const extra = [...theirs].filter((one) => !ours.has(one)).length;
  return {
    ...common,
    verdict: 'differs',
    note:
      extra > 0
        ? `Carries ${String(extra)} active ingredient(s) the investigated product does not.`
        : 'Does not list every active ingredient of the investigated product.',
  };
}

/** The strength of the ingredient the search was run on, not of the whole product. */
function strengthOf(source: CandidateSource, ingredient: string): string | null {
  const wanted = normalise(ingredient);
  return source.ingredients.find((one) => normalise(one.name) === wanted)?.strength ?? null;
}

function strength(reference: CandidateReference, source: CandidateSource): CandidateAttribute {
  const candidate = strengthOf(source, reference.ingredient);
  if (reference.ingredientNames.length !== 1 || source.ingredients.length !== 1) {
    return {
      attribute: 'strength',
      verdict: 'unknown',
      reference: reference.strength,
      candidate,
      note: 'Combination-product strengths are not fully compared. The first ingredient alone cannot establish a strength match.',
    };
  }
  const verdict = compareStrength(reference.strength, candidate);
  const notes: Record<StrengthVerdict, string> = {
    same: `Same ${reference.ingredient} concentration once units are normalised. ${ACTIVITY_NOTE}`,
    differs: `A different ${reference.ingredient} concentration. Compare the printed values before acting.`,
    unknown:
      'The printed strengths cannot be compared: one is missing, unreadable, or uses units that are not interchangeable.',
  };
  return {
    attribute: 'strength',
    verdict: verdict === 'same' ? 'match' : verdict,
    reference: reference.strength,
    candidate,
    note: notes[verdict],
  };
}

function dosageForm(reference: CandidateReference, source: CandidateSource): CandidateAttribute {
  const common = {
    attribute: 'dosageForm' as const,
    reference: reference.dosageForm,
    candidate: source.dosageForm,
  };
  if (reference.dosageForm === null || source.dosageForm === null) {
    return { ...common, verdict: 'unknown', note: 'One listing does not state a dosage form.' };
  }
  if (normalise(reference.dosageForm) === normalise(source.dosageForm)) {
    return {
      ...common,
      verdict: 'match',
      note: 'FDA prints the same dosage form on both listings.',
    };
  }
  // FDA prints related forms differently ("INJECTION, SOLUTION" against
  // "INJECTABLE"). Both strings are shown rather than guessing they agree.
  return {
    ...common,
    verdict: 'differs',
    note: 'FDA prints a different dosage form. Related forms are spelled inconsistently across listings; read both values.',
  };
}

/**
 * Whether the two listings share any administration route.
 *
 * Null means at least one listing does not state a route — which is not the
 * same as not sharing one, and so must never trigger the exclusion below.
 */
function sharesRoute(reference: CandidateReference, source: CandidateSource): boolean | null {
  const ours = set(reference.routes);
  const theirs = set(source.routes);
  if (ours.size === 0 || theirs.size === 0) return null;
  return [...theirs].some((one) => ours.has(one));
}

function route(reference: CandidateReference, source: CandidateSource): CandidateAttribute {
  const ours = set(reference.routes);
  const theirs = set(source.routes);
  const common = {
    attribute: 'route' as const,
    reference: reference.routes.join(', '),
    candidate: source.routes.join(', '),
  };
  const shared = sharesRoute(reference, source);
  if (shared === null) {
    return {
      ...common,
      verdict: 'unknown',
      note: 'One listing does not state an administration route.',
    };
  }
  if (sameSet(ours, theirs)) {
    return { ...common, verdict: 'match', note: 'The same administration routes are listed.' };
  }
  return {
    ...common,
    verdict: 'differs',
    note: shared
      ? 'Shares at least one route, but the listed sets are not identical.'
      : 'No administration route in common.',
  };
}

function marketingCategory(
  reference: CandidateReference,
  source: CandidateSource,
): CandidateAttribute {
  const common = {
    attribute: 'marketingCategory' as const,
    reference: reference.marketingCategory,
    candidate: source.marketingCategory,
  };
  if (reference.marketingCategory === null || source.marketingCategory === null) {
    return {
      ...common,
      verdict: 'unknown',
      note: 'One listing does not state a marketing category.',
    };
  }
  const same = normalise(reference.marketingCategory) === normalise(source.marketingCategory);
  return {
    ...common,
    verdict: same ? 'match' : 'differs',
    note: same
      ? 'Both products are listed under the same FDA marketing category.'
      : 'A different FDA marketing category, which is how the product reached the market — not a quality judgement.',
  };
}

const ISO_DATE_LENGTH = 10;

function expired(listingExpiryDate: string | null, asOf: Date): boolean {
  if (listingExpiryDate === null) return false;
  const expiry = parseFdaDate(listingExpiryDate);
  // A date-only listing remains current throughout its stated UTC calendar day.
  return expiry !== null && expiry < asOf.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** Disqualifying facts, each stated as the reason an analyst would need to hear. */
function exclusionsFor(input: {
  reference: CandidateReference;
  source: CandidateSource;
  equivalence: CandidateEquivalence | null;
  asOf: Date;
}): string[] {
  const { reference, source, equivalence, asOf } = input;
  const reasons: string[] = [];
  if (reference.productNdc !== null && source.productNdc === reference.productNdc) {
    reasons.push('This is the product under investigation.');
  }
  if (source.finished === false) {
    reasons.push('Not a finished drug product: this listing is a bulk or unfinished ingredient.');
  }
  if (sharesRoute(reference, source) === false) {
    reasons.push('No administration route in common with the investigated product.');
  }
  if (expired(source.listingExpiryDate, asOf)) {
    reasons.push(`The FDA listing expired on ${source.listingExpiryDate ?? ''}.`);
  }
  if (equivalence?.marketingStatus === 'Discontinued') {
    reasons.push('Drugs@FDA records this approved product as Discontinued.');
  }
  return reasons;
}

export function buildCandidate(input: {
  reference: CandidateReference;
  source: CandidateSource;
  equivalence: CandidateEquivalence | null;
  reportedShortage: ProductCandidate['reportedShortage'];
  asOf: Date;
}): ProductCandidate {
  const { reference, source, equivalence, reportedShortage, asOf } = input;
  const attributes = [
    ingredients(reference, source),
    strength(reference, source),
    dosageForm(reference, source),
    route(reference, source),
    marketingCategory(reference, source),
  ];
  return {
    productNdc: source.productNdc,
    genericName: source.genericName,
    brandName: source.brandName,
    labeler: source.labeler,
    ingredients: source.ingredients,
    dosageForm: source.dosageForm,
    routes: source.routes,
    marketingCategory: source.marketingCategory,
    marketingStartDate: source.marketingStartDate,
    listingExpiryDate: source.listingExpiryDate,
    attributes,
    exclusions: exclusionsFor({ reference, source, equivalence, asOf }),
    equivalence,
    reportedShortage,
  };
}

/**
 * Orders candidates for display without inventing a score.
 *
 * Excluded products sink to the bottom; above them, products are ordered by how
 * many attributes are confirmed matches, then by how few are unknown — so a
 * candidate with better evidence outranks one that merely lacks contradictions.
 */
export function rankCandidates(candidates: ProductCandidate[]): ProductCandidate[] {
  const matches = (one: ProductCandidate): number =>
    one.attributes.filter((a) => a.verdict === 'match').length;
  const unknowns = (one: ProductCandidate): number =>
    one.attributes.filter((a) => a.verdict === 'unknown').length;
  return [...candidates].sort(
    (a, b) =>
      Number(a.exclusions.length > 0) - Number(b.exclusions.length > 0) ||
      matches(b) - matches(a) ||
      unknowns(a) - unknowns(b) ||
      a.productNdc.localeCompare(b.productNdc),
  );
}
