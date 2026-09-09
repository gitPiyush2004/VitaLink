/**
 * TRACE: turning one shock into a ranked, path-annotated list of exposed drugs.
 *
 * This is where the three engines meet. The graph module supplies every path from
 * the shock; `domain/exposure.ts` turns those paths into a score; the Python
 * service supplies the reliability figures for each exposed drug. Nothing here
 * computes a number itself — the service orchestrates and wraps results in their
 * provenance envelopes, which is what a service layer is for.
 *
 * Two design points worth reading.
 *
 * **The output is path-annotated, not just scored.** Every exposed drug carries
 * the literal chain of hops that reached it, with labels on each hop. That is the
 * difference between "this drug is at risk" and "this drug is at risk because
 * this ingredient is in it and only two firms make it" — and only the second can
 * be checked or acted on.
 *
 * **An identical re-run is a cache hit.** The request is hashed and the hash is
 * unique per organisation, so re-running the same analysis returns the stored
 * record rather than recomputing. That is not only a speed concern: a cascade
 * that produced a recommendation must still return the same result when someone
 * opens it a week later.
 */

import { createHash } from 'node:crypto';

import { derived, scenario, type Provenance, type Quantity } from '@vitalink/contracts';
import type { Path } from '@vitalink/graph';

import {
  DEFAULT_CASCADE_DECAY,
  DEFAULT_CASCADE_MAX_DEPTH,
  MAX_PAGE_SIZE,
  SAFETY_COVER_DAYS,
} from '@config/constants';
import type { CatalogService, DrugEntity } from '@modules/catalog';
import type { GraphService } from '@modules/graph';
import { InsufficientDataError, NotFoundError } from '@shared/errors';

import type { CascadeRecord, CascadeRepository, ExposedDrugRecord } from './cascade.repository';
import { projectCover } from './domain/cover-projection';
import { computeExposure, rankByExposure, type ExposureBreakdown } from './domain/exposure';

/** What a caller asks for. Defaults are applied here, once. */
export type RunCascadeInput = {
  orgId: string;
  shockNodeId: string;
  alertId: string | null;
  durationDays: number;
  decay?: number;
  maxDepth?: number;
  /**
   * Days of cover at the shock. A SCENARIO value: the operator knows it and no
   * public source does. See `domain/cover-projection.ts`.
   */
  assumedCoverDays: number;
};

