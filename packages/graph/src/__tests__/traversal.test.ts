/**
 * Traversal tests.
 *
 * The two that matter most are `finds_every_distinct_path` and the cycle test.
 * The exposure formula sums over all paths, so a traversal that returned only
 * the strongest one — which is what a shortest-path search would do — would
 * systematically understate risk for exactly the drugs that have several weak
 * dependencies rather than one strong one.
 */

import { describe, expect, it } from 'vitest';

import { createSupplyGraph, type SupplyGraph } from '../supply-graph';
import { enumeratePaths, type TraversalOptions } from '../traversal';

const OPTIONS: TraversalOptions = { maxDepth: 6, maxPathsPerNode: 200, minPathWeight: 0.001 };

function addNode(graph: SupplyGraph, id: string, type: string, label: string): void {
  graph.mergeNode(id, { type: type as never, label, attrs: {} });
}

/** Options object rather than a fifth positional parameter (PART 3A.12). */
function addEdge(
  graph: SupplyGraph,
  edge: { src: string; dst: string; weight: number; rel?: string },
): void {
  const rel = edge.rel ?? 'SOURCED_FROM';
  graph.addDirectedEdgeWithKey(`${edge.src}|${rel}|${edge.dst}`, edge.src, edge.dst, {
    rel: rel as never,
    weight: edge.weight,
  });
}

/**
 * country:cn --0.7--> ingredient:api --1.0--> drug:x
 * country:in --0.3--> ingredient:api
 */
function simpleChain(): SupplyGraph {
  const graph = createSupplyGraph();
  addNode(graph, 'country:cn', 'country', 'China');
  addNode(graph, 'country:in', 'country', 'India');
  addNode(graph, 'ingredient:api', 'ingredient', 'Heparin API');
  addNode(graph, 'drug:x', 'drug', 'Heparin Sodium Injection');

  addEdge(graph, { src: 'country:cn', dst: 'ingredient:api', weight: 0.7 });
  addEdge(graph, { src: 'country:in', dst: 'ingredient:api', weight: 0.3 });
  addEdge(graph, { src: 'ingredient:api', dst: 'drug:x', weight: 1, rel: 'CONTAINED_IN' });
  return graph;
}

