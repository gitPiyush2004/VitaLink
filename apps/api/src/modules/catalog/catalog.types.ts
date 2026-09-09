/**
 * Module-local types.
 *
 * The three-shape rule again (PART 3A.5 rule 7): the zod-validated request DTO
 * lives in `catalog.schema.ts`, the Mongoose model in `models/`, and the domain
 * entity is here. They are never passed into each other.
 */

import type { Provenance, Quantity, TemperatureRange } from '@vitalink/contracts';

import type { ApiTierVisibility } from './domain/redundancy-derivation';

export type DrugEntity = {
  id: string;
  genericName: string;
  brandNames: string[];
  ndcProductCodes: string[];
  ingredientIds: string[];
  manufacturerIds: string[];
  dosageForm: string | null;
  route: string | null;
  atcCode: string | null;

  whoEml: boolean;
  nlemCritical: boolean;

  temperatureRequirement: TemperatureRange | null;
  storageTextRaw: string | null;
  storageParseReason: string | null;
  coldChain: boolean;
  excursionUpperC: Quantity | null;

  ceilingPriceInr: Quantity | null;
  dddMg: Quantity | null;

  zApi: Quantity | null;
  zPlant: Quantity | null;
  rawLabelerCount: Quantity | null;
  labelerCountWasTruncated: boolean;
  hhiManufacturers: Quantity | null;
  isSingleSource: boolean;
  apiTierVisibility: ApiTierVisibility;
  storageConditionsStated: string[];

  /** The record's own provenance, so anything derived from it can inherit one. */
  provenance: Provenance;
  createdAt: string;
};

export type ManufacturerEntity = {
  id: string;
  name: string;
  nameRaw: string;
  country: string | null;
  capacityIndex: Quantity | null;
  registeredFacilityCount: Quantity | null;
  distinctProductCount: Quantity | null;
  provenance: Provenance;
  createdAt: string;
};

export type IngredientEntity = {
  id: string;
  unii: string | null;
  name: string;
  nameRaw: string;
  atcCode: string | null;
  hsCodes: string[];
  maxCountryDependencyShare: Quantity | null;
  provenance: Provenance;
  createdAt: string;
};

/**
 * What one refresh of a generic name produced.
 *
 * Returned rather than logged so the ingestion worker and the admin endpoint can
 * both report it, and so a refresh that resolved nothing says so explicitly
 * rather than looking like a success.
 */
export type RefreshOutcome = {
  drugId: string;
  genericName: string;
  productsSeen: number;
  labelersSeen: number;
  manufacturersUpserted: number;
  zApi: number;
  zApiIsAssumed: boolean;
  zPlant: number;
  rawLabelerCount: number;
  labelerCountWasTruncated: boolean;
  temperatureRequirement: TemperatureRange | null;
  storageConditionsStated: string[];
  storageParseReason: string;
  /** Non-empty when part of the refresh could not be completed, and why. */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Upsert inputs
//
// camelCase, like every other domain shape. The repository maps them to
// snake_case documents; the service never sees a database field name. An
// earlier version had the service build snake_case objects directly, which
// quietly moved the mapping up a layer and lost the type safety with it.
// ---------------------------------------------------------------------------

export type DrugUpsertInput = {
  id: string;
  genericName: string;
  brandNames: string[];
  ndcProductCodes: string[];
  ingredientIds: string[];
  manufacturerIds: string[];
  dosageForm: string | null;
  route: string | null;
  atcCode: string | null;
  whoEml: boolean;
  nlemCritical: boolean;
  temperatureRequirement: TemperatureRange | null;
  storageTextRaw: string | null;
  storageParseReason: string | null;
  coldChain: boolean;
  excursionUpperC: Quantity | null;
  ceilingPriceInr: Quantity | null;
  dddMg: Quantity | null;
  zApi: Quantity | null;
  zPlant: Quantity | null;
  rawLabelerCount: Quantity | null;
  labelerCountWasTruncated: boolean;
  hhiManufacturers: Quantity | null;
  isSingleSource: boolean;
  apiTierVisibility: ApiTierVisibility;
  storageConditionsStated: string[];
  provenance: Provenance;
};

export type ManufacturerUpsertInput = {
  id: string;
  name: string;
  nameRaw: string;
  country: string | null;
  capacityIndex: Quantity | null;
  registeredFacilityCount: Quantity | null;
  distinctProductCount: Quantity | null;
  provenance: Provenance;
};

export type IngredientUpsertInput = {
  id: string;
  unii: string | null;
  name: string;
  nameRaw: string;
  atcCode: string | null;
  hsCodes: string[];
  maxCountryDependencyShare: Quantity | null;
  provenance: Provenance;
};
