/**
 * One load of everything the control tower needs to describe its own state.
 *
 * ## Why the failures are data
 *
 * A `Promise.all` here would mean that one endpoint returning 403 blanks the
 * whole dashboard, which is both bad to use and dishonest: "we could not read
 * the carrier roster" and "there are no carriers" would render identically. So
 * each part settles on its own and a failure becomes a named entry in
 * `failures`, which the overview renders next to the figures it could not
 * produce.
 *
 * That is the same rule the rest of the system follows for numbers, applied to
 * the fetch layer: a gap is reported as a gap, with its reason.
 */

import {
  listAlerts,
  listCarriers,
  listCascades,
  listDrugs,
  listRecommendations,
  listScenarioRuns,
  listSignals,
  quarantineSummary,
  type AlertRow,
  type CarrierRow,
  type CascadeRow,
  type DrugRow,
  type RecommendationRow,
  type ScenarioRunRow,
  type SignalRow,
} from './queries';

/** `PAGE_SIZE_MAX` in the contracts package. A count that hits it is a floor. */
export const OVERVIEW_LIMIT = 200;

export type LoadFailure = { part: string; error: string };

export type Overview = {
  signals: SignalRow[];
  alerts: AlertRow[];
  quarantine: Record<string, number>;
  drugs: DrugRow[];
  cascades: CascadeRow[];
  carriers: CarrierRow[];
  recommendations: RecommendationRow[];
  runs: ScenarioRunRow[];
  failures: LoadFailure[];
};

type Part<T> = { data: T; failure: LoadFailure | null };

async function settle<T>(part: string, load: () => Promise<T>, empty: T): Promise<Part<T>> {
  try {
    return { data: await load(), failure: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'the request failed with no message';
    return { data: empty, failure: { part, error } };
  }
}

export async function loadOverview(): Promise<Overview> {
  const [signals, alerts, quarantine, drugs, cascades, carriers, recommendations, runs] =
    await Promise.all([
      settle('signals', () => listSignals(OVERVIEW_LIMIT), [] as SignalRow[]),
      settle('alerts', () => listAlerts(OVERVIEW_LIMIT), [] as AlertRow[]),
      settle('quarantine', quarantineSummary, {}),
      settle('catalogue', () => listDrugs(OVERVIEW_LIMIT), [] as DrugRow[]),
      settle('cascades', () => listCascades(OVERVIEW_LIMIT), [] as CascadeRow[]),
      settle('carriers', listCarriers, [] as CarrierRow[]),
      settle(
        'recommendations',
        () => listRecommendations(OVERVIEW_LIMIT),
        [] as RecommendationRow[],
      ),
      settle('scenario runs', () => listScenarioRuns(OVERVIEW_LIMIT), [] as ScenarioRunRow[]),
    ]);

  return {
    signals: signals.data,
    alerts: alerts.data,
    quarantine: quarantine.data,
    drugs: drugs.data,
    cascades: cascades.data,
    carriers: carriers.data,
    recommendations: recommendations.data,
    runs: runs.data,
    failures: [
      signals.failure,
      alerts.failure,
      quarantine.failure,
      drugs.failure,
      cascades.failure,
      carriers.failure,
      recommendations.failure,
      runs.failure,
    ].filter((one): one is LoadFailure => one !== null),
  };
}

/** Total quarantined records, across every reason. */
export function quarantinedTotal(summary: Record<string, number>): number {
  return Object.values(summary).reduce((total, count) => total + count, 0);
}

/** The reason that rejected the most stories, which is the finding worth naming. */
export function topQuarantineReason(
  summary: Record<string, number>,
): { reason: string; count: number } | null {
  const entries = Object.entries(summary);
  if (entries.length === 0) return null;

  const [reason, count] = entries.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  );
  return { reason, count };
}
