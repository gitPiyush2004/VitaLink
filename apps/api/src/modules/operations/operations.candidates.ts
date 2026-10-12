/**
 * Candidate discovery against live openFDA.
 *
 * The local catalogue holds only the medicines an investigation has pulled in,
 * so discovery cannot be answered from it — the question "what else exists?"
 * has to go to the source. Three endpoints are involved:
 *
 *   drug/ndc        the candidate universe, queried by active ingredient
 *   drug/drugsfda   approval records, TE codes and marketing status
 *   drug/shortages  FDA's own reported availability for those products
 *
 * Approval lookups are batched into OR'd queries rather than issued one per
 * application: openFDA allows 240 requests/minute across all endpoints, and a
 * hundred sequential lookups at the registry's 250 ms spacing would take half a
 * minute on its own.
 *
 * Coverage is reported, never silently capped. `truncated` tells the analyst
 * that more products exist than were retrieved, which is the difference between
 * "these are the alternatives" and "these are the alternatives we could see".
 */

import type { NdcProduct, OpenFdaClient } from '@vitalink/connectors';
import type { CandidateSet, Provenance, ProductCandidate } from '@vitalink/contracts';

import { buildCandidate, rankCandidates, type CandidateReference } from './domain/candidates';
import { resolveEquivalence, type ApprovalRecord } from './domain/equivalence';

/** openFDA pages at 100; one page keeps discovery inside a single request. */
const CANDIDATE_LIMIT = 100;
/** Application numbers per batched approval query. */
const APPROVAL_BATCH = 25;
/** Batches to issue. Caps worst-case latency; any shortfall is reported. */
const MAX_APPROVAL_BATCHES = 4;
const SHORTAGE_LIMIT = 100;

