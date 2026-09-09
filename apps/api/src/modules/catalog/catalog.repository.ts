/**
 * The only place this module touches Mongoose. Same shape as
 * `modules/auth/auth.repository.ts`: standalone functions, explicit mappers, and
 * a factory that only names them.
 *
 * Two things are worth reading here.
 *
 * **The document types are declared, not inferred.** Each model exports an
 * explicit `XDoc` type and is built as `model<XDoc>(...)`. `InferSchemaType` is
 * used in the auth module and works well there, but on a schema with custom
 * `timestamps` field names Mongoose infers an index signature of
 * `[x: string]: Date`, which then requires every value in a `$set` to be a
 * `Date` and makes a typed `bulkWrite` impossible to express. Declaring the
 * shape costs thirty lines per model and buys a fully-typed write path plus one
 * place a reader can see exactly what is stored.
 *
 * **The service passes camelCase entities, not pre-mapped documents.** The
 * snake_case translation happens in the mappers below and nowhere else, which is
 * the rule from PART 3A.3. An earlier version of this file took
 * `Record<string, unknown>` from the service, which quietly moved the mapping
 * up a layer and lost all type safety on the way.
 *
 * Every write is an upsert keyed by a deterministic slug id, which is what makes
 * catalogue ingestion idempotent: re-running a refresh updates the drug rather
 * than creating a second one.
 */

import { MAX_PAGE_SIZE } from '@config/constants';
import { fromProvenance, fromQuantity, toQuantity } from '@shared/db/mappers';
import { DatabaseError } from '@shared/errors';

import type {
  DrugEntity,
  DrugUpsertInput,
  IngredientEntity,
  IngredientUpsertInput,
  ManufacturerEntity,
  ManufacturerUpsertInput,
} from './catalog.types';
import { DrugModel, type DrugDoc } from './models/drug.model';
import { IngredientModel, type IngredientDoc } from './models/ingredient.model';
import { ManufacturerModel, type ManufacturerDoc } from './models/manufacturer.model';

// ---------------------------------------------------------------------------
// Mappers. The one place the shape changes.
//
// The generic Quantity and Provenance mappers live in `shared/db/mappers.ts`,
// because every module needs exactly those. The document mappers below are
// written out by hand on purpose: they are where this module's snake_case field
// names live, and a recursive key transformer would hide the line where the
// shape changes.
// ---------------------------------------------------------------------------

function toDrugEntity(doc: DrugDoc): DrugEntity {
  return {
    id: doc._id,
    genericName: doc.generic_name,
    brandNames: doc.brand_names,
    ndcProductCodes: doc.ndc_product_codes,
    ingredientIds: doc.ingredient_ids,
    manufacturerIds: doc.manufacturer_ids,
    dosageForm: doc.dosage_form,
    route: doc.route,
    atcCode: doc.atc_code,
    whoEml: doc.who_eml,
    nlemCritical: doc.nlem_critical,
    temperatureRequirement: doc.temperature_requirement,
    storageTextRaw: doc.storage_text_raw,
    storageParseReason: doc.storage_parse_reason,
    coldChain: doc.cold_chain,
    excursionUpperC: toQuantity(doc.excursion_upper_c),
    ceilingPriceInr: toQuantity(doc.ceiling_price_inr),
    dddMg: toQuantity(doc.ddd_mg),
    zApi: toQuantity(doc.z_api),
    zPlant: toQuantity(doc.z_plant),
    rawLabelerCount: toQuantity(doc.raw_labeler_count),
    labelerCountWasTruncated: doc.labeler_count_was_truncated,
    hhiManufacturers: toQuantity(doc.hhi_manufacturers),
    isSingleSource: doc.is_single_source,
    apiTierVisibility: doc.api_tier_visibility,
    storageConditionsStated: doc.storage_conditions_stated,
    createdAt: doc.created_at.toISOString(),
  };
}

