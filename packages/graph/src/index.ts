/**
 * packages/graph — the graphology model, traversal and structural metrics.
 *
 * Traversal lives here, next to the data, because it is on the request hot path
 * and a round-trip to Python per cascade hop would dominate the latency.
 * Centrality, betweenness and k-core live in `apps/brain`, next to networkx.
 *
 * Read `supply-graph.ts` first: it explains why the `drug` node is the bridge
 * between the regulatory and physical planes, which is the idea the whole
 * cascade depends on.
 */

export * from './supply-graph';
export * from './metrics';
export * from './traversal';
