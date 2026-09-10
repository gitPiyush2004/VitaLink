/**
 * VERIFY: clustering, corroboration, veracity, and the publish-or-quarantine call.
 *
 * Split out of `signals.service.ts`, which is now a facade over three
 * collaborators — ingest, verify, queries. The seam is real: nothing in this
 * file fetches a feed, and nothing in `signals.ingest.ts` decides whether
 * anything is true.
 *
 * ## The corroborating agent, and what it actually does
 *
 * Spec stage 2 describes an agent that issues follow-up queries to find
 * independent confirmation. `corroborate` is that: per cluster it builds a query
 * from the extracted entity, asks GDELT, and **excludes the originating domain**
 * so an outlet cannot corroborate itself.
 *
 * It is one query per cluster, not a loop. A multi-step agent is the spec's
 * eventual design, and the `arm` field exists to distinguish it from the
 * single-call baseline for PART 11's ablation. What is implemented here is the
 * single targeted call, and `arm` records that rather than claiming the agent
 * that does not exist yet.
 *
 * ## Most of what this sees will be quarantined, and that is the finding
 *
 * An FDA recall is usually reported by the FDA and nobody else. Under the
 * two-independent-sources rule it is *not publishable as a verified alert* — and
 * that is the correct outcome, not a bug to work around. The quarantine record
 * keeps it with the reason, so "how much of what we see can we corroborate" is a
 * number the system can state about itself.
 */

import type { GdeltClient } from '@vitalink/connectors';

import { CLUSTER_WINDOW_DAYS, MAX_PAGE_SIZE, MS_PER_DAY } from '@config/constants';
import type { CatalogService } from '@modules/catalog';

import { clusterSignals, type Cluster } from './domain/cluster';
import type { NodeCandidate } from './domain/resolve';
import type { computeVeracity } from './domain/veracity';
import { pickLead, prioritise } from './domain/verify-helpers';
import { ClusterAdjudicator, type ClusterableSignal } from './signals.adjudicate';
import { Corroborator, CORROBORATION_BUDGET } from './signals.corroborate';
import type { AlertRecord, SignalRecord, SignalsRepository } from './signals.repository';

export type VerifyOutcome = {
  clustersConsidered: number;
  alertsPublished: number;
  quarantined: number;
  byQuarantineReason: Record<string, number>;
  /** The honest headline: what share of what we saw could be corroborated. */
  corroborationRate: string;
  /** How the query budget was spent, and what it could not reach. */
  corroborationBudget: { limit: number; used: number; notAttempted: number; note: string };
};

/** Running counts for one VERIFY pass. */
type Tally = {
  published: number;
  quarantined: number;
  queriesUsed: number;
  notAttempted: number;
  byReason: Record<string, number>;
};

/** What one cluster's verification produced. */
type ClusterVerdict = (
  { kind: 'published'; alert: AlertRecord } | { kind: 'quarantined'; reason: string }
) & {
  spentQuery: boolean;
  /** True when no corroboration query was sent for a cluster that needed one. */
  corroborationSkipped: boolean;
};

/**
 * The rejection for a cluster that is not about pharmaceutical supply.
 *
 * A function rather than an inline string, because the sentence has to say *why*
 * the keyword test rejected it — a reason code alone gives a reviewer nothing to
 * disagree with.
 */
function irrelevantRejection(lead: SignalRecord): { reason: string; detail: string } {
  return {
    reason: 'not_pharma_relevant',
    detail:
      'No signal in this cluster names a pharmaceutical noun alongside a supply event. ' +
      `Lead headline: "${lead.title}". The relevance test is keyword-based and its decision ` +
      'is recorded per signal, so a wrong rejection is reviewable.',
  };
}

export type VerifierDeps = {
  repository: SignalsRepository;
  gdelt: GdeltClient;
  catalog: CatalogService;
  clock: { now(): Date };
};

export class SignalVerifier {
  private readonly repository: SignalsRepository;
  private readonly catalog: CatalogService;
  private readonly clock: { now(): Date };
  /**
   * Set when the corroboration source fails, for the rest of the run.
   *
   * Reset at the start of every `verify`, so it is per-run rather than per
   * process. A longer memory would be a real circuit breaker and would belong in
   * Redis alongside the carrier one; this is deliberately the narrow version.
   */
  private readonly corroborator: Corroborator;
  private readonly adjudicator: ClusterAdjudicator;
  /** Node candidates for entity resolution. One fetch per verifier instance. */
  private nodeCache: NodeCandidate[] | null = null;

  constructor(deps: VerifierDeps) {
    this.repository = deps.repository;
    this.catalog = deps.catalog;
    this.clock = deps.clock;
    this.corroborator = new Corroborator(deps.gdelt);
    this.adjudicator = new ClusterAdjudicator(deps.repository);
  }

