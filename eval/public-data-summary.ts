/** Coverage of a frozen mutable FDA snapshot; not a forecasting backtest. */
import { parseFdaDate, type ShortageRecord } from '@vitalink/connectors';

export type ShortageSnapshot = {
  records: ShortageRecord[];
  observedAt: string | null;
  reportedTotal: number | null;
  completeRetrieval: boolean;
};

function dateCoverage(records: ShortageRecord[], field: keyof ShortageRecord) {
  const values = records
    .map((row) => row[field])
    .filter((value): value is string => typeof value === 'string');
  const valid = values
    .map(parseFdaDate)
    .filter((value): value is string => value !== null)
    .sort();
  return {
    supplied: values.length,
    valid: valid.length,
    missing: records.length - values.length,
    invalid: values.length - valid.length,
    earliest: valid[0] ?? null,
    latest: valid.at(-1) ?? null,
  };
}

export function forecastingSummary(snapshot: ShortageSnapshot) {
  const statusCounts: Record<string, number> = {};
  for (const row of snapshot.records) {
    const status = row.status ?? 'UNKNOWN';
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }
  return {
    observedAt: snapshot.observedAt,
    retrieved: snapshot.records.length,
    distinctParsedRows: new Set(snapshot.records.map((row) => JSON.stringify(row))).size,
    retrievalCaveat:
      'Paged row count matches source metadata; this is not an atomic snapshot or proof of unique historical episodes.',
    reportedTotal: snapshot.reportedTotal,
    completeRetrieval: snapshot.completeRetrieval,
    genericNames: new Set(snapshot.records.map((row) => row.generic_name)).size,
    statusCounts,
    dates: Object.fromEntries(
      ['initial_posting_date', 'update_date', 'change_date', 'discontinued_date'].map((field) => [
        field,
        dateCoverage(snapshot.records, field as keyof ShortageRecord),
      ]),
    ),
    validFor: [
      'Dated present-day regulatory evidence',
      'Prospective observation of changes after this snapshot',
    ],
    notEstablished: [
      'A complete historical episode series or repeated-shortage dates',
      'Historical versions of predictors before shortage publication',
      'An eligible historical non-shortage medicine cohort',
      'Resolved duration: change_date is a change date, not an independently verified resolution date',
    ],
    predictionGate: 'NOT_READY_FOR_RETROSPECTIVE_FORECASTING',
    reason:
      'Even complete retrieval is a mutable present-day snapshot. Missing historical episodes are not negative outcomes.',
  };
}
