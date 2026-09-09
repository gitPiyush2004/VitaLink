/**
 * The `Quantity` envelope as a reusable Mongoose sub-schema.
 *
 * Every numeric field in every model uses this instead of `Number`. That is what
 * makes CI gate 1 enforceable: the gate greps model files for bare `Number`
 * fields and fails the build on any it finds outside a short, justified list of
 * structural counts.
 *
 * `_id: false` on the sub-schemas matters. Mongoose gives every sub-document its
 * own ObjectId by default, which would put a meaningless `_id` inside every
 * single number in the database — thousands of them per cascade, all noise in
 * every document a reader opens.
 *
 * Note that `provenance.source_url` and `provenance.fetched_at` are `required`.
 * A number whose source cannot be named must not be storable, and making that a
 * schema-level requirement means the write fails rather than succeeding with a
 * hole in it.
 */

import { Schema } from 'mongoose';

import { PROVENANCE_TAGS } from '@vitalink/contracts';

/** A GeoJSON Point has exactly two ordinates: longitude then latitude. */
const GEOJSON_POINT_ORDINATES = 2;

const provenanceSubSchema = new Schema(
  {
    source_name: { type: String, required: true },
    // Required, and deliberately so: gate 1 also asserts this is not optional.
    source_url: { type: String, required: true },
    query: { type: String, default: null },
    fetched_at: { type: Date, required: true },
    /** Required for DERIVED and MODELLED. Enforced by zod at the boundary. */
    calculation_method: { type: String, default: null },
    /** Required for MODELLED. `Mixed` because assumptions differ per model. */
    assumptions: { type: Schema.Types.Mixed, default: null },
    confidence: { type: Number, default: null },
    /** Set when an LLM touched a categorical field on the parent record. */
    llm_model: { type: String, default: null },
    prompt_hash: { type: String, default: null },
  },
  { _id: false },
);

const bandSubSchema = new Schema(
  {
    low: { type: Number, required: true },
    high: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * Use this for every number.
 *
 * ```ts
 * capacity_index: { type: quantitySubSchema, default: null }
 * ```
 *
 * The zod schema in `packages/contracts` is what enforces the tag-dependent
 * rules — a DERIVED value needs a formula, a MODELLED value needs a band — and
 * it runs at the service boundary before anything reaches here. This schema is
 * the structural half: it guarantees the *shape* is present, and the zod
 * refinement guarantees the *contents* are consistent.
 */
export const quantitySubSchema = new Schema(
  {
    value: { type: Number, required: true },
    unit: { type: String, default: null },
    tag: { type: String, required: true, enum: PROVENANCE_TAGS },
    provenance: { type: provenanceSubSchema, required: true },
    /** Required when `tag` is MODELLED. Enforced by zod, not here. */
    band: { type: bandSubSchema, default: null },
  },
  { _id: false },
);

/** For a record's own top-level provenance, separate from any single number. */
export const provenanceSchemaForDocuments = provenanceSubSchema;

/**
 * GeoJSON Point, for a `2dsphere` index.
 *
 * Note the coordinate order: `[longitude, latitude]`. This is GeoJSON's order
 * and the reverse of how humans say it. Getting it backwards puts Hyderabad in
 * the Indian Ocean, and Mongo will happily index it there.
 */
export const geoPointSubSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]): boolean => value.length === GEOJSON_POINT_ORDINATES,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false },
);
