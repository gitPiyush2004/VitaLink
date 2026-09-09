/**
 * The only place this module touches Mongoose. Same shape as the other two
 * repositories: standalone functions, explicit mappers, a factory that names them.
 *
 * The method worth reading is `loadAll`. Materialising the whole graph into
 * memory sounds alarming until you count it: the entire node and edge set for a
 * catalogue of this size is a few thousand documents, and the alternative — a
 * database round trip per cascade hop — is the N+1 problem at its worst, on the
 * request hot path. The cap and the count it reports are there so that
 * assumption is checked rather than assumed.
 */

import type { GraphEdge, GraphNode } from '@vitalink/contracts';

import { MAX_GRAPH_NEIGHBOURS } from '@config/constants';
import { fromProvenance, fromQuantity, toProvenance, toQuantity } from '@shared/db/mappers';
import { DatabaseError } from '@shared/errors';

import { GraphEdgeModel, type GraphEdgeDoc } from './models/graph-edge.model';
import { GraphNodeModel, type GraphNodeDoc } from './models/graph-node.model';

/**
 * Ceiling on a whole-graph load.
 *
 * Not a page size — it is a tripwire. If the graph ever exceeds this, the
 * in-memory materialisation assumption has stopped holding and the traversal
 * needs rethinking, so `loadAll` reports hitting it rather than silently
 * returning a partial graph and producing a cascade that quietly stops early.
 */
const MAX_GRAPH_DOCUMENTS = 50_000;

function toNode(doc: GraphNodeDoc): GraphNode {
  return {
    id: doc._id,
    type: doc.type,
    label: doc.label,
    attrs: doc.attrs,
    point: doc.point === null ? null : { type: 'Point', coordinates: doc.point.coordinates },
    provenance: toProvenance(doc.provenance),
  };
}

function toEdge(doc: GraphEdgeDoc): GraphEdge {
  const weight = toQuantity(doc.weight);
  if (weight === null) throw new Error(`edge ${doc._id} has no weight`);

  return {
    id: doc._id,
    src: doc.src,
    dst: doc.dst,
    rel: doc.rel,
    weight,
    provenance: toProvenance(doc.provenance),
  };
}

async function upsertNodes(nodes: GraphNode[]): Promise<number> {
  if (nodes.length === 0) return 0;
  try {
    const result = await GraphNodeModel.bulkWrite(
      nodes.map((node) => ({
        updateOne: {
          filter: { _id: node.id },
          update: {
            $set: {
              type: node.type,
              label: node.label,
              attrs: node.attrs,
              point:
                node.point === null
                  ? null
                  : { type: 'Point' as const, coordinates: node.point.coordinates },
              provenance: fromProvenance(node.provenance),
            },
            $setOnInsert: { _id: node.id },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return result.upsertedCount + result.modifiedCount;
  } catch (error) {
    throw new DatabaseError('upsertNodes', error);
  }
}

async function upsertEdges(edges: GraphEdge[]): Promise<number> {
  if (edges.length === 0) return 0;
  try {
    const result = await GraphEdgeModel.bulkWrite(
      edges.map((edge) => {
        // `fromQuantity` is nullable because most fields are; an edge weight is
        // not. Narrowing here rather than casting means a weightless edge fails
        // loudly at the boundary instead of writing a document the traversal
        // would later read as weight zero.
        const weight = fromQuantity(edge.weight);
        if (weight === null) {
          throw new Error(`edge ${edge.id} has no weight, which the schema requires`);
        }

        return {
          updateOne: {
            filter: { _id: edge.id },
            update: {
              $set: {
                src: edge.src,
                dst: edge.dst,
                rel: edge.rel,
                weight,
                provenance: fromProvenance(edge.provenance),
              },
              $setOnInsert: { _id: edge.id },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
    return result.upsertedCount + result.modifiedCount;
  } catch (error) {
    throw new DatabaseError('upsertEdges', error);
  }
}

export type GraphSnapshot = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** True when a cap was hit, so a caller can refuse to run a partial cascade. */
  wasTruncated: boolean;
};

/**
 * Loads the whole graph for in-memory traversal.
 *
 * Two queries, not one per hop. See the note at the top of the file.
 */
async function loadAll(): Promise<GraphSnapshot> {
  try {
    const [nodeDocs, edgeDocs] = await Promise.all([
      GraphNodeModel.find({}).limit(MAX_GRAPH_DOCUMENTS).lean<GraphNodeDoc[]>().exec(),
      GraphEdgeModel.find({}).limit(MAX_GRAPH_DOCUMENTS).lean<GraphEdgeDoc[]>().exec(),
    ]);

    return {
      nodes: nodeDocs.map(toNode),
      edges: edgeDocs.map(toEdge),
      wasTruncated:
        nodeDocs.length >= MAX_GRAPH_DOCUMENTS || edgeDocs.length >= MAX_GRAPH_DOCUMENTS,
    };
  } catch (error) {
    throw new DatabaseError('loadAll', error);
  }
}

async function findNodeById(id: string): Promise<GraphNode | null> {
  try {
    const doc = await GraphNodeModel.findById(id).lean<GraphNodeDoc>().exec();
    return doc === null ? null : toNode(doc);
  } catch (error) {
    throw new DatabaseError('findNodeById', error);
  }
}

/**
 * Outbound neighbours of one node, capped.
 *
 * Serves the graph explorer, which shows one node's immediate surroundings. The
 * cascade does not use this — it materialises once and traverses in memory.
 */
async function findOutboundEdges(nodeId: string): Promise<GraphEdge[]> {
  try {
    const docs = await GraphEdgeModel.find({ src: nodeId })
      .limit(MAX_GRAPH_NEIGHBOURS)
      .lean<GraphEdgeDoc[]>()
      .exec();
    return docs.map(toEdge);
  } catch (error) {
    throw new DatabaseError('findOutboundEdges', error);
  }
}

async function countNodesAndEdges(): Promise<{ nodes: number; edges: number }> {
  try {
    const [nodes, edges] = await Promise.all([
      GraphNodeModel.estimatedDocumentCount().exec(),
      GraphEdgeModel.estimatedDocumentCount().exec(),
    ]);
    return { nodes, edges };
  } catch (error) {
    throw new DatabaseError('countNodesAndEdges', error);
  }
}

export type GraphRepository = {
  upsertNodes(nodes: GraphNode[]): Promise<number>;
  upsertEdges(edges: GraphEdge[]): Promise<number>;
  loadAll(): Promise<GraphSnapshot>;
  findNodeById(id: string): Promise<GraphNode | null>;
  findOutboundEdges(nodeId: string): Promise<GraphEdge[]>;
  countNodesAndEdges(): Promise<{ nodes: number; edges: number }>;
};

export function createGraphRepository(): GraphRepository {
  return {
    upsertNodes,
    upsertEdges,
    loadAll,
    findNodeById,
    findOutboundEdges,
    countNodesAndEdges,
  };
}
