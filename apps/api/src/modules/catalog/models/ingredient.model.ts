/**
 * The `ingredients` collection.
 *
 * `hs_codes` is the join key into UN Comtrade, and therefore the thing that lets
 * a country-dependency edge exist at all. Without it an ingredient has no
 * observable trade structure and the cascade cannot start from a country node.
 */

import { model, Schema } from 'mongoose';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

export type IngredientDoc = TimestampDoc & {
  _id: string;
  unii: string | null;
  name: string;
  name_raw: string;
  atc_code: string | null;
  hs_codes: string[];
  max_country_dependency_share: QuantityDoc | null;
  provenance: ProvenanceDoc;
};

const ingredientSchema = new Schema<IngredientDoc>(
  {
    _id: { type: String, required: true },

    /** UNII where openFDA supplies one, else the normalised substance name. */
    unii: { type: String, default: null },
    name: { type: String, required: true },
    name_raw: { type: String, required: true },
    atc_code: { type: String, default: null },
    /** HS codes this ingredient is traded under. The Comtrade join key. */
    hs_codes: { type: [String], default: [] },

    /** Largest single-country import share. A probability, never a contract. */
    max_country_dependency_share: { type: quantitySubSchema, default: null },

    provenance: { type: provenanceSchemaForDocuments, required: true },
    /**
     * Declared even though the `timestamps` option below fills them in, so that
     * every field actually stored is visible in the schema.
     */
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'ingredients',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

ingredientSchema.index({ name: 1 });
ingredientSchema.index({ hs_codes: 1 });

export const IngredientModel = model<IngredientDoc>('Ingredient', ingredientSchema);
