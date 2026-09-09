/**
 * The `nodes` collection.
 *
 * One collection for every node type rather than one per type, because the
 * cascade traverses across types constantly — a query per type would turn one
 * traversal into seven round trips. `type` is indexed so a type-scoped read is
 * still cheap.
 */

import { model, Schema } from 'mongoose';

import { NODE_TYPES, type NodeType } from '@vitalink/contracts';

import type { GeoPointDoc, ProvenanceDoc, TimestampDoc } from '@shared/db/document-types';
import { geoPointSubSchema, provenanceSchemaForDocuments } from '@shared/db/quantity.schema';

export type GraphNodeDoc = TimestampDoc & {
  /** Deterministic slug, e.g. `drug:heparin-sodium`. Idempotent rebuilds. */
  _id: string;
  type: NodeType;
  label: string;
  /** Type-specific, denormalised, deliberately small: traversal reads these. */
  attrs: Record<string, unknown>;
  point: GeoPointDoc | null;
  provenance: ProvenanceDoc;
};

const graphNodeSchema = new Schema<GraphNodeDoc>(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true, enum: NODE_TYPES },
    label: { type: String, required: true },
    attrs: { type: Schema.Types.Mixed, default: {} },
    point: { type: geoPointSubSchema, default: null },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'nodes',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// The fragility board and the map both read one type at a time.
graphNodeSchema.index({ type: 1 });
// Resolving an alert's extracted entity name to a node is a label lookup.
graphNodeSchema.index({ type: 1, label: 1 });
// Every coordinate gets a 2dsphere index, so "facilities near this shock" is a
// geospatial query rather than a full scan. Sparse because most nodes — drugs,
// ingredients, countries — have no point.
graphNodeSchema.index({ point: '2dsphere' }, { sparse: true });

export const GraphNodeModel = model<GraphNodeDoc>('GraphNode', graphNodeSchema);