describe('enumeratePaths', () => {
  it('returns an empty result for a node that is not in the graph', () => {
    const result = enumeratePaths(createSupplyGraph(), 'country:xx', OPTIONS);

    expect(result.pathsByNode.size).toBe(0);
    expect(result.touchedNodeIds).toEqual([]);
  });

  it('reaches a drug through its ingredient and records the whole chain', () => {
    const result = enumeratePaths(simpleChain(), 'country:cn', OPTIONS);

    const paths = result.pathsByNode.get('drug:x');
    expect(paths).toHaveLength(1);
    expect(paths?.[0]?.hops.map((hop) => hop.toNodeId)).toEqual(['ingredient:api', 'drug:x']);
  });

  it('multiplies the hop weights along a path', () => {
    const result = enumeratePaths(simpleChain(), 'country:cn', OPTIONS);

    // 0.7 (China's import share) x 1.0 (the ingredient is in the drug)
    expect(result.pathsByNode.get('drug:x')?.[0]?.pathWeight).toBeCloseTo(0.7, 10);
  });

  it('carries labels on every hop, so the chain can be rendered without a second query', () => {
    const result = enumeratePaths(simpleChain(), 'country:cn', OPTIONS);

    const firstHop = result.pathsByNode.get('drug:x')?.[0]?.hops[0];
    expect(firstHop?.fromLabel).toBe('China');
    expect(firstHop?.toLabel).toBe('Heparin API');
  });

  it('finds every distinct path to the same node, not just the strongest', () => {
    // Two ingredients, both from China, both in the same drug. The drug has two
    // independent dependencies on one country, and the exposure formula needs
    // both. A shortest-path search would report one.
    const graph = createSupplyGraph();
    addNode(graph, 'country:cn', 'country', 'China');
    addNode(graph, 'ingredient:a', 'ingredient', 'API A');
    addNode(graph, 'ingredient:b', 'ingredient', 'API B');
    addNode(graph, 'drug:x', 'drug', 'Combination product');

    addEdge(graph, { src: 'country:cn', dst: 'ingredient:a', weight: 0.8 });
    addEdge(graph, { src: 'country:cn', dst: 'ingredient:b', weight: 0.4 });
    addEdge(graph, { src: 'ingredient:a', dst: 'drug:x', weight: 1, rel: 'CONTAINED_IN' });
    addEdge(graph, { src: 'ingredient:b', dst: 'drug:x', weight: 1, rel: 'CONTAINED_IN' });

    const result = enumeratePaths(graph, 'country:cn', OPTIONS);

    const paths = result.pathsByNode.get('drug:x');
    expect(paths).toHaveLength(2);
    expect(paths?.map((path) => path.pathWeight).sort()).toEqual([0.4, 0.8]);
  });

  it('terminates on a cycle instead of looping forever', () => {
    // Real graphs have these: a manufacturer operates a facility that stocks a
    // hub that delivers to a facility the same manufacturer owns.
    const graph = createSupplyGraph();
    addNode(graph, 'a', 'manufacturer', 'A');
    addNode(graph, 'b', 'facility', 'B');
    addNode(graph, 'c', 'hub', 'C');

    addEdge(graph, { src: 'a', dst: 'b', weight: 1, rel: 'OPERATES' });
    addEdge(graph, { src: 'b', dst: 'c', weight: 1, rel: 'STOCKED_AT' });
    addEdge(graph, { src: 'c', dst: 'a', weight: 1, rel: 'DELIVERS_TO' });

    const result = enumeratePaths(graph, 'a', OPTIONS);

    expect(result.touchedNodeIds.sort()).toEqual(['b', 'c']);
  });

  it('does not use a global visited set, which would hide parallel paths', () => {
    // a -> b -> d and a -> c -> d. A global visited set would mark d on the
    // first arrival and never record the second path.
    const graph = createSupplyGraph();
    for (const id of ['a', 'b', 'c', 'd']) addNode(graph, id, 'drug', id.toUpperCase());
    addEdge(graph, { src: 'a', dst: 'b', weight: 1 });
    addEdge(graph, { src: 'a', dst: 'c', weight: 1 });
    addEdge(graph, { src: 'b', dst: 'd', weight: 0.5 });
    addEdge(graph, { src: 'c', dst: 'd', weight: 0.25 });

    const result = enumeratePaths(graph, 'a', OPTIONS);

    expect(result.pathsByNode.get('d')).toHaveLength(2);
  });

  it('respects the depth cap', () => {
    const graph = createSupplyGraph();
    for (const id of ['n0', 'n1', 'n2', 'n3', 'n4']) addNode(graph, id, 'drug', id);
    addEdge(graph, { src: 'n0', dst: 'n1', weight: 1 });
    addEdge(graph, { src: 'n1', dst: 'n2', weight: 1 });
    addEdge(graph, { src: 'n2', dst: 'n3', weight: 1 });
    addEdge(graph, { src: 'n3', dst: 'n4', weight: 1 });

    const result = enumeratePaths(graph, 'n0', { ...OPTIONS, maxDepth: 2 });

    expect(result.pathsByNode.has('n2')).toBe(true);
    expect(result.pathsByNode.has('n3')).toBe(false);
  });

  it('prunes a path whose accumulated weight falls below the threshold', () => {
    const graph = createSupplyGraph();
    for (const id of ['a', 'b', 'c']) addNode(graph, id, 'drug', id);
    addEdge(graph, { src: 'a', dst: 'b', weight: 0.01 });
    addEdge(graph, { src: 'b', dst: 'c', weight: 0.01 });

    const result = enumeratePaths(graph, 'a', { ...OPTIONS, minPathWeight: 0.001 });

    // 0.01 survives; 0.0001 does not.
    expect(result.pathsByNode.has('b')).toBe(true);
    expect(result.pathsByNode.has('c')).toBe(false);
    expect(result.prunedByWeight).toBe(1);
  });

  it('reports truncation, so a partial cascade can say so', () => {
    const graph = createSupplyGraph();
    addNode(graph, 'a', 'country', 'A');
    addNode(graph, 'target', 'drug', 'Target');
    for (let index = 0; index < 5; index += 1) {
      addNode(graph, `mid${String(index)}`, 'ingredient', `Mid ${String(index)}`);
      addEdge(graph, { src: 'a', dst: `mid${String(index)}`, weight: 1 });
      addEdge(graph, { src: `mid${String(index)}`, dst: 'target', weight: 1, rel: 'CONTAINED_IN' });
    }

    const result = enumeratePaths(graph, 'a', { ...OPTIONS, maxPathsPerNode: 2 });

    expect(result.pathsByNode.get('target')).toHaveLength(2);
    expect(result.wasTruncated).toBe(true);
    expect(result.prunedByCap).toBe(3);
  });

  it('records first-visit order, which drives the map animation', () => {
    const result = enumeratePaths(simpleChain(), 'country:cn', OPTIONS);

    expect(result.touchedNodeIds).toEqual(['ingredient:api', 'drug:x']);
  });

  it('does not include the shock node itself among the touched nodes', () => {
    const result = enumeratePaths(simpleChain(), 'country:cn', OPTIONS);

    expect(result.touchedNodeIds).not.toContain('country:cn');
  });
});