function quote(value: string): string {
  return value.replace(/["\\]/g, ' ').trim();
}

type Source = Parameters<typeof buildCandidate>[0]['source'];

function toIngredients(product: NdcProduct): Source['ingredients'] {
  return (product.active_ingredients ?? []).map((one) => ({
    name: one.name,
    strength: one.strength ?? null,
  }));
}

function toIdentity(
  product: NdcProduct,
): Pick<Source, 'productNdc' | 'genericName' | 'brandName' | 'labeler'> {
  return {
    productNdc: product.product_ndc,
    genericName: product.generic_name ?? product.product_ndc,
    brandName: product.brand_name ?? null,
    labeler: product.labeler_name ?? null,
  };
}

function toSource(product: NdcProduct): Source {
  return {
    ...toIdentity(product),
    ingredients: toIngredients(product),
    dosageForm: product.dosage_form ?? null,
    routes: product.route ?? [],
    marketingCategory: product.marketing_category ?? null,
    marketingStartDate: product.marketing_start_date ?? null,
    listingExpiryDate: product.listing_expiration_date ?? null,
    finished: product.finished ?? null,
  };
}

export class CandidateDiscovery {
  constructor(private readonly fda: OpenFdaClient) {}

  /**
   * Builds the baseline from the incident's own product NDC.
   *
   * The incident names a specific listing, and that listing — not the generic
   * name — carries the strength, dosage form and route a candidate has to be
   * read against. When the incident reports no NDC (shortage records often do
   * not), the baseline falls back to the generic name with its attributes
   * unknown, and every attribute comparison correctly returns `unknown` rather
   * than inventing a reference to match against.
   */
  async reference(input: {
    productNdcs: string[];
    genericName: string;
  }): Promise<{ reference: CandidateReference; provenance: Provenance | null }> {
    const ndc = input.productNdcs[0];
    const fallback: CandidateReference = {
      productNdc: ndc ?? null,
      label: input.genericName,
      ingredient: input.genericName,
      ingredientNames: [input.genericName],
      strength: null,
      dosageForm: null,
      routes: [],
      marketingCategory: null,
    };
    if (ndc === undefined) return { reference: fallback, provenance: null };

    const listing = await this.fda.searchNdc({
      search: `product_ndc:"${quote(ndc)}"`,
      limit: 1,
    });
    const product = listing.data[0];
    if (product === undefined) return { reference: fallback, provenance: listing.provenance };

    const source = toSource(product);
    return {
      provenance: listing.provenance,
      reference: {
        productNdc: source.productNdc,
        label: source.genericName,
        // The listing's own first active ingredient, which is what the NDC
        // directory indexes on — a combination product's generic name is not a
        // queryable ingredient.
        ingredient: source.ingredients[0]?.name ?? input.genericName,
        ingredientNames: source.ingredients.map((one) => one.name),
        strength: source.ingredients[0]?.strength ?? null,
        dosageForm: source.dosageForm,
        routes: source.routes,
        marketingCategory: source.marketingCategory,
      },
    };
  }

  async discover(
    reference: CandidateReference,
    referenceProvenance: Provenance | null = null,
  ): Promise<CandidateSet> {
    const listings = await this.fda.searchNdc({
      search: `active_ingredients.name:"${quote(reference.ingredient)}"`,
      limit: CANDIDATE_LIMIT,
    });
    const sources = referenceProvenance
      ? [referenceProvenance, listings.provenance]
      : [listings.provenance];
    const products = listings.data;

    const [approvals, shortages] = await Promise.all([
      this.approvals(products, sources),
      this.shortages(reference, sources),
    ]);

    const asOf = new Date();
    const candidates = products.map((product) => {
      const source = toSource(product);
      const record = approvals.found.get(product.application_number ?? '');
      const strength = source.ingredients.find(
        (one) => one.name.toLowerCase() === reference.ingredient.toLowerCase(),
      )?.strength;
      return buildCandidate({
        reference,
        source,
        equivalence: record ? resolveEquivalence(record, strength ?? null) : null,
        reportedShortage: shortages.get(product.product_ndc) ?? null,
        asOf,
      });
    });

    return {
      createdAt: asOf.toISOString(),
      ingredient: reference.ingredient,
      referenceNdc: reference.productNdc,
      referenceLabel: reference.label,
      candidates: rankCandidates(candidates),
      coverage: {
        reportedTotal: products.length,
        retrieved: products.length,
        truncated: products.length >= CANDIDATE_LIMIT,
        equivalenceChecked: approvals.found.size,
      },
      sources,
      limits: limitsFor({ products, approvals, reference }),
    };
  }

  /**
   * Batched Drugs@FDA lookups, keyed by application number.
   *
   * `queried` is counted separately from `found` because the two shortfalls
   * mean different things: an application the batch cap skipped was *not
   * checked*, while one that was queried and returned nothing has *no approval
   * record published*. Reporting both as a single number would overstate the
   * gap — the first version of this did exactly that, comparing distinct
   * applications against listing count and inventing a shortfall that was not
   * there.
   */
  private async approvals(
    products: NdcProduct[],
    sources: Provenance[],
  ): Promise<{ found: Map<string, ApprovalRecord>; seen: number; queried: number }> {
    const numbers = [
      ...new Set(products.map((one) => one.application_number).filter((one) => one !== undefined)),
    ];
    const ceiling = Math.min(numbers.length, APPROVAL_BATCH * MAX_APPROVAL_BATCHES);
    const found = new Map<string, ApprovalRecord>();
    for (let index = 0; index < ceiling; index += APPROVAL_BATCH) {
      const batch = numbers.slice(index, index + APPROVAL_BATCH);
      const clause = batch.map((one) => `"${quote(one)}"`).join(' OR ');
      // Sequential on purpose: openFDA rate-limits per source, and the cached
      // client spaces requests itself. Firing the batches in parallel would
      // queue behind that limiter anyway, with a worse failure mode.
      const response = await this.fda.searchDrugsFda({
        search: `application_number:(${clause})`,
        limit: APPROVAL_BATCH,
      });
      sources.push(response.provenance);
      for (const record of response.data) found.set(record.application_number, toApproval(record));
    }
    return { found, seen: numbers.length, queried: ceiling };
  }

  /** FDA's reported shortage status for products of this ingredient. */
  private async shortages(
    reference: CandidateReference,
    sources: Provenance[],
  ): Promise<Map<string, NonNullable<ProductCandidate['reportedShortage']>>> {
    const response = await this.fda.searchShortages({
      search: `openfda.substance_name:"${quote(reference.ingredient)}"`,
      limit: SHORTAGE_LIMIT,
    });
    sources.push(response.provenance);
    const byNdc = new Map<string, NonNullable<ProductCandidate['reportedShortage']>>();
    for (const row of response.data) {
      const entry = toShortage(row);
      if (entry === null) continue;
      for (const ndc of row.openfda?.product_ndc ?? []) byNdc.set(ndc, entry);
    }
    return byNdc;
  }
}

/** A shortage row only counts when FDA stated both a status and a date for it. */
function toShortage(row: {
  status?: string | undefined;
  availability?: string | undefined;
  update_date?: string | undefined;
  change_date?: string | undefined;
  initial_posting_date?: string | undefined;
}): NonNullable<ProductCandidate['reportedShortage']> | null {
  const at = row.update_date ?? row.change_date ?? row.initial_posting_date;
  if (row.status === undefined || at === undefined) return null;
  return { status: row.status, availability: row.availability ?? null, updatedAt: at };
}

function toApproval(record: {
  application_number: string;
  sponsor_name?: string | undefined;
  products?:
    | {
        brand_name?: string | undefined;
        te_code?: string | undefined;
        marketing_status?: string | undefined;
        reference_drug?: string | undefined;
        active_ingredients?: { strength?: string | undefined }[] | undefined;
      }[]
    | undefined;
}): ApprovalRecord {
  return {
    applicationNumber: record.application_number,
    sponsor: record.sponsor_name ?? null,
    products: (record.products ?? []).map((product) => ({
      brandName: product.brand_name ?? null,
      teCode: product.te_code ?? null,
      marketingStatus: product.marketing_status ?? null,
      referenceDrug: product.reference_drug ?? null,
      strengths: (product.active_ingredients ?? []).map((one) => one.strength ?? null),
    })),
  };
}

function limitsFor(input: {
  products: NdcProduct[];
  approvals: { found: Map<string, ApprovalRecord>; seen: number; queried: number };
  reference: CandidateReference;
}): string[] {
  const { products, approvals, reference } = input;
  const withoutApplication = products.filter((one) => one.application_number === undefined).length;
  const limits = [
    'Candidates are FDA product listings. A listing is not evidence of stock, a supplier offer, or a price.',
    'This is US regulatory evidence. It does not establish availability in India or any other market.',
    'A shared active ingredient is not therapeutic equivalence. Only an FDA-published TE code speaks to that, and only for the approved product.',
  ];
  if (reference.productNdc === null) {
    limits.push(
      'The source record reports no product NDC, so there is no baseline listing to compare strength, dosage form or route against. Those attributes are reported as unknown.',
    );
  }
  if (products.length >= CANDIDATE_LIMIT) {
    limits.push(
      `Retrieval stopped at ${String(CANDIDATE_LIMIT)} listings. More products may exist for this ingredient.`,
    );
  }
  if (withoutApplication > 0) {
    limits.push(
      `${String(withoutApplication)} listing(s) carry no FDA application number — typically bulk ingredient listings — so no approval or equivalence record exists to look up.`,
    );
  }
  if (approvals.queried < approvals.seen) {
    limits.push(
      `${String(approvals.seen - approvals.queried)} of ${String(approvals.seen)} FDA applications were not checked for approval records, because the lookup stopped at its batch limit.`,
    );
  }
  const missing = approvals.queried - approvals.found.size;
  if (missing > 0) {
    limits.push(
      `${String(missing)} of the ${String(approvals.queried)} applications queried returned no Drugs@FDA record, so no equivalence code could be read for their listings.`,
    );
  }
  return limits;
}
