/**
 * The read side of the signals module.
 *
 * Reading a stored alert has nothing in common with producing one — no network,
 * no clock arithmetic, no thresholds — so the two live in separate files. Every
 * function here is a query with a page cap and an org scope, and nothing else.
 */

import { CLUSTER_WINDOW_DAYS, MAX_PAGE_SIZE, MS_PER_DAY } from '@config/constants';
import type { GraphService } from '@modules/graph';

import type {
  AlertRecord,
  QuarantineRecordEntity,
  SignalRecord,
  SignalsRepository,
} from './signals.repository';

export type SignalQueries = {
  listSignals(orgId: string, limit: number): Promise<SignalRecord[]>;
  listAlerts(orgId: string, limit: number): Promise<AlertRecord[]>;
  getAlert(orgId: string, id: string): Promise<AlertRecord | null>;
  getAlertWithSignals(
    orgId: string,
    id: string,
  ): Promise<{ alert: AlertRecord; signals: SignalRecord[] } | null>;
  listQuarantine(orgId: string, limit: number): Promise<QuarantineRecordEntity[]>;
  quarantineSummary(orgId: string): Promise<Record<string, number>>;
  nodeForAlert(orgId: string, alertId: string): Promise<string | null>;
};

/**
 * Built from thunks rather than values so the service can hand over its own
 * fields without the two files having to agree on a construction order.
 */
export function createSignalQueries(
  repository: () => SignalsRepository,
  graph: () => GraphService,
  clock: () => { now(): Date },
): SignalQueries {
  return {
    async listSignals(orgId: string, limit: number): Promise<SignalRecord[]> {
      const since = new Date(
        clock().now().getTime() - CLUSTER_WINDOW_DAYS * MS_PER_DAY,
      ).toISOString();
      return repository().findRecentSignals(orgId, since, Math.min(limit, MAX_PAGE_SIZE));
    },

    async listAlerts(orgId: string, limit: number): Promise<AlertRecord[]> {
      return repository().listAlerts(orgId, Math.min(limit, MAX_PAGE_SIZE));
    },

    async getAlert(orgId: string, id: string): Promise<AlertRecord | null> {
      return repository().findAlert(orgId, id);
    },

    /** An alert with the raw signals behind it, for the "which two sources?" view. */
    async getAlertWithSignals(
      orgId: string,
      id: string,
    ): Promise<{ alert: AlertRecord; signals: SignalRecord[] } | null> {
      const alert = await repository().findAlert(orgId, id);
      if (alert === null) return null;

      return { alert, signals: await repository().findSignalsByIds(orgId, alert.rawSignalIds) };
    },

    async listQuarantine(orgId: string, limit: number): Promise<QuarantineRecordEntity[]> {
      return repository().listQuarantine(orgId, Math.min(limit, MAX_PAGE_SIZE));
    },

    async quarantineSummary(orgId: string): Promise<Record<string, number>> {
      return repository().countQuarantineByReason(orgId);
    },

    /**
     * The graph node an alert resolved to, when it did.
     *
     * Exposed so the control tower can offer "run a cascade from this alert" —
     * which is the join between VERIFY and TRACE, and the reason resolution is
     * worth doing at all.
     */
    async nodeForAlert(orgId: string, alertId: string): Promise<string | null> {
      const alert = await repository().findAlert(orgId, alertId);
      if (alert === null || alert.resolvedNodeId === null) return null;

      // Confirm the node still exists: the graph is rebuilt from live data, so a
      // node an alert pinned to last week may be gone.
      const node = await graph().getNode(alert.resolvedNodeId);
      return node === null ? null : alert.resolvedNodeId;
    },
  };
}
