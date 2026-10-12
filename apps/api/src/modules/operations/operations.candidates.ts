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

import {
  parseFdaDate,
  type FdaPage,
  type NdcProduct,
  type OpenFdaClient,
} from '@vitalink/connectors';
import type { CandidateSet, Provenance, ProductCandidate } from '@vitalink/contracts';

import { flagDuplicateCandidates } from './domain/candidate-identity';
import { candidateReference } from './domain/candidate-reference';
import { buildCandidate, rankCandidates, type CandidateReference } from './domain/candidates';
import { resolveEquivalence, type ApprovalRecord } from './domain/equivalence';
import { shortageEvidenceByNdc } from './domain/shortage-evidence';

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
  constructor(
    private readonly fda: Pick<OpenFdaClient, 'searchNdc' | 'searchDrugsFda' | 'searchShortages'>,
  ) {}

  /**
   * Selects one incident listing matching the medicine under analysis.
   * Its strength, form and route supply the baseline. Missing, ambiguous or
   * incomplete lookups preserve unknown presentation attributes and explain
   * the limitation; the first incident NDC is never an arbitrary fallback.
   */
  async reference(input: {
    productNdcs: string[];
    genericName: string;
  }): Promise<{ reference: CandidateReference; provenance: Provenance | null }> {
    if (input.productNdcs.length === 0) {
      return { reference: candidateReference([], input.genericName), provenance: null };
    }
    const ndcs = [...new Set(input.productNdcs)].slice(0, CANDIDATE_LIMIT);
    const clause = ndcs.map((ndc) => `"${quote(ndc)}"`).join(' OR ');
    const listing = await this.fda.searchNdc({
      search: `product_ndc:(${clause})`,
      limit: CANDIDATE_LIMIT,
    });
    const incomplete =
      new Set(input.productNdcs).size > ndcs.length ||
      (listing.total !== null && listing.total > listing.data.length);
    return {
      reference: candidateReference(
        listing.data.filter((product) => ndcs.includes(product.product_ndc)),
        input.genericName,
        incomplete,
      ),
      provenance: listing.provenance,
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
        equivalence: record
          ? resolveEquivalence(record, strength ?? null, source.ingredients.length)
          : null,
        reportedShortage: shortages.byNdc.get(product.product_ndc) ?? null,
        asOf,
      });
    });

    return {
      createdAt: asOf.toISOString(),
      ingredient: reference.ingredient,
      referenceNdc: reference.productNdc,
      referenceLabel: reference.label,
      candidates: rankCandidates(flagDuplicateCandidates(candidates)),
      coverage: candidateCoverage(listings, approvals.found.size),
      sources,
      limits: discoveryLimits(listings, reference, approvals, shortages.truncated),
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
  ): Promise<{
    byNdc: Map<string, NonNullable<ProductCandidate['reportedShortage']>>;
    truncated: boolean;
  }> {
    const response = await this.fda.searchShortages({
      search: `openfda.substance_name:"${quote(reference.ingredient)}"`,
      limit: SHORTAGE_LIMIT,
    });
    sources.push(response.provenance);
    const byNdc = shortageEvidenceByNdc(response.data, response.provenance.fetched_at);
    return {
      byNdc,
      truncated:
        response.total === null
          ? response.data.length >= SHORTAGE_LIMIT
          : response.total > response.data.length,
    };
  }
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
    ...(reference.limits ?? []),
    'Candidates are FDA product listings. A listing is not evidence of stock, a supplier offer, or a price.',
    'This is US regulatory evidence. It does not establish availability in India or any other market.',
    'A product NDC shortage association can span presentations. Mixed source statuses remain mixed; conflicting or missing availability remains unknown. Missing, invalid or future-dated status rows are not joined. No matched row does not establish stock.',
    'A shared active ingredient is not therapeutic equivalence. Only an FDA-published TE code speaks to that, and only for the approved product.',
  ];
  if (reference.ingredientNames.length > 1) {
    limits.push(
      'Combination-product strength and equivalence evidence are withheld until every ingredient can be matched to the approved presentation.',
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

function candidateCoverage(
  listings: FdaPage<NdcProduct>,
  checked: number,
): CandidateSet['coverage'] {
  return {
    reportedTotal: listings.total,
    retrieved: listings.data.length,
    truncated:
      listings.total === null
        ? listings.data.length >= CANDIDATE_LIMIT
        : listings.total > listings.data.length,
    equivalenceChecked: checked,
  };
}

function discoveryLimits(
  listings: FdaPage<NdcProduct>,
  reference: CandidateReference,
  approvals: Parameters<typeof limitsFor>[0]['approvals'],
  shortageTruncated: boolean,
): string[] {
  return [
    ...limitsFor({ products: listings.data, approvals, reference }),
    ...(candidateCoverage(listings, approvals.found.size).truncated
      ? [
          `Retrieval is incomplete after ${String(listings.data.length)} listings. More products may exist for this ingredient.`,
        ]
      : []),
    ...(shortageTruncated
      ? ['Shortage retrieval is incomplete; an absent match does not mean there is no shortage.']
      : []),
    ...listings.data
      .filter(
        (p) =>
          p.listing_expiration_date !== undefined &&
          parseFdaDate(p.listing_expiration_date) === null,
      )
      .map(
        (p) =>
          `Listing ${p.product_ndc} has an unreadable expiration date; listing currency is unknown.`,
      ),
  ];
}
