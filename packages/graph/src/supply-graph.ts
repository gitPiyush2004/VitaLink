/**
 * The supply graph, as a graphology instance.
 *
 * Two planes joined by one node type:
 *
 *   regulatory  country --SOURCED_FROM--> ingredient --CONTAINED_IN--> drug
 *                       --MADE_BY--> manufacturer --OPERATES--> facility
 *   physical    drug --STOCKED_AT--> hub --SHIPS_VIA--> lane
 *                    --DELIVERS_TO--> healthcare_facility --SERVES--> district
 *
 * The `drug` node is the bridge. That bridge is the whole reason a country-level
 * export restriction can be traced to a district-level population, and it is why
 * the graph is one structure rather than two.
 *
 * This package holds the in-memory model and the traversal. Persistence lives in
 * the API's `graph` module; centrality and k-core live in the Python service next
 * to networkx. Traversal is here because it sits on the request hot path and a
 * round-trip to Python per cascade hop would dominate the latency.
 */

import Graph from 'graphology';

import type { EdgeRelation, GraphEdge, GraphNode, NodeType } from '@vitalink/contracts';

/** What each node carries in the graph. Kept small: traversal reads these. */
export type NodeAttributes = {
  type: NodeType;
  label: string;
  /** Denormalised, type-specific. Read by the exposure formula, not by traversal. */
  attrs: Record<string, unknown>;
};

export type EdgeAttributes = {
  rel: EdgeRelation;
  /** 0..1. Its meaning depends on the relation; see `graphEdgeSchema`. */
  weight: number;
};

/**
 * Directed and multi: two nodes can be joined by more than one relation.
 *
 * A drug is both `MADE_BY` a manufacturer and, potentially, `STOCKED_AT` a hub
 * that manufacturer operates. A simple graph would silently drop the second
 * edge, and the cascade would then miss a real path.
 */
export type SupplyGraph = Graph<NodeAttributes, EdgeAttributes>;

export function createSupplyGraph(): SupplyGraph {
  return new Graph<NodeAttributes, EdgeAttributes>({ type: 'directed', multi: true });
}

/**
 * Materialises persisted nodes and edges into a traversable graph.
 *
 * Edges whose endpoints are missing are **dropped and counted**, not silently
 * ignored. A dangling edge means the persistence layer and the graph disagree,
 * and the count is logged so that disagreement is visible rather than showing up
 * later as a cascade that mysteriously stops early.
 */
export function materialise(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { graph: SupplyGraph; droppedEdges: number } {
  const graph = createSupplyGraph();

  for (const node of nodes) {
    graph.mergeNode(node.id, { type: node.type, label: node.label, attrs: node.attrs });
  }

  let droppedEdges = 0;
  for (const edge of edges) {
    if (!graph.hasNode(edge.src) || !graph.hasNode(edge.dst)) {
      droppedEdges += 1;
      continue;
    }
    graph.addDirectedEdgeWithKey(edge.id, edge.src, edge.dst, {
      rel: edge.rel,
      weight: edge.weight.value,
    });
  }

  return { graph, droppedEdges };
}

export function nodesOfType(graph: SupplyGraph, type: NodeType): string[] {
  return graph.filterNodes((_id, attributes) => attributes.type === type);
}

/** Outbound neighbours reached by one specific relation. */
export function neighboursByRelation(
  graph: SupplyGraph,
  nodeId: string,
  rel: EdgeRelation,
): { nodeId: string; weight: number }[] {
  if (!graph.hasNode(nodeId)) return [];

  const found: { nodeId: string; weight: number }[] = [];
  graph.forEachOutboundEdge(nodeId, (_edge, attributes, _source, target) => {
    if (attributes.rel === rel) found.push({ nodeId: target, weight: attributes.weight });
  });
  return found;
}

/**
 * Deterministic node ids.
 *
 * Ids are derived from the natural key rather than generated, for two reasons.
 * First, re-running the graph build must be idempotent — a generated id would
 * create a duplicate node on every run. Second, an id like
 * `drug:heparin-sodium` is readable in a URL and in a log line, which matters
 * when someone is trying to work out why a cascade reached a particular drug.
 */
export function nodeId(type: NodeType, naturalKey: string): string {
  return `${type}:${slugify(naturalKey)}`;
}

export function edgeId(src: string, rel: EdgeRelation, dst: string): string {
  return `${src}|${rel}|${dst}`;
}

/**
 * Normalises a natural key into a slug.
 *
 * Exported and pure so it can be unit tested, because it is load-bearing: if
 * "Fresenius Kabi USA, LLC" and "FRESENIUS KABI USA LLC" slugify differently,
 * the graph gets two manufacturer nodes for one company, `z_api` is inflated,
 * and the Fragility Index is understated.
 */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      // Strip combining marks, so "Sanofi-Aventis" and "Sanofi‑Aventis" (with a
      // non-breaking hyphen) do not become different nodes.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
  );
}

const MAX_SLUG_LENGTH = 120;
