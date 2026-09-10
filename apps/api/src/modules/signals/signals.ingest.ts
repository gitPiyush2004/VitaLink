/**
 * SENSE: pulling the three public feeds and storing what they return.
 *
 * Split out of `signals.service.ts` because SENSE and VERIFY are genuinely two
 * jobs: this file reaches the network and writes rows, and knows nothing about
 * clustering, corroboration or veracity. The seam also means the slow, flaky
 * half can be re-run on its own without re-verifying anything.
 *
 * ## One source failing does not stop the others
 *
 * `Promise.allSettled`, and the failure is reported in `sourceFailures` rather
 * than logged and forgotten. A run that quietly ingested two of three sources
 * would understate independence for every cluster built from it — which is the
 * one error VERIFY cannot detect on its own, because a missing source looks
 * exactly like a source that had nothing to say.
 */

import type { GdeltClient, OpenFdaClient } from '@vitalink/connectors';
import type { Provenance } from '@vitalink/contracts';

import { logger } from '@shared/logger';

import {
  mapEnforcement,
  mapGdeltArticle,
  mapShortage,
  type MapResult,
} from './domain/ingest-mappers';
import type { SignalsRepository, SignalUpsertInput } from './signals.repository';

/** How many records to pull per source per run. */
const PER_SOURCE_LIMIT = 50;
/** How far back a GDELT query reaches. Their maximum for a single call. */
const GDELT_TIMESPAN_DAYS = 30;

export type IngestOutcome = {
  /** Per source: how many records came back, how many became signals. */
  perSource: { source: string; fetched: number; stored: number; skipped: string[] }[];
  signalsStored: number;
  /** Non-empty when a source could not be reached. Never silently swallowed. */
  sourceFailures: { source: string; error: string }[];
};

export type IngestDeps = {
  repository: SignalsRepository;
  openFda: OpenFdaClient;
  gdelt: GdeltClient;
};

/**
 * SENSE: pull every source, map, store.
 *
 * One source failing does not stop the others — `Promise.allSettled`, and the
 * failure is reported in `sourceFailures` rather than logged and forgotten. A
 * run that silently ingested two of three sources would understate
 * independence for every cluster in it.
 */
export async function ingestAll(deps: IngestDeps, orgId: string): Promise<IngestOutcome> {
  const settled = await Promise.allSettled([
    ingestEnforcement(deps.openFda),
    ingestShortages(deps.openFda),
    ingestGdelt(deps.gdelt),
  ]);

  const perSource: IngestOutcome['perSource'] = [];
  const sourceFailures: IngestOutcome['sourceFailures'] = [];
  const signals: SignalUpsertInput[] = [];

  const names = ['openfda_enforcement', 'openfda_shortages', 'gdelt_doc'];
  settled.forEach((outcome, index) => {
    const source = names[index] ?? 'unknown';
    if (outcome.status === 'rejected') {
      sourceFailures.push({
        source,
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
      return;
    }

    const { results, fetched } = outcome.value;
    const stored = results.filter((one) => one.kind === 'signal');
    signals.push(...stored.map((one) => (one as { signal: SignalUpsertInput }).signal));

    perSource.push({
      source,
      fetched,
      stored: stored.length,
      skipped: results
        .filter((one) => one.kind === 'skipped')
        .map((one) => (one as { reason: string }).reason),
    });
  });

  const signalsStored = await deps.repository.saveSignals(orgId, signals);

  if (sourceFailures.length > 0) {
    logger.warn({ sourceFailures }, 'some SENSE sources were unreachable this run');
  }

  return { perSource, signalsStored, sourceFailures };
}

/** Class I-III drug recalls, newest first. */
async function ingestEnforcement(
  openFda: OpenFdaClient,
): Promise<{ results: MapResult[]; fetched: number }> {
  const response = await openFda.searchEnforcement({
    // Every classification, not just Class I: a Class II recall of a
    // sole-source injectable can matter more than a Class I of something with
    // forty makers, and that comparison is the cascade's job rather than a
    // filter's.
    search: 'status:"Ongoing"',
    limit: PER_SOURCE_LIMIT,
    sort: 'report_date:desc',
  });

  const provenance = provenanceOf(response.provenance);
  return {
    fetched: response.data.length,
    results: response.data.map((report) => mapEnforcement(report, provenance)),
  };
}

/** Current drug shortages. Resolved ones are filtered by the query itself. */
async function ingestShortages(
  openFda: OpenFdaClient,
): Promise<{ results: MapResult[]; fetched: number }> {
  const response = await openFda.searchShortages({
    // Filtered here rather than by mapping `status` onto a severity: a
    // resolved shortage is not a low-severity disruption, it is not a
    // disruption. See `extractFromShortage`.
    search: 'status:"Current"',
    limit: PER_SOURCE_LIMIT,
  });

  const provenance = provenanceOf(response.provenance);
  return {
    fetched: response.data.length,
    results: response.data.map((record) => mapShortage(record, provenance)),
  };
}

/**
 * Pharmaceutical supply news.
 *
 * The query is broad on purpose. Narrowing it to "drug shortage India" would
 * return almost nothing and would bias the corpus towards what we already
 * expect; the relevance filter in `extractFromHeadline` does the narrowing
 * afterwards, where its decisions are recorded per signal and reviewable.
 */
async function ingestGdelt(gdelt: GdeltClient): Promise<{ results: MapResult[]; fetched: number }> {
  const response = await gdelt.searchArticles({
    query:
      '("drug shortage" OR "drug recall" OR "pharmaceutical plant" OR "api plant" OR ' +
      '"medicine shortage" OR "pharma unit") sourcelang:english',
    timespan: `${String(GDELT_TIMESPAN_DAYS)}d`,
    maxRecords: PER_SOURCE_LIMIT,
  });

  const provenance = provenanceOf(response.provenance);
  return {
    fetched: response.data.length,
    results: response.data.map((article) => mapGdeltArticle(article, provenance)),
  };
}

/** The connector's provenance, unchanged. Never re-attributed. */
function provenanceOf(provenance: Provenance): Provenance {
  return provenance;
}