function fromDrugUpsert(
  input: DrugUpsertInput,
): Omit<DrugDoc, '_id' | 'created_at' | 'updated_at'> {
  return {
    generic_name: input.genericName,
    brand_names: input.brandNames,
    ndc_product_codes: input.ndcProductCodes,
    ingredient_ids: input.ingredientIds,
    manufacturer_ids: input.manufacturerIds,
    dosage_form: input.dosageForm,
    route: input.route,
    atc_code: input.atcCode,
    who_eml: input.whoEml,
    nlem_critical: input.nlemCritical,
    temperature_requirement: input.temperatureRequirement,
    storage_text_raw: input.storageTextRaw,
    storage_parse_reason: input.storageParseReason,
    cold_chain: input.coldChain,
    excursion_upper_c: fromQuantity(input.excursionUpperC),
    ceiling_price_inr: fromQuantity(input.ceilingPriceInr),
    ddd_mg: fromQuantity(input.dddMg),
    z_api: fromQuantity(input.zApi),
    z_plant: fromQuantity(input.zPlant),
    raw_labeler_count: fromQuantity(input.rawLabelerCount),
    labeler_count_was_truncated: input.labelerCountWasTruncated,
    hhi_manufacturers: fromQuantity(input.hhiManufacturers),
    is_single_source: input.isSingleSource,
    api_tier_visibility: input.apiTierVisibility,
    storage_conditions_stated: input.storageConditionsStated,
    provenance: fromProvenance(input.provenance),
  };
}

function toManufacturerEntity(doc: ManufacturerDoc): ManufacturerEntity {
  return {
    id: doc._id,
    name: doc.name,
    nameRaw: doc.name_raw,
    country: doc.country,
    capacityIndex: toQuantity(doc.capacity_index),
    registeredFacilityCount: toQuantity(doc.registered_facility_count),
    distinctProductCount: toQuantity(doc.distinct_product_count),
    createdAt: doc.created_at.toISOString(),
  };
}

