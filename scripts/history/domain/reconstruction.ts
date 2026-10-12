/** Observed presentation changes, with uncertainty preserved at observation boundaries. */
import type { HistoricalShortageRow, ShortageSnapshot } from '@vitalink/contracts';

const MS_PER_DAY = 86_400_000;
export type Observation = {
  capturedAt: string;
  snapshotId: string;
  sourceRows: number[];
  status: HistoricalShortageRow['status'] | 'Conflicting';
};
export type PresentationHistory = {
  key: string;
  genericName: string;
  companyName: string | null;
  presentation: string | null;
  observations: Observation[];
};
function observe(snapshot: ShortageSnapshot, rows: HistoricalShortageRow[]): Observation {
  const statuses = [...new Set(rows.map((r) => r.status))];
  return {
    capturedAt: snapshot.capture.capturedAt,
    snapshotId: `${snapshot.capture.timestamp}-${snapshot.bodySha256}`,
    sourceRows: rows.map((r) => r.sourceRow),
    status: statuses.length === 1 ? (statuses[0] ?? 'Unknown') : 'Conflicting',
  };
}
export function reconstructHistory(snapshots: ShortageSnapshot[]): PresentationHistory[] {
  const histories = new Map<string, PresentationHistory>();
  for (const snapshot of [...snapshots].sort((a, b) =>
    a.capture.timestamp.localeCompare(b.capture.timestamp),
  )) {
    const groups = new Map<string, HistoricalShortageRow[]>();
    for (const row of snapshot.rows) groups.set(row.key, [...(groups.get(row.key) ?? []), row]);
    for (const [key, rows] of groups) {
      const row = rows[0];
      if (row === undefined) continue;
      const history = histories.get(key) ?? {
        key,
        genericName: row.genericName,
        companyName: row.companyName,
        presentation: row.presentation,
        observations: [],
      };
      history.observations.push(observe(snapshot, rows));
      histories.set(key, history);
    }
  }
  return [...histories.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export function observedTransitions(history: PresentationHistory) {
  const changes = [];
  for (let i = 1; i < history.observations.length; i++) {
    const previous = history.observations[i - 1];
    const next = history.observations[i];
    if (previous === undefined || next === undefined || previous.status === next.status) continue;
    changes.push({
      key: history.key,
      from: previous.status,
      to: next.status,
      after: previous.capturedAt,
      by: next.capturedAt,
      gapDays: (Date.parse(next.capturedAt) - Date.parse(previous.capturedAt)) / MS_PER_DAY,
      interpretation: 'Observed status difference, not an exact event or resolution date.',
    });
  }
  return changes;
}
export function observationGaps(snapshots: ShortageSnapshot[]) {
  const dates = [...new Set(snapshots.map((s) => s.capture.capturedAt))].sort();
  return dates.slice(1).map((by, i) => ({
    after: dates[i] ?? by,
    by,
    gapDays: (Date.parse(by) - Date.parse(dates[i] ?? by)) / MS_PER_DAY,
  }));
}
