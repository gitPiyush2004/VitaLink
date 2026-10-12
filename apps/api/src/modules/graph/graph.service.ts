/**
 * Building and reading the supply graph.
 *
 * The rebuild is a full re-derivation from the catalogue, not an incremental
 * patch. That is deliberate: the graph has no state of its own worth preserving,
 * every node and edge id is a deterministic slug, and a full rebuild is
 * idempotent. An incremental updater would need to work out which edges to
 * *delete* when a drug's manufacturer list shrinks, and getting that wrong leaves
 * a stale edge that a cascade will happily traverse.
 */

import type { GraphEdge, GraphNode } from '@vitalink/contracts';
import { enumeratePaths, materialise, type TraversalResult } from '@vitalink/graph';

import { DEFAULT_CASCADE_MAX_DEPTH, MAX_PAGE_SIZE, MAX_PATHS_PER_DRUG } from '@config/constants';
import type { CatalogService } from '@modules/catalog';
import { logger } from '@shared/logger';

import { buildGraph, type BuildResult } from './domain/build-graph';
import type { GraphRepository } from './graph.repository';

/**
 * Paths weaker than this are dropped during traversal.
 *
 * A path with weight 1e-4 contributes a rounding error to the exposure sum while
 * costing a whole subtree to explore. The threshold is reported on every cascade
 * so the pruning is visible rather than silent.
 */
const MIN_PATH_WEIGHT = 0.001;

export type RebuildOutcome = {
  nodesUpserted: number;
  edgesUpserted: number;
  nodeCount: number;
  edgeCount: number;
  /** Relations that could not be built from public data, and why. */
  absentRelations: BuildResult['absentRelations'];
};

export class GraphService {
  constructor(
    private readonly repository: GraphRepository,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Re-derives the whole graph from the catalogue.
   *
   * @returns what was written, plus the relations that are absent and why. The
   *   absent list is part of the result rather than a log line, because the UI
   *   has to say "no country dependency observed" instead of showing an empty
   *   panel that looks like zero risk.
   */
  async rebuild(): Promise<RebuildOutcome> {
    const drugs = await this.catalog.listDrugs({
      limit: MAX_PAGE_SIZE,
      cursorId: null,
      nlemCriticalOnly: false,
      singleSourceOnly: false,
    });

    // Two batched reads for every drug's related records, not one per drug.
    const manufacturerIds = [...new Set(drugs.flatMap((drug) => drug.manufacturerIds))];
    const ingredientIds = [...new Set(drugs.flatMap((drug) => drug.ingredientIds))];
    const [manufacturers, ingredients] = await Promise.all([
      this.catalog.getManufacturers(manufacturerIds),
      this.catalog.getIngredients(ingredientIds),
    ]);

    const built = buildGraph({ drugs, manufacturers, ingredients });

    const nodesUpserted = await this.repository.upsertNodes(built.nodes);
    const edgesUpserted = await this.repository.upsertEdges(built.edges);
    const counts = await this.repository.countNodesAndEdges();

    logger.info(
      { nodesUpserted, edgesUpserted, absent: built.absentRelations.length },
      'graph rebuilt',
    );

    return {
      nodesUpserted,
      edgesUpserted,
      nodeCount: counts.nodes,
      edgeCount: counts.edges,
      absentRelations: built.absentRelations,
    };
  }

  /**
   * Materialises the graph and enumerates every path forward from one node.
   *
   * The caller gets the traversal result, not an exposure score: turning paths
   * into exposure is the cascade module's job, and keeping the split means this
   * method is reusable by the graph explorer as well.
   */
  async traceFrom(
    shockNodeId: string,
    options: { maxDepth?: number } = {},
  ): Promise<{ result: TraversalResult; graphWasTruncated: boolean; droppedEdges: number }> {
    const snapshot = await this.repository.loadAll();
    return this.traceSnapshot(shockNodeId, snapshot, options);
  }

  traceSnapshot(
    shockNodeId: string,
    snapshot: { nodes: GraphNode[]; edges: GraphEdge[]; wasTruncated?: boolean },
    options: { maxDepth?: number } = {},
  ): { result: TraversalResult; graphWasTruncated: boolean; droppedEdges: number } {
    const wasTruncated = snapshot.wasTruncated ?? false;
    const { graph, droppedEdges } = materialise(snapshot.nodes, snapshot.edges);

    if (droppedEdges > 0) {
      // A dangling edge means persistence and the graph disagree. Logged rather
      // than ignored, because it shows up otherwise as a cascade that stops early
      // for no visible reason.
      logger.warn({ droppedEdges }, 'dropped edges whose endpoints were missing');
    }

    return {
      result: enumeratePaths(graph, shockNodeId, {
        maxDepth: options.maxDepth ?? DEFAULT_CASCADE_MAX_DEPTH,
        maxPathsPerNode: MAX_PATHS_PER_DRUG,
        minPathWeight: MIN_PATH_WEIGHT,
      }),
      graphWasTruncated: wasTruncated,
      droppedEdges,
    };
  }

  /** A coherent network derived from the selected catalogue record, not stale upserts. */
  async forDrug(drugId: string): Promise<BuildResult> {
    const drug = await this.catalog.getDrug(drugId);
    if (drug === null) return { nodes: [], edges: [], absentRelations: [] };
    const [manufacturers, ingredients] = await Promise.all([
      this.catalog.getManufacturers(drug.manufacturerIds),
      this.catalog.getIngredients(drug.ingredientIds),
    ]);
    return buildGraph({ drugs: [drug], manufacturers, ingredients });
  }

  /** Finds observed products connected to the selected upstream entity. No global graph rewrite. */
  async forShock(shockNodeId: string): Promise<BuildResult> {
    const drugs = [];
    let cursorId: string | null = null;
    for (;;) {
      const page = await this.catalog.listDrugs({
        limit: MAX_PAGE_SIZE,
        cursorId,
        nlemCriticalOnly: false,
        singleSourceOnly: false,
      });
      const current = page.slice(0, MAX_PAGE_SIZE);
      drugs.push(
        ...current.filter(
          (drug) =>
            drug.ingredientIds.includes(shockNodeId) || drug.manufacturerIds.includes(shockNodeId),
        ),
      );
      if (page.length <= MAX_PAGE_SIZE) break;
      cursorId = current.at(-1)?.id ?? null;
      if (!cursorId) break;
    }
    const [manufacturers, ingredients] = await Promise.all([
      this.catalog.getManufacturers([...new Set(drugs.flatMap((drug) => drug.manufacturerIds))]),
      this.catalog.getIngredients([...new Set(drugs.flatMap((drug) => drug.ingredientIds))]),
    ]);
    return buildGraph({ drugs, manufacturers, ingredients });
  }

  async getNode(nodeId: string): Promise<GraphNode | null> {
    return this.repository.findNodeById(nodeId);
  }

  async getNeighbours(nodeId: string): Promise<GraphEdge[]> {
    return this.repository.findOutboundEdges(nodeId);
  }

  async counts(): Promise<{ nodes: number; edges: number }> {
    return this.repository.countNodesAndEdges();
  }
}
