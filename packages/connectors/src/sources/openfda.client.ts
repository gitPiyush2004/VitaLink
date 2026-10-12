/**
 * openFDA — four endpoints, one client.
 *
 * Query syntax note, learned the hard way in the first probe run: openFDA's
 * `search` parameter treats `+` as a term separator, and `URLSearchParams`
 * percent-encodes a literal `+` as `%2B`. So a query written as
 * `a+AND+b` arrives as `a%2BAND%2Bb` and matches nothing (openFDA answers 404).
 * Write clauses separated by spaces — `a AND b` — and let `URLSearchParams`
 * encode the space as `+`, which is what openFDA expects.
 *
 * NDC and label records support product identity and labeler associations;
 * enforcement records supply reported recalls. Shortages are mutable current
 * presentation records, not a complete dated history of shortage episodes.
 * Drugs@FDA supplies approval and published therapeutic-equivalence evidence.
 * None establishes hospital stock, physical supplier dependencies or recovery
 * rates. An empty query is absence of records within that query's coverage.
 *
 * openFDA reports an empty search with HTTP 404; preserve that as an empty
 * page rather than a failed ingestion.
 */

import { z } from 'zod';

import type { CachedHttpClient, Fetched } from '../http/cached-client';
import { ConnectorError } from '../http/connector-error';

import { sourceConfig } from './source-registry';

const MAX_LIMIT = 1000;

/**
 * openFDA returns at most 100 `count` buckets unless a larger limit is asked
 * for, and at most 1000 even then. Learned by running it: a metformin labeler
 * count returned exactly 100 buckets summing to 629 listings, with a minimum
 * bucket of 1 — a truncated tail presented with no indication that it was
 * truncated. `countWithLimit` asks for the maximum and tells the caller whether
 * the result hit it, so a floor is never mistaken for a total.
 */
const MAX_COUNT_BUCKETS = 1000;

/** openFDA wraps every response the same way. */
const metaSchema = z.object({
  disclaimer: z.string().optional(),
  last_updated: z.string().optional(),
  results: z
    .object({
      skip: z.number(),
      limit: z.number(),
      total: z.number(),
    })
    .optional(),
});

function envelopeSchema<T extends z.ZodType>(resultSchema: T) {
  return z.object({ meta: metaSchema, results: z.array(resultSchema) });
}

// ---------------------------------------------------------------------------
// Result shapes
//
// Only the fields Vitalink actually uses are declared, and almost all of them
// are optional. openFDA is a union of many submissions and a field present on
// one product is routinely absent on the next; a strict schema here would reject
// most of the corpus.
// ---------------------------------------------------------------------------

export const ndcProductSchema = z.object({
  product_ndc: z.string(),
  generic_name: z.string().optional(),
  brand_name: z.string().optional(),
  labeler_name: z.string().optional(),
  dosage_form: z.string().optional(),
  route: z.array(z.string()).optional(),
  marketing_category: z.string().optional(),
  active_ingredients: z
    .array(z.object({ name: z.string(), strength: z.string().optional() }))
    .optional(),
  pharm_class: z.array(z.string()).optional(),
  finished: z.boolean().optional(),
  /** Links an NDC listing to its Drugs@FDA approval record, where one exists. */
  application_number: z.string().optional(),
  /** YYYYMMDD. The listing's own dates, not an availability statement. */
  marketing_start_date: z.string().optional(),
  listing_expiration_date: z.string().optional(),
  product_type: z.string().optional(),
});
export type NdcProduct = z.infer<typeof ndcProductSchema>;

/**
 * Drugs@FDA — approval records, therapeutic-equivalence codes and marketing
 * status.
 *
 * `te_code` is absent on a large share of products (40 of 65 heparin products
 * carried one in the probe run). Absent means **no code published**, and the
 * caller must not read it as "not therapeutically equivalent". `products[]` is
 * per approved product within one application, so one record can describe
 * several strengths with different statuses.
 */
