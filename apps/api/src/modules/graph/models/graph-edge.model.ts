/**
 * The `edges` collection.
 *
 * Indexed on `{src, rel}` and `{dst, rel}` because the cascade walks forward and
 * the explanation walks backward, and both need the relation to filter. Those
 * two indexes are the difference between a traversal that is a few hundred
 * indexed lookups and one that scans the whole collection per hop.
 */

import { model, Schema } from 'mongoose';

import { EDGE_RELATIONS, type EdgeRelation } from '@vitalink/contracts';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

export type GraphEdgeDoc = TimestampDoc & {
  /** `src|REL|dst`, so a rebuild updates rather than duplicates. */
  _id: string;
  src: string;
  dst: string;
  rel: EdgeRelation;
  /**
   * 0..1, and its meaning depends on the relation. Every edge states which in
   * `weight.provenance.calculation_method`, because a bare 0.68 on an edge is
   * meaningless without knowing it is a trade import share rather than a
   * contracted volume.
   */
  weight: QuantityDoc;
  provenance: ProvenanceDoc;
};

const graphEdgeSchema = new Schema<GraphEdgeDoc>(
  {
    _id: { type: String, required: true },
    src: { type: String, required: true },
    dst: { type: String, required: true },
    rel: { type: String, required: true, enum: EDGE_RELATIONS },
    weight: { type: quantitySubSchema, required: true },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'edges',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// Forward traversal: "what does this node lead to, by this relation?"
graphEdgeSchema.index({ src: 1, rel: 1 });
// Backward explanation: "what reaches this node?"
graphEdgeSchema.index({ dst: 1, rel: 1 });
// Loading the whole graph for materialisation reads by relation.
graphEdgeSchema.index({ rel: 1 });

export const GraphEdgeModel = model<GraphEdgeDoc>('GraphEdge', graphEdgeSchema);
