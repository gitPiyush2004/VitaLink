/**
 * The product universe, built entirely from public regulatory data.
 *
 * Note what is absent: no inventory, no purchase orders, no capacity in units
 * per day, no contracts. No public API publishes those, so we do not have fields
 * for them. Where the system needs such a figure it derives an explicitly-labelled
 * index or band instead (spec PART 2, Rule 1).
 */

import { z } from 'zod';

import { geoPointSchema, idSchema } from './common';
import { temperatureRangeSchema } from './enums';
import { provenanceSchema, quantitySchema } from './provenance';

export const ingredientSchema = z.object({
  id: idSchema,
  /** UNII where openFDA supplies one, otherwise the normalised substance name. */
  unii: z.string().nullable(),
  name: z.string().min(1),
  /** WHO ATC code where we could map it. Drives criticality classification. */
  atc_code: z.string().nullable(),
  /** HS codes this ingredient is traded under, used to join UN Comtrade. */
  hs_codes: z.array(z.string()),
  provenance: provenanceSchema,
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const manufacturerSchema = z.object({
  id: idSchema,
  /** openFDA labeler name, normalised (case, punctuation, legal suffixes). */
  name: z.string().min(1),
  name_raw: z.string().min(1),
  country: z.string().nullable(),
  /**
   * Ordinal index, NOT units per day. Derived from registered facility count and
   * distinct product count. Called an index everywhere it is displayed.
   */
  capacity_index: quantitySchema.nullable(),
  registered_facility_count: quantitySchema.nullable(),
  distinct_product_count: quantitySchema.nullable(),
  provenance: provenanceSchema,
});
export type Manufacturer = z.infer<typeof manufacturerSchema>;

export const facilitySchema = z.object({
  id: idSchema,
  manufacturer_id: idSchema,
  /** Registered establishment name from the DailyMed SPL. */
  name: z.string().min(1),
  address_raw: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  point: geoPointSchema.nullable(),
  /** Which SPL establishment operations were registered here (e.g. "MANUFACTURE"). */
  operations: z.array(z.string()),
  provenance: provenanceSchema,
});
export type Facility = z.infer<typeof facilitySchema>;

export const drugSchema = z.object({
  id: idSchema,
  /** Normalised generic name — the join key across openFDA, WHO EML and NLEM. */
  generic_name: z.string().min(1),
  brand_names: z.array(z.string()),
  /** National Drug Codes observed for this generic. */
  ndc_product_codes: z.array(z.string()),
  ingredient_ids: z.array(idSchema),
  manufacturer_ids: z.array(idSchema),
  dosage_form: z.string().nullable(),
  route: z.string().nullable(),
  atc_code: z.string().nullable(),

  /** On the WHO Essential Medicines List. Feeds the criticality weight delta. */
  who_eml: z.boolean(),
  /** On India's National List of Essential Medicines. */
  nlem_critical: z.boolean(),

  /** Parsed from the real openFDA label storage-and-handling section. */
  temperature_requirement: temperatureRangeSchema.nullable(),
  storage_text_raw: z.string().nullable(),
  cold_chain: z.boolean(),

  /** NPPA/DPCO ceiling price. The only honest basis for a rupee figure. */
  ceiling_price_inr: quantitySchema.nullable(),

  /** WHO defined daily dose, used to model demand from population. */
  ddd_mg: quantitySchema.nullable(),

  provenance: provenanceSchema,
});
export type Drug = z.infer<typeof drugSchema>;

export const healthcareFacilitySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** OSM amenity value: hospital, clinic, pharmacy, doctors. */
  kind: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  district_id: idSchema.nullable(),
  point: geoPointSchema,
  /** OSM `beds` tag where present. Drives the catchment share. */
  beds: quantitySchema.nullable(),
  provenance: provenanceSchema,
});
export type HealthcareFacility = z.infer<typeof healthcareFacilitySchema>;

export const districtSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  state: z.string().nullable(),
  country: z.string(),
  population: quantitySchema,
  centroid: geoPointSchema,
  provenance: provenanceSchema,
});
export type District = z.infer<typeof districtSchema>;

export const hubSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** Warehouse, port or airport from OSM / data.gov.in. */
  kind: z.string(),
  city: z.string().nullable(),
  country: z.string(),
  point: geoPointSchema,
  provenance: provenanceSchema,
});
export type Hub = z.infer<typeof hubSchema>;

export const laneSchema = z.object({
  id: idSchema,
  origin_hub_id: idSchema,
  destination_facility_id: idSchema,
  distance_km: quantitySchema,
  road_duration_hours: quantitySchema,
  /** OSRM-encoded polyline. Weather is sampled along this geometry. */
  geometry_polyline: z.string().nullable(),
  provenance: provenanceSchema,
});
export type Lane = z.infer<typeof laneSchema>;
