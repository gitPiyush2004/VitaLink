/**
 * Assembling a drug document from what openFDA returned.
 *
 * Pure: inputs in, a `DrugUpsertInput` out. No I/O, no clock, no `this`. That is
 * why it lives in `domain/` rather than as a service method — it is the place
 * every number acquires its provenance envelope, which makes it the most
 * important thing in the module to be able to test in isolation.
 */

import { derived, scenario, type Provenance } from '@vitalink/contracts';
import { nodeId } from '@vitalink/graph';

import type { DrugUpsertInput } from '../catalog.types';

import type { RedundancyDerivation } from './redundancy-derivation';

/** Adapts a connector `Provenance` into the shape the `Quantity` builders want. */
export function provenanceToSource(provenance: Provenance): {
  name: string;
  url: string;
  query: string | null;
  fetchedAt: string;
} {
  return {
    name: provenance.source_name,
    url: provenance.source_url,
    query: provenance.query,
    fetchedAt: provenance.fetched_at,
  };
}

export function uniqueStrings(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== undefined))];
}

/** The product facts the assembly needs, without the service's fetch machinery. */
export type ProductFacts = {
  brandNames: (string | undefined)[];
  ndcProductCodes: string[];
  dosageForm: string | null;
  route: string | null;
  countProvenance: Provenance;
};

/** The storage read, in the shape the drug document wants. */
export type StorageFacts = {
  range: DrugUpsertInput['temperatureRequirement'];
  allMatched: string[];
  isColdChain: boolean;
  text: string | null;
  reason: string;
  excursionQuantity: DrugUpsertInput['excursionUpperC'];
};

/**
 * The three redundancy figures, each in its envelope.
 *
 * Split out because the tagging decision — SCENARIO when the API tier was not
 * observed, DERIVED when it was — is the single most consequential line in the
 * module and deserves to be readable on its own.
 */
function redundancyQuantities(
  redundancy: RedundancyDerivation,
  countProvenance: Provenance,
): Pick<
  DrugUpsertInput,
  'zApi' | 'zPlant' | 'rawLabelerCount' | 'hhiManufacturers' | 'labelerCountWasTruncated'
> {
  const source = provenanceToSource(countProvenance);

  return {
    /**
     * Tagged SCENARIO, not DERIVED, whenever the API tier was not observed.
     * That tag is the point: openFDA cannot see who makes the active ingredient,
     * so a z_api of 1 here is an assumption the operator can override, and it
     * renders in the SCENARIO treatment rather than as a confident fact.
     */
    zApi: redundancy.zApiIsAssumed
      ? scenario({
          value: redundancy.zApi,
          unit: 'suppliers',
          setBy: `assumption:api-tier-not-observed (${redundancy.zApiMethod})`,
          at: countProvenance.fetched_at,
        })
      : derived({
          value: redundancy.zApi,
          unit: 'suppliers',
          source,
          method: redundancy.zApiMethod,
        }),

    /** The echelon openFDA labeler data genuinely measures. */
    zPlant: derived({
      value: redundancy.zPlant,
      unit: 'plants',
      source,
      method: redundancy.zPlantMethod,
    }),

    rawLabelerCount: derived({
      value: redundancy.rawLabelerCount,
      unit: 'labelers',
      source,
      method:
        'Distinct openFDA labeler_name values for this generic name. Describes the ' +
        'FINISHED-DOSE market, not the API tier, and includes repackagers and relabelers.' +
        (redundancy.wasCountTruncated
          ? ' openFDA capped the count buckets, so this is a FLOOR, not the true total.'
          : ''),
    }),
    labelerCountWasTruncated: redundancy.wasCountTruncated,

    hhiManufacturers: derived({
      value: redundancy.hhi,
      unit: null,
      source,
      method:
        'Herfindahl-Hirschman index, the sum of squared shares, over openFDA ' +
        'product-listing counts per labeler. 0..1, where 1 is a monopoly.',
    }),
  };
}

/** Assembles the drug upsert, wrapping every number in its provenance envelope. */
export function buildDrugUpsert(input: {
  genericName: string;
  products: ProductFacts;
  storage: StorageFacts;
  redundancy: RedundancyDerivation;
  ingredientIds: string[];
  manufacturerIds: string[];
}): DrugUpsertInput {
  const { genericName, products, storage, redundancy } = input;

  return {
    id: nodeId('drug', genericName),
    genericName,
    brandNames: uniqueStrings(products.brandNames),
    ndcProductCodes: products.ndcProductCodes,
    ingredientIds: input.ingredientIds,
    manufacturerIds: input.manufacturerIds,
    dosageForm: products.dosageForm,
    route: products.route,
    atcCode: null,

    // Both default to false until the WHO EML and NLEM reference lists are
    // ingested. Defaulting to true would overstate criticality across the whole
    // catalogue, which flows straight into the objective's delta term.
    whoEml: false,
    nlemCritical: false,

    temperatureRequirement: storage.range,
    storageTextRaw: storage.text,
    storageParseReason: storage.reason,
    coldChain: storage.isColdChain,
    excursionUpperC: storage.excursionQuantity,

    // No NPPA client yet, so there is no honest rupee basis. Null renders as an
    // empty state with a reason rather than as a zero.
    ceilingPriceInr: null,
    dddMg: null,

    ...redundancyQuantities(redundancy, products.countProvenance),

    isSingleSource: redundancy.isSingleSource,
    apiTierVisibility: redundancy.apiTierVisibility,
    storageConditionsStated: storage.allMatched,

    provenance: products.countProvenance,
  };
}