function toIngredientEntity(doc: IngredientDoc): IngredientEntity {
  return {
    id: doc._id,
    unii: doc.unii,
    name: doc.name,
    nameRaw: doc.name_raw,
    atcCode: doc.atc_code,
    hsCodes: doc.hs_codes,
    maxCountryDependencyShare: toQuantity(doc.max_country_dependency_share),
    createdAt: doc.created_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function upsertDrug(input: DrugUpsertInput): Promise<DrugEntity> {
  try {
    const row = await DrugModel.findByIdAndUpdate(
      input.id,
      { $set: fromDrugUpsert(input), $setOnInsert: { _id: input.id } },
      { upsert: true, new: true, runValidators: true },
    )
      .lean<DrugDoc>()
      .exec();

    if (row === null) throw new Error('upsert returned no document');
    return toDrugEntity(row);
  } catch (error) {
    throw new DatabaseError('upsertDrug', error);
  }
}

/**
 * Upserts many manufacturers in one round trip.
 *
 * `bulkWrite`, not a loop of `findByIdAndUpdate`: a heparin refresh touches 47
 * manufacturers, and 47 sequential round trips is exactly the N+1 problem
 * PART 3A.5 rule 11 is about.
 */
async function upsertManufacturers(inputs: ManufacturerUpsertInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  try {
    const result = await ManufacturerModel.bulkWrite(
      inputs.map((input) => ({
        updateOne: {
          filter: { _id: input.id },
          update: {
            $set: {
              name: input.name,
              name_raw: input.nameRaw,
              country: input.country,
              capacity_index: fromQuantity(input.capacityIndex),
              registered_facility_count: fromQuantity(input.registeredFacilityCount),
              distinct_product_count: fromQuantity(input.distinctProductCount),
              provenance: fromProvenance(input.provenance),
            },
            $setOnInsert: { _id: input.id },
          },
          upsert: true,
        },
      })),
      // Unordered so one bad document does not abort the other forty-six.
      { ordered: false },
    );
    return result.upsertedCount + result.modifiedCount;
  } catch (error) {
    throw new DatabaseError('upsertManufacturers', error);
  }
}

async function upsertIngredients(inputs: IngredientUpsertInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  try {
    const result = await IngredientModel.bulkWrite(
      inputs.map((input) => ({
        updateOne: {
          filter: { _id: input.id },
          update: {
            $set: {
              unii: input.unii,
              name: input.name,
              name_raw: input.nameRaw,
              atc_code: input.atcCode,
              hs_codes: input.hsCodes,
              max_country_dependency_share: fromQuantity(input.maxCountryDependencyShare),
              provenance: fromProvenance(input.provenance),
            },
            $setOnInsert: { _id: input.id },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return result.upsertedCount + result.modifiedCount;
  } catch (error) {
    throw new DatabaseError('upsertIngredients', error);
  }
}

async function findDrugById(id: string): Promise<DrugEntity | null> {
  try {
    const row = await DrugModel.findById(id).lean<DrugDoc>().exec();
    return row === null ? null : toDrugEntity(row);
  } catch (error) {
    throw new DatabaseError('findDrugById', error);
  }
}

export type DrugListFilter = {
  limit: number;
  cursorId: string | null;
  nlemCriticalOnly: boolean;
  singleSourceOnly: boolean;
};

/**
 * Lists drugs, id-ascending, one row past the limit.
 *
 * The extra row answers "is there another page?" without a second
 * `countDocuments()`. Sorting by `_id` rather than `created_at` is deliberate:
 * the id is a slug, so the order is stable and human-meaningful, and it is
 * unique, so no tie-breaker is needed.
 */
async function listDrugs(filter: DrugListFilter): Promise<DrugEntity[]> {
  try {
    const query: Record<string, unknown> = {};
    if (filter.nlemCriticalOnly) query.nlem_critical = true;
    if (filter.singleSourceOnly) query.is_single_source = true;
    if (filter.cursorId !== null) query._id = { $gt: filter.cursorId };

    const rows = await DrugModel.find(query)
      .sort({ _id: 1 })
      .limit(Math.min(filter.limit, MAX_PAGE_SIZE) + 1)
      .lean<DrugDoc[]>()
      .exec();

    return rows.map(toDrugEntity);
  } catch (error) {
    throw new DatabaseError('listDrugs', error);
  }
}

/** Batched with `$in`, so resolving a cascade's manufacturers is one query. */
async function findManufacturersByIds(ids: string[]): Promise<ManufacturerEntity[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await ManufacturerModel.find({ _id: { $in: ids } })
      .lean<ManufacturerDoc[]>()
      .exec();
    return rows.map(toManufacturerEntity);
  } catch (error) {
    throw new DatabaseError('findManufacturersByIds', error);
  }
}

async function findIngredientsByIds(ids: string[]): Promise<IngredientEntity[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await IngredientModel.find({ _id: { $in: ids } })
      .lean<IngredientDoc[]>()
      .exec();
    return rows.map(toIngredientEntity);
  } catch (error) {
    throw new DatabaseError('findIngredientsByIds', error);
  }
}

async function countDrugs(): Promise<number> {
  try {
    return await DrugModel.estimatedDocumentCount().exec();
  } catch (error) {
    throw new DatabaseError('countDrugs', error);
  }
}

export type CatalogRepository = {
  upsertDrug(input: DrugUpsertInput): Promise<DrugEntity>;
  upsertManufacturers(inputs: ManufacturerUpsertInput[]): Promise<number>;
  upsertIngredients(inputs: IngredientUpsertInput[]): Promise<number>;
  findDrugById(id: string): Promise<DrugEntity | null>;
  listDrugs(filter: DrugListFilter): Promise<DrugEntity[]>;
  findManufacturersByIds(ids: string[]): Promise<ManufacturerEntity[]>;
  findIngredientsByIds(ids: string[]): Promise<IngredientEntity[]>;
  countDrugs(): Promise<number>;
};

export function createCatalogRepository(): CatalogRepository {
  return {
    upsertDrug,
    upsertManufacturers,
    upsertIngredients,
    findDrugById,
    listDrugs,
    findManufacturersByIds,
    findIngredientsByIds,
    countDrugs,
  };
}
