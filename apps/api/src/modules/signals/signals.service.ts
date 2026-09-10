/**
 * The signals module's service: a facade over SENSE, VERIFY and the read side.
 *
 * ```
 * ingest    openFDA enforcement + openFDA shortages + GDELT   -> signals.ingest.ts
 *   -> cluster / corroborate / score / publish or quarantine  -> signals.verify.ts
 *   -> read stored signals, alerts and quarantine records     -> signals.queries.ts
 * ```
 *
 * Three files rather than one, because they have genuinely different
 * dependencies and failure modes: ingestion reaches three flaky external feeds,
 * verification decides what is true, and the read side touches neither the
 * network nor a clock. This file is the composition and nothing else.
 */

import type { GdeltClient, OpenFdaClient } from '@vitalink/connectors';

import type { CatalogService } from '@modules/catalog';
import type { GraphService } from '@modules/graph';

import { ingestAll, type IngestOutcome } from './signals.ingest';
import { createSignalQueries } from './signals.queries';
import type { SignalsRepository } from './signals.repository';
import { SignalVerifier, type VerifyOutcome } from './signals.verify';

export type { IngestOutcome } from './signals.ingest';
export type { VerifyOutcome } from './signals.verify';

export type SignalsDeps = {
  repository: SignalsRepository;
  openFda: OpenFdaClient;
  gdelt: GdeltClient;
  graph: GraphService;
  catalog: CatalogService;
  clock?: { now(): Date };
};

export class SignalsService {
  private readonly deps: SignalsDeps;
  private readonly clock: { now(): Date };
  private readonly verifier: SignalVerifier;
  private readonly queries: ReturnType<typeof createSignalQueries>;

  constructor(deps: SignalsDeps) {
    this.deps = deps;
    this.clock = deps.clock ?? { now: () => new Date() };
    this.verifier = new SignalVerifier({
      repository: deps.repository,
      gdelt: deps.gdelt,
      catalog: deps.catalog,
      clock: this.clock,
    });
    this.queries = createSignalQueries(
      () => deps.repository,
      () => deps.graph,
      () => this.clock,
    );
  }

  /** SENSE. See `signals.ingest.ts`. */
  async ingest(orgId: string): Promise<IngestOutcome> {
    const { gdelt, openFda, repository } = this.deps;
    return ingestAll({ repository, openFda, gdelt }, orgId);
  }

  /** VERIFY. See `signals.verify.ts`. */
  async verify(orgId: string): Promise<VerifyOutcome> {
    return this.verifier.verify(orgId);
  }

  listSignals = (orgId: string, limit: number) => this.queries.listSignals(orgId, limit);
  listAlerts = (orgId: string, limit: number) => this.queries.listAlerts(orgId, limit);
  getAlert = (orgId: string, id: string) => this.queries.getAlert(orgId, id);
  getAlertWithSignals = (orgId: string, id: string) => this.queries.getAlertWithSignals(orgId, id);
  listQuarantine = (orgId: string, limit: number) => this.queries.listQuarantine(orgId, limit);
  quarantineSummary = (orgId: string) => this.queries.quarantineSummary(orgId);
  nodeForAlert = (orgId: string, alertId: string) => this.queries.nodeForAlert(orgId, alertId);
}
