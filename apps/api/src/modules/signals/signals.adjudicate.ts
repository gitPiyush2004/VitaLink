/**
 * Scoring a cluster, and writing the result either way.
 *
 * The two thresholds and the two writes, in one place. Extracted from
 * `signals.verify.ts` so that file is the control flow — relevance, then
 * corroboration, then this — and this one is the judgement.
 *
 * ## Ordering the two thresholds
 *
 * Independence is checked before the veracity floor, and not only because a
 * cluster failing the first also fails the second. "Only one source reported
 * this" is a reason a reader can act on; "scored 0.31" is a number they cannot
 * argue with. The more useful rejection wins the race.
 *
 * ## A quarantine record is not a failure log
 *
 * "Two independent sources could not be found for this recall" is a finding
 * about the world. A system that discarded it would be hiding the most
 * interesting thing it knows: how much of what it sees it cannot corroborate.
 */

import { randomUUID } from 'node:crypto';

import { MIN_INDEPENDENT_SOURCES, MIN_VERACITY_TO_PUBLISH } from '@config/constants';

import { describeCluster, type Cluster, type Clusterable } from './domain/cluster';
import { countIndependentSources } from './domain/independence';
import { resolveToNode, type NodeCandidate } from './domain/resolve';
import { computeVeracity, credibilityClass, type CredibilityClass } from './domain/veracity';
import { pickLead, toObservations, VERACITY_DECIMALS } from './domain/verify-helpers';
import type { AlertRecord, SignalRecord, SignalsRepository } from './signals.repository';

/** A signal in the shape the clusterer needs, carrying the record it came from. */
export type ClusterableSignal = Clusterable & { signal: SignalRecord };

export type ClusterScore = {
  independence: ReturnType<typeof countIndependentSources>;
  veracity: ReturnType<typeof computeVeracity>;
  /** Null when the cluster clears both thresholds. */
  rejection: { reason: string; detail: string } | null;
};

export class ClusterAdjudicator {
  constructor(private readonly repository: SignalsRepository) {}

  scoreCluster(
    members: SignalRecord[],
    corroborations: AlertRecord['corroborations'],
    now: Date,
  ): ClusterScore {
    const independence = countIndependentSources(toObservations(members, corroborations));
    const newest = members
      .map((signal) => signal.publishedAt)
      .reduce((latest, current) => (Date.parse(current) > Date.parse(latest) ? current : latest));

    const veracity = computeVeracity({
      independentSourceCount: independence.count,
      credibilityClasses: independence.keys.map((key): CredibilityClass =>
        credibilityClass(key, true),
      ),
      newestPublishedAt: newest,
      independenceKeys: independence.keys,
      now,
    });

    if (veracity.blockedBy !== null) {
      return {
        independence,
        veracity,
        rejection: {
          reason: 'insufficient_independent_sources',
          detail: `${independence.explanation} At least ${String(MIN_INDEPENDENT_SOURCES)} are required.`,
        },
      };
    }

    if (veracity.quantity.value < MIN_VERACITY_TO_PUBLISH) {
      return {
        independence,
        veracity,
        rejection: {
          reason: 'below_veracity_threshold',
          detail:
            `Veracity ${veracity.quantity.value.toFixed(VERACITY_DECIMALS)} is below the ` +
            `${String(MIN_VERACITY_TO_PUBLISH)} publication threshold. ${independence.explanation}`,
        },
      };
    }

    return { independence, veracity, rejection: null };
  }

  /** Writes the alert. Reached only once every threshold has been cleared. */
  async publish(args: {
    orgId: string;
    cluster: Cluster<ClusterableSignal>;
    members: SignalRecord[];
    lead: SignalRecord;
    nodes: NodeCandidate[];
    corroborations: AlertRecord['corroborations'];
    independence: ReturnType<typeof countIndependentSources>;
    veracity: ReturnType<typeof computeVeracity>;
  }): Promise<AlertRecord> {
    const { independence, lead, members, veracity } = args;
    const resolution = resolveToNode(lead, args.nodes);

    return this.repository.saveAlert(args.orgId, {
      id: `alert-${randomUUID()}`,
      rawSignalIds: members.map((signal) => signal.id),
      clusterId: args.cluster.id,
      category: lead.category,
      manufacturer: lead.manufacturer,
      drugOrIngredient: lead.drugOrIngredient,
      locationCity: lead.locationCity,
      locationCountry: lead.locationCountry,
      // The highest severity in the cluster, not the lead's. A Class I recall
      // merged with three mild headlines is a Class I event.
      severity: Math.max(...members.map((signal) => signal.severity)),
      insight: lead.insight,
      resolvedNodeId: resolution.nodeId,
      resolutionBasis: resolution.basis,
      corroborations: args.corroborations,
      independentSourceCount: independence.count,
      veracity: veracity.quantity,
      verified: true,
      clusterBasis: `${describeCluster(args.cluster)} ${independence.explanation}`,
      arm: 'SINGLE_CALL_BASELINE',
      firstSeenAt: members
        .map((signal) => signal.publishedAt)
        .reduce((first, current) => (Date.parse(current) < Date.parse(first) ? current : first)),
      provenance: veracity.quantity.provenance,
    });
  }

  /** Writes a quarantine record. Not a failure log — see the file header. */
  async quarantine(args: {
    orgId: string;
    cluster: Cluster<ClusterableSignal>;
    members: SignalRecord[];
    now: Date;
    reason: string;
    detail: string;
    veracity?: ReturnType<typeof computeVeracity>;
  }): Promise<{ kind: 'quarantined'; reason: string }> {
    const { cluster, members, now, orgId } = args;
    const input = args;
    const lead = pickLead(members);
    const veracity =
      input.veracity ??
      computeVeracity({
        independentSourceCount: 0,
        credibilityClasses: [],
        newestPublishedAt: lead.publishedAt,
        independenceKeys: [],
        now,
      });

    await this.repository.saveQuarantine(orgId, {
      id: `quarantine-${randomUUID()}`,
      clusterId: cluster.id,
      rawSignalIds: members.map((signal) => signal.id),
      reason: input.reason,
      detail: input.detail,
      extraction: {
        category: lead.category,
        manufacturer: lead.manufacturer,
        drug_or_ingredient: lead.drugOrIngredient,
        location_city: lead.locationCity,
        location_country: lead.locationCountry,
        severity_1_5: lead.severity,
        insight: lead.insight,
        is_pharma_supply_relevant: lead.isPharmaSupplyRelevant,
      },
      independentSourceCount: 0,
      veracity: veracity.quantity,
      arm: 'SINGLE_CALL_BASELINE',
    });

    return { kind: 'quarantined', reason: input.reason };
  }
}