export const drugsFdaSchema = z.object({
  application_number: z.string(),
  sponsor_name: z.string().optional(),
  products: z
    .array(
      z.object({
        product_number: z.string().optional(),
        brand_name: z.string().optional(),
        dosage_form: z.string().optional(),
        route: z.string().optional(),
        marketing_status: z.string().optional(),
        te_code: z.string().optional(),
        reference_drug: z.string().optional(),
        reference_standard: z.string().optional(),
        active_ingredients: z
          .array(z.object({ name: z.string(), strength: z.string().optional() }))
          .optional(),
      }),
    )
    .optional(),
});
export type DrugsFdaRecord = z.infer<typeof drugsFdaSchema>;

export const labelSchema = z.object({
  id: z.string().optional(),
  effective_time: z.string().optional(),
  /** The section the temperature requirement is parsed from. */
  storage_and_handling: z.array(z.string()).optional(),
  how_supplied: z.array(z.string()).optional(),
  openfda: z
    .object({
      generic_name: z.array(z.string()).optional(),
      brand_name: z.array(z.string()).optional(),
      manufacturer_name: z.array(z.string()).optional(),
      substance_name: z.array(z.string()).optional(),
      unii: z.array(z.string()).optional(),
      product_ndc: z.array(z.string()).optional(),
      pharm_class_epc: z.array(z.string()).optional(),
    })
    .optional(),
});
export type DrugLabel = z.infer<typeof labelSchema>;

export const enforcementSchema = z.object({
  recall_number: z.string(),
  event_id: z.string().optional(),
  code_info: z.string().optional(),
  distribution_pattern: z.string().optional(),
  address_1: z.string().optional(),
  /** YYYYMMDD. Converted at the boundary, in the ingestion mapper. */
  report_date: z.string().optional(),
  recall_initiation_date: z.string().optional(),
  center_classification_date: z.string().optional(),
  classification: z.string().optional(),
  status: z.string().optional(),
  product_description: z.string().optional(),
  reason_for_recall: z.string().optional(),
  recalling_firm: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  voluntary_mandated: z.string().optional(),
  product_quantity: z.string().optional(),
  openfda: z
    .object({
      generic_name: z.array(z.string()).optional(),
      brand_name: z.array(z.string()).optional(),
      manufacturer_name: z.array(z.string()).optional(),
      substance_name: z.array(z.string()).optional(),
      product_ndc: z.array(z.string()).optional(),
    })
    .optional(),
});
export type EnforcementReport = z.infer<typeof enforcementSchema>;

export const shortageSchema = z.object({
  /** Field names differ slightly across openFDA revisions, so both are optional. */
  package_ndc: z.string().optional(),
  availability: z.string().optional(),
  generic_name: z.string().optional(),
  proprietary_name: z.string().optional(),
  company_name: z.string().optional(),
  status: z.string().optional(),
  /** FDA currently prints MM/DD/YYYY; these fields do not prove resolution. */
  initial_posting_date: z.string().optional(),
  update_date: z.string().optional(),
  change_date: z.string().optional(),
  discontinued_date: z.string().optional(),
  shortage_reason: z.string().optional(),
  availability_information: z.string().optional(),
  therapeutic_category: z.array(z.string()).optional(),
  dosage_form: z.string().optional(),
  strength: z.array(z.string()).optional(),
  presentation: z.string().optional(),
  openfda: z
    .object({
      generic_name: z.array(z.string()).optional(),
      manufacturer_name: z.array(z.string()).optional(),
      substance_name: z.array(z.string()).optional(),
      product_ndc: z.array(z.string()).optional(),
    })
    .optional(),
});
export type ShortageRecord = z.infer<typeof shortageSchema>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export type OpenFdaQuery = {
  /** The Lucene-style `search` expression, e.g. `generic_name:"heparin sodium"`. */
  search: string;
  limit?: number;
  skip?: number;
  /** Aggregation field. When set, openFDA returns counts instead of records. */
  count?: string;
  sort?: string;
};

const ENDPOINTS = {
  ndc: 'openfda_ndc',
  label: 'openfda_label',
  enforcement: 'openfda_enforcement',
  shortages: 'openfda_shortages',
  drugsfda: 'openfda_drugsfda',
} as const;

type EndpointName = keyof typeof ENDPOINTS;

/**
 * openFDA's count response: `[{ term, count }, ...]`.
 * Used to get a distinct manufacturer count in one request instead of paging.
 */
