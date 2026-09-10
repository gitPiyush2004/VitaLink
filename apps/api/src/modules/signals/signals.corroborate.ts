/**
 * Corroboration: one targeted query per cluster, and the budget that bounds it.
 *
 * `excludeDomain` is the whole reason this is not circular. Without it a story
 * from thehindu.com would be "corroborated" by thehindu.com, and the
 * independence count would be a count of one outlet's own coverage.
 *
 * ## The per-run breaker is not an optimisation
 *
 * Once the source has rate-limited or refused us, every remaining cluster gets
 * the same answer — and each attempt costs four requests and about twenty
 * seconds of retries. Without the breaker, one 429 turned a VERIFY run over
 * forty clusters into a fifteen-minute wait ending in forty identical failures.
 *
 * The consequence is recorded rather than hidden: clusters after the first
 * failure are quarantined as "corroboration was not attempted", which is a
 * different statement from "no corroboration was found".
 */

import type { GdeltClient } from '@vitalink/connectors';

import { logger } from '@shared/logger';

import { corroborationQuery } from './domain/verify-helpers';
import type { AlertRecord, SignalRecord } from './signals.repository';

/** How many corroborating hits to consider per cluster. */
const CORROBORATION_LIMIT = 10;
/** GDELT's own maximum timespan for a targeted query, in days. */
const CORROBORATION_TIMESPAN_DAYS = 30;

/**
 * How many corroboration queries one run may spend.
 *
 * A real budget, not a safety valve. GDELT enforces one request every five
 * seconds and answers a 30-day query in about twenty, so a run over forty
 * clusters would take a quarter of an hour — and an operator who clicks Verify
 * and waits fifteen minutes will not click it again.
 *
 * The cap is load-bearing, which means it must be **visible**: clusters beyond
 * it are reported as not-attempted, never silently judged as if the query had
 * run and found nothing.
 */
export const CORROBORATION_BUDGET = 8;

export type CorroborationResult = {
  hits: AlertRecord['corroborations'];
  /** Whether a request was actually sent. Counts against the budget. */
  spentQuery: boolean;
  /** False when no query was sent for a cluster that needed one. */
  attempted: boolean;
};

/**
 * A corroborator with a per-run memory of whether its source is answering.
 *
 * Stateful on purpose, and the state is narrow: one boolean, reset per run by
 * constructing a new instance.
 */
export class Corroborator {
  private isDown = false;

  constructor(private readonly gdelt: GdeltClient) {}

  /** Whether the source has failed during this run. Drives the outcome note. */
  get sourceFailed(): boolean {
    return this.isDown;
  }

  /**
   * One targeted GDELT query per cluster, excluding the originating outlet.
   *
   * `excludeDomain` is the whole reason this is not circular. Without it a story
   * from thehindu.com would be "corroborated" by thehindu.com, and the
   * independence count would be a count of one outlet's own coverage.
   *
   * A failure returns no corroborations rather than throwing: an unreachable
   * GDELT means this cluster goes to quarantine for want of a second source,
   * which is the correct outcome and is exactly what the quarantine reason says.
   */
  async corroborate(
    lead: SignalRecord,
    members: SignalRecord[],
    now: Date,
  ): Promise<CorroborationResult> {
    const query = corroborationQuery(lead);
    // Nothing to search on. Counts as attempted — there is no query that could
    // have been asked — so it does not consume budget and is not deferred.
    if (query === null) return { hits: [], spentQuery: false, attempted: true };

    // The source already failed this run. Reported as not attempted, so the
    // quarantine reason says nobody looked rather than that nothing was found.
    if (this.isDown) return { hits: [], spentQuery: false, attempted: false };
    const originDomains = new Set(
      members.map((signal) => signal.domain).filter((domain): domain is string => domain !== null),
    );

    try {
      const response = await this.gdelt.searchArticles({
        query,
        timespan: `${String(CORROBORATION_TIMESPAN_DAYS)}d`,
        maxRecords: CORROBORATION_LIMIT,
        // GDELT accepts one exclusion, so the first origin domain is excluded
        // and any others are filtered below. Both paths are needed: the API
        // filter saves bandwidth, the local filter is what guarantees it.
        ...(originDomains.size > 0 ? { excludeDomain: [...originDomains][0] as string } : {}),
      });

      const fetchedAt = now.toISOString();
      return {
        spentQuery: true,
        attempted: true,
        hits: response.data
          .filter((article) => !originDomains.has(article.domain))
          .map((article) => ({
            source: 'gdelt_doc',
            url: article.url,
            independence_key: article.domain,
            published_at: null,
            query,
            fetched_at: fetchedAt,
          })),
      };
    } catch (error) {
      // A per-run circuit breaker, and it is not an optimisation. Once GDELT has
      // rate-limited or refused us, every remaining cluster will get the same
      // answer — and each attempt costs four requests and about twenty seconds
      // of retries. Without this, one 429 turned a VERIFY run over forty
      // clusters into a fifteen-minute wait that ended in forty identical
      // failures.
      //
      // The consequence is recorded rather than hidden: every cluster after the
      // first failure is quarantined as "corroboration was not attempted", which
      // is a different statement from "no corroboration was found".
      this.isDown = true;
      logger.warn(
        { err: error, cluster: lead.id },
        'corroboration source failed; skipping corroboration for the rest of this run',
      );
      return { hits: [], spentQuery: true, attempted: true };
    }
  }
}