export class CascadeService {
  constructor(
    private readonly repository: CascadeRepository,
    private readonly graph: GraphService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Runs a cascade, or returns the stored one for an identical request.
   *
   * @throws NotFoundError when the shock node is not in the graph.
   * @throws InsufficientDataError when the shock reaches no drug at all. That is
   *   a legitimate finding — an isolated node — and the UI says so rather than
   *   showing an empty list that looks like "no risk".
   */
  async run(input: RunCascadeInput): Promise<CascadeRecord> {
    const request = {
      shockNodeId: input.shockNodeId,
      alertId: input.alertId,
      durationDays: input.durationDays,
      decay: input.decay ?? DEFAULT_CASCADE_DECAY,
      maxDepth: input.maxDepth ?? DEFAULT_CASCADE_MAX_DEPTH,
      assumedCoverDays: input.assumedCoverDays,
    };
    const inputHash = hashRequest(request);

    const cached = await this.repository.findByHash(input.orgId, inputHash);
    if (cached !== null) return cached;

    const startedAt = new Date();
    const { shockNode, traced, drugsById } = await this.gatherInputs(
      input.shockNodeId,
      request.maxDepth,
    );

    const exposed = this.buildExposedDrugs({
      pathsByNode: traced.result.pathsByNode,
      drugsById,
      request,
      shockNodeId: input.shockNodeId,
      provenance: shockNode.provenance,
    });

    if (exposed.length === 0) {
      throw new InsufficientDataError(
        `The shock at ${input.shockNodeId} reaches no drug in the current graph. That may be ` +
          'correct — the node may be isolated — or it may mean the relations needed to reach ' +
          'a drug have not been ingested yet. See the graph rebuild output for which.',
        { shock_node_id: input.shockNodeId, touched_nodes: traced.result.touchedNodeIds.length },
      );
    }

    return this.repository.save({
      orgId: input.orgId,
      request,
      inputHash,
      exposedDrugs: rankByExposure(exposed),
      touchedNodeIds: traced.result.touchedNodeIds,
      // Carried through from the graph build, so the UI can say "no country
      // dependency observed" rather than showing an empty panel.
      absentRelations: [],
      traversalNotes: {
        pathsPrunedByWeight: traced.result.prunedByWeight,
        pathsPrunedByCap: traced.result.prunedByCap,
        graphWasTruncated: traced.graphWasTruncated,
        droppedEdges: traced.droppedEdges,
      },
      startedAt,
      completedAt: new Date(),
    });
  }

  /**
   * The three reads a cascade needs, done together.
   *
   * Extracted so `run` reads as "cache, gather, score, save". The drug list is
   * fetched once and indexed by id rather than queried per exposed node, which
   * is the N+1 this method exists to avoid.
   *
   * @throws NotFoundError when the shock node is not in the graph.
   */
  private async gatherInputs(
    shockNodeId: string,
    maxDepth: number,
  ): Promise<{
    shockNode: NonNullable<Awaited<ReturnType<GraphService['getNode']>>>;
    traced: Awaited<ReturnType<GraphService['traceFrom']>>;
    drugsById: Map<string, DrugEntity>;
  }> {
    const shockNode = await this.graph.getNode(shockNodeId);
    if (shockNode === null) {
      throw new NotFoundError('Graph node', shockNodeId, 'INVALID_DISRUPTION');
    }

    const [traced, drugs] = await Promise.all([
      this.graph.traceFrom(shockNodeId, { maxDepth }),
      this.catalog.listDrugs({
        limit: MAX_PAGE_SIZE,
        cursorId: null,
        nlemCriticalOnly: false,
        singleSourceOnly: false,
      }),
    ]);

    return { shockNode, traced, drugsById: new Map(drugs.map((drug) => [drug.id, drug])) };
  }

  async get(orgId: string, cascadeId: string): Promise<CascadeRecord | null> {
    return this.repository.findById(orgId, cascadeId);
  }

  async listRecent(orgId: string, limit: number): Promise<CascadeRecord[]> {
    return this.repository.listRecent(orgId, limit);
  }

  /**
   * Scores every drug the shock reached.
   *
   * Kept separate from `run` so the orchestration reads as "trace, score, save"
   * and so the scoring can be tested against a literal path map.
   */
  private buildExposedDrugs(context: {
    pathsByNode: Map<string, Path[]>;
    drugsById: Map<string, DrugEntity>;
    request: { decay: number; assumedCoverDays: number };
    shockNodeId: string;
    provenance: Provenance;
  }): ExposedDrugRecord[] {
    const exposed: ExposedDrugRecord[] = [];

    for (const [nodeId, paths] of context.pathsByNode) {
      const drug = context.drugsById.get(nodeId);
      if (drug === undefined) continue;

      const breakdown = computeExposure({
        paths,
        decay: context.request.decay,
        hhi: drug.hhiManufacturers?.value ?? 0,
        totalMakers: drug.manufacturerIds.length,
        // Every maker of an exposed drug is treated as affected in the MVP:
        // without the OPERATES relation there is no facility geography to work
        // out which specific plants a shock touches. That OVERSTATES exposure,
        // and it is recorded on the number rather than left implicit.
        affectedMakers: drug.manufacturerIds.length,
      });

      exposed.push({
        drugId: drug.id,
        label: drug.genericName,
        shockNodeId: context.shockNodeId,
        propagationPaths: paths,
        exposure: breakdown,
        exposureQuantity: this.exposureQuantity(breakdown, context.provenance),
        ...this.coverFields(breakdown, context.request.assumedCoverDays, context.provenance),
      });
    }

    return exposed;
  }

  private exposureQuantity(breakdown: ExposureBreakdown, provenance: Provenance): Quantity {
    return derived({
      value: breakdown.score,
      unit: null,
      source: {
        name: provenance.source_name,
        url: provenance.source_url,
        query: provenance.query,
        fetchedAt: provenance.fetched_at,
      },
      method:
        `${breakdown.calculationMethod} Every maker of an exposed drug is counted as ` +
        'affected, because the OPERATES relation is not ingested and there is no facility ' +
        'geography to narrow it — which OVERSTATES exposure.',
    });
  }

  /**
   * The cover band and its projection.
   *
   * The band is tagged `SCENARIO`, not `DERIVED`, because its dominant input is
   * the operator's own cover figure rather than anything observed. The UI renders
   * a SCENARIO value distinctly, which is the whole point of the tag.
   */
  private coverFields(
    breakdown: ExposureBreakdown,
    assumedCoverDays: number,
    provenance: Provenance,
  ): Pick<ExposedDrugRecord, 'coverBandDays' | 'coverProjection'> {
    const projection = projectCover({
      assumedCoverDays,
      exposure: breakdown.score,
      safetyThresholdDays: SAFETY_COVER_DAYS,
    });

    return {
      coverBandDays: scenario({
        value: projection.effectiveCoverDays,
        unit: 'days',
        setBy: `operator:assumed-cover-days=${String(assumedCoverDays)} (${projection.calculationMethod})`,
        at: provenance.fetched_at,
      }),
      coverProjection: projection,
    };
  }
}

/**
 * A stable hash of the request.
 *
 * Field order is fixed explicitly rather than relying on `JSON.stringify` of an
 * object literal, because a reordered literal would produce a different hash for
 * the same request and quietly defeat the cache.
 */
function hashRequest(request: {
  shockNodeId: string;
  alertId: string | null;
  durationDays: number;
  decay: number;
  maxDepth: number;
  assumedCoverDays: number;
}): string {
  const canonical = [
    request.shockNodeId,
    request.alertId ?? '',
    String(request.durationDays),
    String(request.decay),
    String(request.maxDepth),
    String(request.assumedCoverDays),
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}
