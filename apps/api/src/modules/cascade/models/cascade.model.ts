/**
 * The `cascades` collection.
 *
 * A cascade record is the audit trail for one analysis: the request that produced
 * it, the hash of that request, every exposed drug with its full propagation
 * paths, and the pruning that was applied. It is stored rather than recomputed so
 * that a recommendation can cite the exact cascade it was based on, and so a
 * reviewer can re-run the arithmetic from the record alone.
 */

import { model, Schema } from 'mongoose';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

/** One hop, denormalised so the chain renders without a second query. */
const hopSubSchema = new Schema(
  {
    from_node_id: { type: String, required: true },
    to_node_id: { type: String, required: true },
    rel: { type: String, required: true },
    weight: { type: Number, required: true },
    from_label: { type: String, required: true },
    to_label: { type: String, required: true },
  },
  { _id: false },
);

const propagationPathSubSchema = new Schema(
  {
    hops: { type: [hopSubSchema], required: true },
    path_weight: { type: Number, required: true },
    length: { type: Number, required: true },
  },
  { _id: false },
);

const coverProjectionSubSchema = new Schema(
  {
    days: { type: [Number], required: true },
    cover_units_low: { type: [Number], required: true },
    cover_units_high: { type: [Number], required: true },
    stockout_day_band: {
      type: new Schema({ low: { type: Number }, high: { type: Number } }, { _id: false }),
      default: null,
    },
    assumptions: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const exposedDrugSubSchema = new Schema(
  {
    drug_id: { type: String, required: true },
    label: { type: String, required: true },
    shock_node_id: { type: String, required: true },
    propagation_paths: { type: [propagationPathSubSchema], required: true },
    exposure_score_0_1: { type: quantitySubSchema, required: true },
    // Required, not nullable: the cascade always projects cover, because the
    // operator's assumed-cover figure is a required field on the request. A
    // nullable column here would force every reader to defend against a state
    // that cannot occur.
    cover_band_days: { type: quantitySubSchema, required: true },
    cover_projection: { type: coverProjectionSubSchema, required: true },
    /** Empty in the MVP: the physical layer is not ingested yet, and says so. */
    facilities: { type: [Schema.Types.Mixed], default: [] },
    population_band: { type: quantitySubSchema, default: null },
  },
  { _id: false },
);

export type CascadeDoc = TimestampDoc & {
  _id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  org_id: string;
  request: {
    shock_node_id: string;
    alert_id: string | null;
    duration_days: number;
    decay: number;
    max_depth: number;
    assumed_cover_days: number;
  };
  /** Hash of the request, so an identical re-run is a cache hit, not new work. */
  input_hash: string;
  exposed_drugs: unknown[];
  touched_node_ids: string[];
  /** Relations the graph could not build, carried through so the UI can say so. */
  absent_relations: { rel: string; reason: string }[];
  traversal_notes: {
    paths_pruned_by_weight: number;
    paths_pruned_by_cap: number;
    graph_was_truncated: boolean;
    dropped_edges: number;
  };
  started_at: Date;
  completed_at: Date | null;
  error: string | null;
  provenance: ProvenanceDoc;
};

const cascadeSchema = new Schema<CascadeDoc>(
  {
    _id: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'],
    },
    org_id: { type: String, required: true },
    request: {
      shock_node_id: { type: String, required: true },
      alert_id: { type: String, default: null },
      duration_days: { type: Number, required: true },
      decay: { type: Number, required: true },
      max_depth: { type: Number, required: true },
      assumed_cover_days: { type: Number, required: true },
    },
    input_hash: { type: String, required: true },
    exposed_drugs: { type: [exposedDrugSubSchema], default: [] },
    touched_node_ids: { type: [String], default: [] },
    absent_relations: {
      type: [new Schema({ rel: String, reason: String }, { _id: false })],
      default: [],
    },
    traversal_notes: {
      paths_pruned_by_weight: { type: Number, required: true },
      paths_pruned_by_cap: { type: Number, required: true },
      graph_was_truncated: { type: Boolean, required: true },
      dropped_edges: { type: Number, required: true },
    },
    started_at: { type: Date, required: true },
    completed_at: { type: Date, default: null },
    error: { type: String, default: null },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'cascades',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// An identical re-run is a cache hit rather than new work, so the hash is the
// lookup key. Unique per org: two orgs may legitimately run the same analysis.
cascadeSchema.index({ org_id: 1, input_hash: 1 }, { unique: true });
// The cascade list is per-org, newest first: equality field before the sort field.
cascadeSchema.index({ org_id: 1, started_at: -1 });

export const CascadeModel = model<CascadeDoc>('Cascade', cascadeSchema);
export type { QuantityDoc };
