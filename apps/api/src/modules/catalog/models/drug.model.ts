/**
 * The `drugs` collection.
 *
 * The drug is the bridge node between the regulatory plane and the physical
 * plane, so this is the most-read document in the system: the cascade lands on
 * it, the reliability model is keyed to it, and the logistics recommender reads
 * its temperature requirement.
 *
 * Note what is absent, deliberately (spec Rule 1): no inventory, no purchase
 * orders, no demand, no capacity in units per day. No public API publishes any of
 * those, so there are no fields for them. Where the system needs such a figure it
 * derives an explicitly-labelled band or index instead.
 */

import { model, Schema } from 'mongoose';

import { TEMPERATURE_RANGES, type TemperatureRange } from '@vitalink/contracts';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

/**
 * The stored shape, declared explicitly rather than inferred.
 * See `shared/db/document-types.ts` for why.
 */
export type DrugDoc = TimestampDoc & {
  _id: string;
  generic_name: string;
  brand_names: string[];
  ndc_product_codes: string[];
  ingredient_ids: string[];
  manufacturer_ids: string[];
  dosage_form: string | null;
  route: string | null;
  atc_code: string | null;
  who_eml: boolean;
  nlem_critical: boolean;
  temperature_requirement: TemperatureRange | null;
  prohibited_temperature_ranges: TemperatureRange[];
  storage_text_raw: string | null;
  storage_parse_reason: string | null;
  cold_chain: boolean;
  excursion_upper_c: QuantityDoc | null;
  ceiling_price_inr: QuantityDoc | null;
  ddd_mg: QuantityDoc | null;
  z_api: QuantityDoc | null;
  z_plant: QuantityDoc | null;
  raw_labeler_count: QuantityDoc | null;
  labeler_count_was_truncated: boolean;
  hhi_manufacturers: QuantityDoc | null;
  is_single_source: boolean;
  api_tier_visibility: 'OBSERVED_FROM_TRADE_DATA' | 'NOT_OBSERVED';
  storage_conditions_stated: string[];
  provenance: ProvenanceDoc;
};

const drugSchema = new Schema<DrugDoc>(
  {
    /** Deterministic slug, e.g. `drug:heparin-sodium`. Idempotent re-ingest. */
    _id: { type: String, required: true },

    /** Normalised generic name — the join key across openFDA, WHO EML and NLEM. */
    generic_name: { type: String, required: true },
    brand_names: { type: [String], default: [] },
    ndc_product_codes: { type: [String], default: [] },
    ingredient_ids: { type: [String], default: [] },
    manufacturer_ids: { type: [String], default: [] },
    dosage_form: { type: String, default: null },
    route: { type: String, default: null },
    atc_code: { type: String, default: null },

    who_eml: { type: Boolean, default: false },
    nlem_critical: { type: Boolean, default: false },

    /** Parsed from the real openFDA label storage section, never user-supplied. */
    temperature_requirement: { type: String, enum: TEMPERATURE_RANGES, default: null },
    prohibited_temperature_ranges: { type: [String], enum: TEMPERATURE_RANGES, default: [] },
    storage_text_raw: { type: String, default: null },
    /** Why the parse produced that range, or why it produced nothing. */
    storage_parse_reason: { type: String, default: null },
    cold_chain: { type: Boolean, default: false },
    /** Upper bound of the label's own stated excursion allowance, in Celsius. */
    excursion_upper_c: { type: quantitySubSchema, default: null },

    /** NPPA/DPCO ceiling price. The only honest basis for a rupee figure. */
    ceiling_price_inr: { type: quantitySubSchema, default: null },
    /** WHO defined daily dose, used to model demand from population. */
    ddd_mg: { type: quantitySubSchema, default: null },

    // ---- Redundancy, as derived in domain/redundancy-derivation.ts ----------
    /**
     * API-supplier redundancy. 1 and tagged SCENARIO whenever
     * `api_tier_visibility` is NOT_OBSERVED — openFDA cannot see this echelon.
     */
    z_api: { type: quantitySubSchema, default: null },
    /**
     * Finished-dose plant redundancy, DERIVED from openFDA labeler shares. This
     * is the echelon openFDA labeler data actually measures.
     */
    z_plant: { type: quantitySubSchema, default: null },
    /** Raw distinct labeler count. A FLOOR when the count was truncated. */
    raw_labeler_count: { type: quantitySubSchema, default: null },
    /** True when openFDA capped the count buckets, so the count is a floor. */
    labeler_count_was_truncated: { type: Boolean, default: false },
    /** Herfindahl index over observed product-listing shares. */
    hhi_manufacturers: { type: quantitySubSchema, default: null },
    is_single_source: { type: Boolean, default: true },
    /**
     * Whether API-tier concentration was actually observed. `NOT_OBSERVED` means
     * fragility may be understated, and the UI says so next to the number.
     */
    api_tier_visibility: {
      type: String,
      enum: ['OBSERVED_FROM_TRADE_DATA', 'NOT_OBSERVED'],
      default: 'NOT_OBSERVED',
    },
    /**
     * Every condition the label stated, strictest first. An insulin label states
     * both refrigerated and room-temperature conditions; the shipping
     * requirement is the strictest, and this records that both were seen.
     */
    storage_conditions_stated: { type: [String], default: [] },

    provenance: { type: provenanceSchemaForDocuments, required: true },
    /**
     * Declared even though the `timestamps` option below fills them in, so that
     * every field actually stored is visible in the schema.
     */
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'drugs',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    // The _id is our own slug, so Mongoose must not cast it to an ObjectId.
    _id: false,
  },
);

// The fragility board sorts by fragility and filters to critical drugs. ADR-0010.
drugSchema.index({ nlem_critical: 1, is_single_source: 1 });
// Name lookup from the search box and from the ingestion upsert.
drugSchema.index({ generic_name: 1 });
// The cascade resolves a drug from an alert's extracted ingredient name.
drugSchema.index({ ingredient_ids: 1 });

export const DrugModel = model<DrugDoc>('Drug', drugSchema);
