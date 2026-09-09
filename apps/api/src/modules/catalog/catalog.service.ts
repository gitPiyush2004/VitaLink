/**
 * Building the product universe from openFDA.
 *
 * The important design point is in `refreshDrug`: the seed configuration stores
 * **the query that derives the drug list**, not the drug list itself (spec
 * PART 5). So the universe refreshes when the registry does, and nothing is
 * frozen into a file that slowly stops matching reality.
 *
 * The other thing worth reading is how `z_api` is obtained. One openFDA `count`
 * aggregation, not a paged walk of every product — and then
 * `domain/redundancy-derivation.ts` turns that distribution into a defensible
 * redundancy count rather than a raw labeler tally. That file explains why the
 * raw tally is wrong.
 */

import type { NdcProduct, OpenFdaClient } from '@vitalink/connectors';
import { derived, real, type Provenance, type Quantity } from '@vitalink/contracts';
import { nodeId, slugify } from '@vitalink/graph';

import { InsufficientDataError } from '@shared/errors';
import { logger } from '@shared/logger';

import type { CatalogRepository } from './catalog.repository';
import type {
  DrugEntity,
  IngredientEntity,
  IngredientUpsertInput,
  ManufacturerEntity,
  ManufacturerUpsertInput,
  RefreshOutcome,
} from './catalog.types';
import { buildDrugUpsert, provenanceToSource, uniqueStrings } from './domain/drug-assembly';
import { deriveRedundancy, type LabelerObservation } from './domain/redundancy-derivation';
import { parseStorage, type StorageParse } from './domain/storage-parsing';

/** What one openFDA read produced. Passed between the service's private steps. */
type OpenFdaFacts = {
  products: NdcProduct[];
  productProvenance: Provenance;
  labelers: LabelerObservation[];
  labelerCountWasTruncated: boolean;
  countProvenance: Provenance;
};

/** The storage read, in the shape the drug document wants. */
type StorageOutcome = {
  range: StorageParse['range'];
  allMatched: StorageParse['allMatched'];
  isColdChain: boolean;
  text: string | null;
  reason: string;
  excursionQuantity: Quantity | null;
};