  /**
   * VERIFY: cluster, corroborate, score, publish or quarantine.
   *
   * @returns the counts and the corroboration rate, which is the number worth
   *   reading: it says how much of what the system sees it can actually stand
   *   behind.
   */
  async verify(orgId: string): Promise<VerifyOutcome> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - CLUSTER_WINDOW_DAYS * MS_PER_DAY).toISOString();

    const signals = await this.repository.findRecentSignals(orgId, since, MAX_PAGE_SIZE);
    const clusters = clusterSignals<ClusterableSignal>(
      signals.map((signal) => ({
        id: signal.id,
        title: signal.title,
        text: signal.text,
        manufacturer: signal.manufacturer,
        publishedAt: signal.publishedAt,
        signal,
      })),
    );

    await this.repository.assignClusters(
      orgId,
      clusters.flatMap((cluster) =>
        cluster.members.map((member) => ({ signalId: member.id, clusterId: cluster.id })),
      ),
    );

    const tally = await this.verifyEach(orgId, clusters, now);
    return this.buildOutcome(clusters.length, tally);
  }

  /**
   * Verifies every cluster, spending the corroboration budget in priority order.
   *
   * Highest severity first, then most recent, so a finite budget goes where a
   * missed corroboration would cost the most: a Class I recall of a sole-source
   * injectable gets its query before a two-week-old Class III.
   */
  private async verifyEach(
    orgId: string,
    clusters: Cluster<ClusterableSignal>[],
    now: Date,
  ): Promise<Tally> {
    const tally: Tally = {
      published: 0,
      quarantined: 0,
      queriesUsed: 0,
      notAttempted: 0,
      byReason: {},
    };

    for (const cluster of prioritise(clusters)) {
      const mayQuery = tally.queriesUsed < CORROBORATION_BUDGET;
      const nodes = await this.nodeCandidates();
      const verdict = await this.verifyCluster({ orgId, cluster, nodes, now, mayQuery });

      if (verdict.spentQuery) tally.queriesUsed += 1;
      // From the verdict, not from `mayQuery`. There are two ways a cluster goes
      // uncorroborated — the budget ran out, or the source failed mid-run — and
      // counting only the first made the outcome claim "every cluster that had
      // an entity to search on was corroborated" during a run where GDELT had
      // 429'd after the first query. The note was reassuring and wrong.
      if (verdict.corroborationSkipped) tally.notAttempted += 1;

      if (verdict.kind === 'published') {
        tally.published += 1;
      } else {
        tally.quarantined += 1;
        tally.byReason[verdict.reason] = (tally.byReason[verdict.reason] ?? 0) + 1;
      }
    }

    return tally;
  }

  /** The node candidate list, fetched once per run and memoised. */
  private async nodeCandidates(): Promise<NodeCandidate[]> {
    this.nodeCache ??= await this.loadNodeCandidates();
    return this.nodeCache;
  }

  /** The run's counts, phrased for a reader rather than a dashboard. */
  private buildOutcome(clusterCount: number, tally: Tally): VerifyOutcome {
    const PERCENT = 100;
    const rate = clusterCount === 0 ? 0 : (tally.published / clusterCount) * PERCENT;

    return {
      clustersConsidered: clusterCount,
      alertsPublished: tally.published,
      quarantined: tally.quarantined,
      byQuarantineReason: tally.byReason,
      corroborationRate:
        `${String(tally.published)} of ${String(clusterCount)} clusters (${rate.toFixed(0)}%) ` +
        'had two genuinely independent sources and cleared the veracity threshold. The rest ' +
        'are in quarantine with their reason — an FDA recall that only the FDA reported is a ' +
        'real finding about corroboration, not a failure of ingestion.',
      corroborationBudget: {
        limit: CORROBORATION_BUDGET,
        used: tally.queriesUsed,
        notAttempted: tally.notAttempted,
        note:
          tally.notAttempted === 0
            ? 'Every cluster that had an entity to search on was corroborated.'
            : `${String(tally.notAttempted)} cluster(s) were not corroborated at all, because ` +
              (this.corroborator.sourceFailed
                ? 'the corroboration source failed part-way through this run and the rest were ' +
                  'skipped rather than each spending four retries on the same failure'
                : `the run's ${String(CORROBORATION_BUDGET)}-query budget was exhausted`) +
              ". They are recorded as 'corroboration was not attempted' rather than as 'no " +
              "corroboration found' — nobody looked, which is a different statement from " +
              'having looked and found nothing.',
      },
    };
  }

  /** Every drug and manufacturer name, for entity resolution. Fetched once. */

  private async loadNodeCandidates(): Promise<NodeCandidate[]> {
    const drugs = await this.catalog.listDrugs({
      limit: MAX_PAGE_SIZE,
      cursorId: null,
      nlemCriticalOnly: false,
      singleSourceOnly: false,
    });
    const manufacturerIds = [...new Set(drugs.flatMap((drug) => drug.manufacturerIds))];
    const manufacturers = await this.catalog.getManufacturers(manufacturerIds);

    return [
      ...drugs.map((drug) => ({
        nodeId: drug.id,
        label: drug.genericName,
        type: 'drug' as const,
      })),
      ...manufacturers.map((manufacturer) => ({
        nodeId: manufacturer.id,
        label: manufacturer.name,
        type: 'manufacturer' as const,
      })),
    ];
  }

  /**
   * One cluster: corroborate, score, then publish or quarantine.
   *
   * The order matters. Relevance is checked first because an irrelevant cluster
   * should not spend a GDELT query, and the entity resolution runs before the
   * veracity check because "we could not tell which node this is about" is a
   * more useful rejection reason than "it scored 0.31".
   */
  private async verifyCluster(input: {
    orgId: string;
    cluster: Cluster<ClusterableSignal>;
    nodes: NodeCandidate[];
    now: Date;
    mayQuery: boolean;
  }): Promise<ClusterVerdict> {
    const { cluster, mayQuery, now, orgId } = input;
    const members = cluster.members.map((member) => member.signal);
    const lead = pickLead(members);

    // Relevance is checked before any query is spent: an irrelevant cluster
    // should not consume budget that a real one needs.
    if (!members.some((signal) => signal.isPharmaSupplyRelevant)) {
      return this.reject({ orgId, cluster, members, now, ...irrelevantRejection(lead) });
    }

    const corroboration = mayQuery
      ? await this.corroborator.corroborate(lead, members, now)
      : { hits: [], spentQuery: false, attempted: false };

    if (!corroboration.attempted) {
      return this.rejectUncorroborated({ orgId, cluster, members, now });
    }

    const scored = this.adjudicator.scoreCluster(members, corroboration.hits, now);

    if (scored.rejection !== null) {
      return this.reject({
        orgId,
        cluster,
        members,
        now,
        reason: scored.rejection.reason,
        detail: scored.rejection.detail,
        veracity: scored.veracity,
        spentQuery: corroboration.spentQuery,
      });
    }

    const alert = await this.adjudicator.publish({
      orgId,
      cluster,
      members,
      lead,
      nodes: input.nodes,
      corroborations: corroboration.hits,
      independence: scored.independence,
      veracity: scored.veracity,
    });

    return {
      kind: 'published',
      alert,
      spentQuery: corroboration.spentQuery,
      corroborationSkipped: false,
    };
  }

  /** Quarantines a cluster and shapes the verdict. Defaults are the common case. */
  private async reject(args: {
    orgId: string;
    cluster: Cluster<ClusterableSignal>;
    members: SignalRecord[];
    now: Date;
    reason: string;
    detail: string;
    veracity?: ReturnType<typeof computeVeracity>;
    spentQuery?: boolean;
    corroborationSkipped?: boolean;
  }): Promise<ClusterVerdict> {
    return {
      ...(await this.adjudicator.quarantine(args)),
      spentQuery: args.spentQuery ?? false,
      corroborationSkipped: args.corroborationSkipped ?? false,
    };
  }

  /**
   * A cluster nobody looked at.
   *
   * Distinct from a cluster that was queried and found alone, which is why it
   * gets its own method and its own sentence. Both end in the same reason code,
   * because the contract's enum has no value for "not attempted" — and inventing
   * one would change a published contract to describe an implementation limit.
   */
  private async rejectUncorroborated(args: {
    orgId: string;
    cluster: Cluster<ClusterableSignal>;
    members: SignalRecord[];
    now: Date;
  }): Promise<ClusterVerdict> {
    return this.reject({
      ...args,
      reason: 'insufficient_independent_sources',
      detail: this.notAttemptedDetail(),
      corroborationSkipped: true,
    });
  }

  /** Why no query was sent. Two causes, and they are different statements. */
  private notAttemptedDetail(): string {
    return (
      'Corroboration was NOT ATTEMPTED for this cluster: ' +
      (this.corroborator.sourceFailed
        ? 'the corroboration source failed earlier in this run, so no query was sent.'
        : `the run's ${String(CORROBORATION_BUDGET)}-query budget was already spent.`) +
      ' This is not a finding that no corroboration exists — nobody looked. Re-run VERIFY to ' +
      'try again.'
    );
  }

  /**
   * Independence and veracity for one cluster, plus the rejection if it fails.
   *
   * Both thresholds are applied here rather than at the call site, so the
   * ordering — independence first, then the veracity floor — lives in one place.
   * The ordering matters: "only one source" is a more useful rejection reason
   * than "scored 0.31", and a cluster failing the first also fails the second.
   */
}
