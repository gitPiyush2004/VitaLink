/**
 * Forward propagation from a shock node.
 *
 * The output is deliberately not "these nodes are affected". It is **every path**
 * from the shock to each reachable node, hop by hop, with the weight of each hop.
 * That is the difference between a system that says "this drug is at risk" and
 * one that says "this drug is at risk *because* China supplies 68% of its API,
 * which is contained in it, and it is made by only two firms" — and the second is
 * the only one a supply chain manager can act on or a reviewer can check.
 *
 * The traversal is a bounded depth-first enumeration rather than a shortest-path
 * search, because the exposure formula sums over *all* paths: two weak paths to
 * the same drug are a different risk from one strong path, and Dijkstra would
 * report only the strongest.
 */

import type { EdgeRelation } from '@vitalink/contracts';

import type { SupplyGraph } from './supply-graph';

/** One hop, with everything needed to render it as a clickable chain. */
export type Hop = {
  fromNodeId: string;
  toNodeId: string;
  rel: EdgeRelation;
  weight: number;
  fromLabel: string;
  toLabel: string;
};

export type Path = {
  hops: Hop[];
  /** Product of the hop weights. The multiplicative term in the exposure sum. */
  pathWeight: number;
  length: number;
};

export type TraversalOptions = {
  /** Stop expanding beyond this many hops. */
  maxDepth: number;
  /** Cap on paths retained per destination node, to bound both time and memory. */
  maxPathsPerNode: number;
  /**
   * Paths whose accumulated weight falls below this contribute a rounding error
   * to the exposure sum while costing a full subtree of traversal, so they are
   * pruned. The threshold is reported on the cascade record.
   */
  minPathWeight: number;
};

export type TraversalResult = {
  /** Destination node id -> every retained path from the shock to it. */
  pathsByNode: Map<string, Path[]>;
  /** Nodes reached, in first-visit order. Drives the map animation. */
  touchedNodeIds: string[];
  /** True when a cap was hit, so the cascade record can say coverage is partial. */
  wasTruncated: boolean;
  prunedByWeight: number;
  prunedByCap: number;
};

/**
 * One position in the depth-first walk.
 *
 * `onPath` is the cycle guard. The supply graph is not acyclic — a manufacturer
 * can operate a facility that stocks a hub that delivers to a facility the same
 * manufacturer owns — so a node already on the current path is not revisited.
 */
type Frame = { nodeId: string; hops: Hop[]; weight: number; onPath: Set<string> };

/**
 * The walk's accumulator.
 *
 * A class rather than a plain object passed around and mutated, because
 * `no-param-reassign` correctly forbids the latter — mutating a parameter's
 * properties is how a caller ends up surprised by a callee. Mutation on `this`
 * is explicit and local to the walk.
 */
class WalkState {
  readonly pathsByNode = new Map<string, Path[]>();
  readonly touchedNodeIds: string[] = [];
  private readonly seenForOrder = new Set<string>();
  prunedByWeight = 0;
  prunedByCap = 0;

  /** Records a path to `nodeId`, respecting the per-node cap. */
  record(nodeId: string, path: Path, maxPathsPerNode: number): void {
    if (!this.seenForOrder.has(nodeId)) {
      this.seenForOrder.add(nodeId);
      this.touchedNodeIds.push(nodeId);
    }

    const existing = this.pathsByNode.get(nodeId);
    if (existing === undefined) {
      this.pathsByNode.set(nodeId, [path]);
      return;
    }
    if (existing.length >= maxPathsPerNode) {
      this.prunedByCap += 1;
      return;
    }
    existing.push(path);
  }

  countWeightPrune(): void {
    this.prunedByWeight += 1;
  }

  toResult(): TraversalResult {
    return {
      pathsByNode: this.pathsByNode,
      touchedNodeIds: this.touchedNodeIds,
      wasTruncated: this.prunedByCap > 0 || this.prunedByWeight > 0,
      prunedByWeight: this.prunedByWeight,
      prunedByCap: this.prunedByCap,
    };
  }
}

/**
 * Expands one frame, recording every surviving path and returning the frames to
 * visit next.
 *
 * Extracted from `enumeratePaths` so the traversal reads as "pop a frame, expand
 * it, push what it produced" rather than as one long nested loop.
 */
function expandFrame(
  graph: SupplyGraph,
  frame: Frame,
  options: TraversalOptions,
  state: WalkState,
): Frame[] {
  const next: Frame[] = [];

  graph.forEachOutboundEdge(frame.nodeId, (_edge, attributes, source, target) => {
    // Per-path cycle check, not a global visited set: a global set would stop
    // the walk finding the second and third distinct paths to the same drug,
    // which is exactly what the exposure formula sums over.
    if (frame.onPath.has(target)) return;

    const weight = frame.weight * attributes.weight;
    if (weight < options.minPathWeight) {
      state.countWeightPrune();
      return;
    }

    const hop: Hop = {
      fromNodeId: source,
      toNodeId: target,
      rel: attributes.rel,
      weight: attributes.weight,
      fromLabel: graph.getNodeAttribute(source, 'label'),
      toLabel: graph.getNodeAttribute(target, 'label'),
    };

    const hops = [...frame.hops, hop];
    state.record(
      target,
      { hops, pathWeight: weight, length: hops.length },
      options.maxPathsPerNode,
    );

    next.push({
      nodeId: target,
      hops,
      weight,
      // A fresh set per frame, so sibling branches do not block each other. The
      // copy is the price of finding every distinct path.
      onPath: new Set([...frame.onPath, target]),
    });
  });

  return next;
}

/**
 * Enumerates weighted paths forward from one node.
 *
 * An explicit stack rather than recursion, because the graph's depth is
 * data-dependent and a deep chain should not risk the call stack.
 */
export function enumeratePaths(
  graph: SupplyGraph,
  shockNodeId: string,
  options: TraversalOptions,
): TraversalResult {
  const state = new WalkState();

  if (!graph.hasNode(shockNodeId)) return state.toResult();

  const stack: Frame[] = [
    { nodeId: shockNodeId, hops: [], weight: 1, onPath: new Set([shockNodeId]) },
  ];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    if (frame.hops.length >= options.maxDepth) continue;

    stack.push(...expandFrame(graph, frame, options, state));
  }

  return state.toResult();
}

/** Paths to nodes of one type, e.g. every path that reached a `drug`. */
export function pathsToNodesOfType(
  graph: SupplyGraph,
  result: TraversalResult,
  type: string,
): Map<string, Path[]> {
  const filtered = new Map<string, Path[]>();

  for (const [nodeId, paths] of result.pathsByNode) {
    if (graph.getNodeAttribute(nodeId, 'type') === type) filtered.set(nodeId, paths);
  }

  return filtered;
}
