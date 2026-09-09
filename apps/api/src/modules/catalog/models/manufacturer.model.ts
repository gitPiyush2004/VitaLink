/**
 * The `manufacturers` collection.
 *
 * `capacity_index` is the field worth reading the comment on. No public source
 * publishes a pharmaceutical company's capacity in units per day, so this is an
 * **ordinal index** derived from registered facility count and distinct product
 * count. It is called an index everywhere it appears, and it is never presented
 * as units of anything (spec Rule 1).
 */

import { model, Schema } from 'mongoose';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

export type ManufacturerDoc = TimestampDoc & {
  _id: string;
  name: string;
  name_raw: string;
  country: string | null;
  capacity_index: QuantityDoc | null;
  registered_facility_count: QuantityDoc | null;
  distinct_product_count: QuantityDoc | null;
  provenance: ProvenanceDoc;
};

const manufacturerSchema = new Schema<ManufacturerDoc>(
  {
    _id: { type: String, required: true },

    /** Normalised: case, punctuation and legal suffixes folded by `slugify`. */
    name: { type: String, required: true },
    /** As openFDA wrote it, kept so the normalisation can be audited. */
    name_raw: { type: String, required: true },
    country: { type: String, default: null },

    /**
     * An ORDINAL INDEX, not units per day. Derived from registered facility
     * count times distinct product count. Displayed as an index, always.
     */
    capacity_index: { type: quantitySubSchema, default: null },
    registered_facility_count: { type: quantitySubSchema, default: null },
    distinct_product_count: { type: quantitySubSchema, default: null },

    provenance: { type: provenanceSchemaForDocuments, required: true },
    /**
     * Declared even though the `timestamps` option below fills them in, so that
     * every field actually stored is visible in the schema.
     */
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'manufacturers',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// An alert names a firm as free text; resolving it to a node is a name lookup.
manufacturerSchema.index({ name: 1 });
manufacturerSchema.index({ country: 1 });

export const ManufacturerModel = model<ManufacturerDoc>('Manufacturer', manufacturerSchema);