/** How many NDC products to read per generic name when resolving ingredients. */
const PRODUCT_SAMPLE_LIMIT = 100;
/** How many labels to read for the storage section. One is usually enough. */
const LABEL_SAMPLE_LIMIT = 3;

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly openFda: OpenFdaClient,
  ) {}

  /**
   * Refreshes one generic name from openFDA.
   *
   * Three requests: a product sample for ingredients and forms, a labeler count
   * aggregation for redundancy, and a label lookup for the storage section. All
   * three go through the cached client, so a repeated refresh within the TTL
   * costs nothing.
   *
   * @throws InsufficientDataError when openFDA knows nothing about the name. That
   *   is a legitimate outcome — the UI renders it as an empty state with this
   *   reason — not a failure to hide.
   */
  async refreshDrug(genericName: string): Promise<RefreshOutcome> {
    const warnings: string[] = [];
    const facts = await this.fetchOpenFdaFacts(genericName);
    const storage = await this.readStorage(genericName, warnings);

    const redundancy = deriveRedundancy(facts.labelers, {
      // openFDA caps the number of count buckets, so without this flag a partial
      // distribution is indistinguishable from a complete one. No trade data yet,
      // so the API tier is reported as not observed.
      wasCountTruncated: facts.labelerCountWasTruncated,
    });

    const manufacturers = this.buildManufacturers(facts.labelers, facts.countProvenance);
    const ingredients = this.buildIngredients(facts.products, facts.productProvenance);

    const manufacturersUpserted = await this.repository.upsertManufacturers(manufacturers);
    await this.repository.upsertIngredients(ingredients);

    await this.repository.upsertDrug(
      buildDrugUpsert({
        genericName,
        products: {
          brandNames: facts.products.map((product) => product.brand_name),
          ndcProductCodes: facts.products.map((product) => product.product_ndc),
          dosageForm: facts.products[0]?.dosage_form ?? null,
          route: facts.products[0]?.route?.[0] ?? null,
          countProvenance: facts.countProvenance,
        },
        storage,
        redundancy,
        ingredientIds: ingredients.map((ingredient) => ingredient.id),
        manufacturerIds: manufacturers.map((manufacturer) => manufacturer.id),
      }),
    );

    if (redundancy.caveat !== null) warnings.push(redundancy.caveat);

    return {
      drugId: nodeId('drug', genericName),
      genericName,
      productsSeen: facts.products.length,
      labelersSeen: facts.labelers.length,
      manufacturersUpserted,
      zApi: redundancy.zApi,
      zApiIsAssumed: redundancy.zApiIsAssumed,
      zPlant: redundancy.zPlant,
      rawLabelerCount: redundancy.rawLabelerCount,
      labelerCountWasTruncated: redundancy.wasCountTruncated,
      temperatureRequirement: storage.range,
      storageConditionsStated: storage.allMatched,
      storageParseReason: storage.reason,
      warnings,
    };
  }

  /**
   * The two openFDA reads the catalogue needs: a product sample for ingredients
   * and dosage form, and a labeler count aggregation for redundancy.
   *
   * Extracted so `refreshDrug` reads as "fetch, derive, persist" rather than as
   * one long sequence of awaits.
   *
   * @throws InsufficientDataError when openFDA knows nothing about the name.
   */
  private async fetchOpenFdaFacts(genericName: string): Promise<OpenFdaFacts> {
    const search = `generic_name:"${genericName}"`;

    const products = await this.openFda.searchNdc({ search, limit: PRODUCT_SAMPLE_LIMIT });
    if (products.data.length === 0) {
      throw new InsufficientDataError(
        `openFDA returned no products for generic name "${genericName}".`,
        { generic_name: genericName, query: search },
      );
    }

    const counted = await this.openFda.count('ndc', { search, count: 'labeler_name.exact' });

    return {
      products: products.data,
      productProvenance: products.provenance,
      labelers: counted.data.map((bucket) => ({ name: bucket.term, productCount: bucket.count })),
      labelerCountWasTruncated: counted.wasTruncated,
      countProvenance: counted.provenance,
    };
  }

  async getDrug(drugId: string): Promise<DrugEntity | null> {
    return this.repository.findDrugById(drugId);
  }

  async listDrugs(filter: {
    limit: number;
    cursorId: string | null;
    nlemCriticalOnly: boolean;
    singleSourceOnly: boolean;
  }): Promise<DrugEntity[]> {
    return this.repository.listDrugs(filter);
  }

  async getManufacturers(ids: string[]): Promise<ManufacturerEntity[]> {
    return this.repository.findManufacturersByIds(ids);
  }

  async getIngredients(ids: string[]): Promise<IngredientEntity[]> {
    return this.repository.findIngredientsByIds(ids);
  }

  async countDrugs(): Promise<number> {
    return this.repository.countDrugs();
  }

  /**
   * Reads the temperature requirement from a real label.
   *
   * A failure here is a warning rather than an error: a drug with an unparseable
   * storage section is still a usable catalogue entry, it just cannot be shipped
   * without an operator supplying the requirement as a SCENARIO value.
   */
  private async readStorage(genericName: string, warnings: string[]): Promise<StorageOutcome> {
    const search = `openfda.generic_name:"${genericName}" AND _exists_:storage_and_handling`;

    let perLabel: string[][];
    try {
      const labels = await this.openFda.searchLabels({ search, limit: LABEL_SAMPLE_LIMIT });
      // Per label, NOT flattened. Labels under one generic name are different
      // products, and merging them lets one product's "do not refrigerate"
      // cancel another product's refrigeration requirement.
      perLabel = labels.data.map((label) => label.storage_and_handling ?? []);
      return this.interpretStorage(
        parseStorage(perLabel),
        perLabel.flat(),
        labels.provenance,
        warnings,
      );
    } catch (error) {
      // openFDA answers "no matching label" with a 404, which the client turns
      // into an empty list rather than an error — so reaching here means a real
      // failure, and the drug is still worth storing without a temperature.
      logger.warn({ err: error, genericName }, 'could not read the storage section');
      warnings.push(
        'The openFDA label lookup failed, so no temperature requirement was read. It must ' +
          'be supplied as a SCENARIO value before this drug can be shipped.',
      );
      return {
        range: null,
        allMatched: [],
        isColdChain: false,
        text: null,
        reason: 'openFDA label lookup failed.',
        excursionQuantity: null,
      };
    }
  }

  /** Turns a parse into the stored shape, collecting anything worth warning about. */
  private interpretStorage(
    parse: StorageParse,
    sections: string[],
    provenance: Provenance,
    warnings: string[],
  ): StorageOutcome {
    if (parse.range === null) warnings.push(parse.reason);
    // When products under one generic name disagree, the operator must pick a
    // product. Discovering that from a carrier being eliminated would be worse.
    if (parse.productsDisagree) warnings.push(parse.reason);
    // A prohibition is a hard constraint in its own right: cisplatin's label
    // forbids refrigeration, so a reefer-only service is wrong for it.
    if (parse.prohibited.length > 0) {
      warnings.push(
        `The label forbids ${parse.prohibited.join(', ')} for this drug, which is a hard ` +
          'constraint on carrier selection in its own right.',
      );
    }

    return {
      range: parse.range,
      allMatched: parse.allMatched,
      isColdChain: parse.isColdChain,
      text: sections[0] ?? null,
      reason: parse.reason,
      excursionQuantity:
        parse.excursionUpperC === null
          ? null
          : real({
              value: parse.excursionUpperC,
              unit: 'C',
              source: provenanceToSource(provenance),
            }),
    };
  }

  /**
   * One manufacturer per observed labeler.
   *
   * `capacity_index` is deliberately an ordinal index derived from the labeler's
   * distinct product count, never units per day. No public source publishes
   * capacity, and calling this one anything else would be an invention.
   */
  private buildManufacturers(
    labelers: LabelerObservation[],
    provenance: Provenance,
  ): ManufacturerUpsertInput[] {
    const source = provenanceToSource(provenance);

    return labelers.map((labeler) => ({
      id: nodeId('manufacturer', labeler.name),
      name: slugify(labeler.name),
      nameRaw: labeler.name,
      country: null,
      capacityIndex: derived({
        value: labeler.productCount,
        unit: 'index',
        source,
        method:
          'ORDINAL INDEX, not units per day: the count of distinct openFDA product ' +
          'listings this labeler holds for this generic name. No public source publishes ' +
          'pharmaceutical capacity, so this is a relative-scale proxy only.',
      }),
      registeredFacilityCount: null,
      distinctProductCount: derived({
        value: labeler.productCount,
        unit: 'products',
        source,
        method: 'Distinct openFDA product listings for this labeler and generic name.',
      }),
      provenance,
    }));
  }

  private buildIngredients(
    products: { active_ingredients?: { name: string }[] | undefined }[],
    provenance: Provenance,
  ): IngredientUpsertInput[] {
    const names = uniqueStrings(
      products.flatMap((product) => (product.active_ingredients ?? []).map((one) => one.name)),
    );

    return names.map((name) => ({
      id: nodeId('ingredient', name),
      unii: null,
      name: slugify(name),
      nameRaw: name,
      atcCode: null,
      // Populated when the Comtrade layer lands; an ingredient with no HS code
      // has no observable trade structure, and the graph says so rather than
      // guessing one.
      hsCodes: [],
      maxCountryDependencyShare: null,
      provenance,
    }));
  }
}