export const countBucketSchema = z.object({ term: z.string(), count: z.number() });
export type CountBucket = z.infer<typeof countBucketSchema>;

export type FdaPage<T> = Fetched<T[]> & { total: number | null };

export class OpenFdaClient {
  constructor(private readonly http: CachedHttpClient) {}

  searchNdc(query: OpenFdaQuery): Promise<FdaPage<NdcProduct>> {
    return this.search('ndc', query, ndcProductSchema);
  }

  searchLabels(query: OpenFdaQuery): Promise<Fetched<DrugLabel[]>> {
    return this.search('label', query, labelSchema);
  }

  searchEnforcement(query: OpenFdaQuery): Promise<FdaPage<EnforcementReport>> {
    return this.search('enforcement', query, enforcementSchema);
  }

  searchShortages(query: OpenFdaQuery): Promise<FdaPage<ShortageRecord>> {
    return this.search('shortages', query, shortageSchema);
  }

  searchDrugsFda(query: OpenFdaQuery): Promise<FdaPage<DrugsFdaRecord>> {
    return this.search('drugsfda', query, drugsFdaSchema);
  }

  /**
   * Runs a `count` aggregation, asking for openFDA's maximum bucket count.
   *
   * This is how redundancy is obtained: one request counting distinct
   * `labeler_name` values for a generic name, rather than paging every product
   * and de-duplicating client-side.
   *
   * `wasTruncated` is the important part of the return value. openFDA silently
   * caps the number of buckets, so without it a partial distribution would be
   * indistinguishable from a complete one — and the derived redundancy would be
   * a floor presented as a total.
   */
  async count(
    endpoint: EndpointName,
    query: OpenFdaQuery & { count: string },
  ): Promise<Fetched<CountBucket[]> & { wasTruncated: boolean }> {
    const response = await this.search(
      endpoint,
      { ...query, limit: query.limit ?? MAX_COUNT_BUCKETS },
      countBucketSchema,
    );

    return { ...response, wasTruncated: response.data.length >= MAX_COUNT_BUCKETS };
  }

  private async search<T>(
    endpoint: EndpointName,
    query: OpenFdaQuery,
    resultSchema: z.ZodType<T>,
  ): Promise<FdaPage<T>> {
    const config = sourceConfig(ENDPOINTS[endpoint]);
    const url = buildUrl(config.baseUrl, query);

    try {
      const response = await this.http.getJson(
        {
          sourceId: config.id,
          displayName: config.displayName,
          url,
          queryDescription: describeQuery(query),
          minIntervalMs: config.minIntervalMs,
          cacheTtlSeconds: config.cacheTtlSeconds,
        },
        envelopeSchema(resultSchema),
      );

      return {
        ...response,
        data: response.data.results,
        total: response.data.meta.results?.total ?? null,
      };
    } catch (error) {
      // A 404 from openFDA means "nothing matched", which is a result, not a
      // failure. See the note at the top of this file.
      if (error instanceof ConnectorError && error.kind === 'not_found') {
        return {
          data: [],
          total: 0,
          provenance: {
            source_name: config.displayName,
            source_url: url,
            query: describeQuery(query),
            fetched_at: new Date().toISOString(),
          },
          fromCache: false,
          rawBody: '{"results":[]}',
        };
      }
      throw error;
    }
  }
}

function buildUrl(baseUrl: string, query: OpenFdaQuery): string {
  const params = new URLSearchParams({ search: query.search });

  if (query.count !== undefined) params.set('count', query.count);
  if (query.limit !== undefined) params.set('limit', String(Math.min(query.limit, MAX_LIMIT)));
  if (query.skip !== undefined) params.set('skip', String(query.skip));
  if (query.sort !== undefined) params.set('sort', query.sort);

  return `${baseUrl}?${params.toString()}`;
}

/** The one-line description shown in the UI's Sources drawer. */
function describeQuery(query: OpenFdaQuery): string {
  const parts = [`search=${query.search}`];
  if (query.count !== undefined) parts.push(`count=${query.count}`);
  if (query.limit !== undefined) parts.push(`limit=${String(query.limit)}`);
  if (query.skip !== undefined) parts.push(`skip=${String(query.skip)}`);
  return parts.join('&');
}
