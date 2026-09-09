/**
 * The stored shape of a `Quantity` and its provenance, written out by hand.
 *
 * Why hand-written rather than `InferSchemaType`: a schema that uses the
 * `timestamps` option with custom field names makes Mongoose infer an index
 * signature of `[x: string]: Date` on the document type. That signature then
 * requires every value in a `$set` to be a `Date`, which makes a typed
 * `bulkWrite` impossible to express — and reaching for `as never` to get around
 * it would throw away the type safety the strict config exists to provide.
 *
 * So each model is declared as `model<XDoc>('X', schema)` with an explicit type,
 * and these are the shared pieces. The upside beyond typing: a reader can see
 * the database shape in one place, including that `fetched_at` is a `Date` here
 * and an ISO string on the wire. That single difference is the reason the
 * repository has mappers at all.
 */

import type { ProvenanceTag } from '@vitalink/contracts';

export type ProvenanceDoc = {
  source_name: string;
  source_url: string;
  query: string | null;
  /** A `Date` in Mongo, an ISO string on the wire. Converted in the repository. */
  fetched_at: Date;
  calculation_method: string | null;
  assumptions: Record<string, unknown> | null;
  confidence: number | null;
  llm_model: string | null;
  prompt_hash: string | null;
};

export type QuantityDoc = {
  value: number;
  unit: string | null;
  tag: ProvenanceTag;
  provenance: ProvenanceDoc;
  band: { low: number; high: number } | null;
};

export type GeoPointDoc = {
  type: 'Point';
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: [number, number];
};

/** Every collection carries these, filled in by the `timestamps` option. */
export type TimestampDoc = {
  created_at: Date;
  updated_at: Date;
};
