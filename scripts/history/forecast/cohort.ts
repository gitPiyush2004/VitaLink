/** All Current-origin decisions remain in the ledger, including unknown future outcomes. */
import type { HistoricalShortageRow, ShortageSnapshot } from '@vitalink/contracts';

import { ageBand, persistenceTask, phaseFor, type Phase } from './task';

const MS_PER_DAY = 86_400_000;
type Group = { rows: HistoricalShortageRow[]; status: string; datesUsable: boolean };
export type Decision = {
  id: string;
  key: string;
  genericName: string;
  originAt: string;
  targetAt: string | null;
  originSnapshotId: string;
  targetSnapshotId: string | null;
  originSourceRows: number[];
  targetSourceRows: number[];
  gapDays: number | null;
  phase: Phase;
  observedCurrentAgeDays: number;
  ageBand: string;
  label: 0 | 1 | null;
  exclusion: string | null;
};
export function snapshotId(snapshot: ShortageSnapshot): string {
  return `${snapshot.capture.timestamp}-${snapshot.bodySha256}`;
}
function datesUsable(row: HistoricalShortageRow, capturedAt: string): boolean {
  if (row.dateIssues.length > 0) return false;
  return [row.initialPostingDate, row.updateDate, row.changeDate].every(
    (date) => date === null || date <= capturedAt.slice(0, 10),
  );
}
function groups(snapshot: ShortageSnapshot): Map<string, Group> {
  const result = new Map<string, Group>();
  for (const row of snapshot.rows) {
    const group = result.get(row.key) ?? { rows: [], status: row.status, datesUsable: true };
    if (group.status !== row.status) group.status = 'Conflicting';
    group.datesUsable = group.datesUsable && datesUsable(row, snapshot.capture.capturedAt);
    group.rows.push(row);
    result.set(row.key, group);
  }
  return result;
}
function outcome(origin: Group, target: Group | undefined, gapDays: number | null) {
  if (origin.status !== 'Current') return { label: null, exclusion: 'ORIGIN_CONFLICTING' } as const;
  if (!origin.datesUsable) return { label: null, exclusion: 'ORIGIN_DATE_UNUSABLE' } as const;
  if (gapDays === null) return { label: null, exclusion: 'NO_LATER_CAPTURE' } as const;
  if (gapDays < persistenceTask.minimumGapDays || gapDays > persistenceTask.maximumGapDays) {
    return { label: null, exclusion: 'HORIZON_OUTSIDE_WINDOW' } as const;
  }
  if (target === undefined) return { label: null, exclusion: 'TARGET_ABSENT' } as const;
  return targetOutcome(target);
}
function targetOutcome(target: Group) {
  if (!target.datesUsable) return { label: null, exclusion: 'TARGET_DATE_UNUSABLE' } as const;
  if (target.status === 'Current') return { label: 1, exclusion: null } as const;
  if (target.status === 'Resolved') return { label: 0, exclusion: null } as const;
  return { label: null, exclusion: `TARGET_${target.status.toUpperCase().replaceAll(' ', '_')}` };
}
type Run = { since: string };
function currentRuns(current: Map<string, Group>, previous: Map<string, Run>, at: string) {
  const result = new Map<string, Run>();
  for (const [key, group] of current) {
    if (group.status !== 'Current' || !group.datesUsable) continue;
    result.set(key, previous.get(key) ?? { since: at });
  }
  return result;
}
export function buildCohort(input: ShortageSnapshot[]): Decision[] {
  const snapshots = [...input].sort((a, b) =>
    a.capture.timestamp.localeCompare(b.capture.timestamp),
  );
  if (new Set(snapshots.map((s) => s.capture.capturedAt)).size !== snapshots.length) {
    throw new Error('Duplicate capture times cannot form a temporal cohort.');
  }
  const grouped = snapshots.map(groups);
  let runs = new Map<string, Run>();
  const decisions: Decision[] = [];
  for (const [index, origin] of snapshots.entries()) {
    const originAt = origin.capture.capturedAt;
    const previousAt = snapshots[index - 1]?.capture.capturedAt;
    if (
      previousAt !== undefined &&
      daysBetween(previousAt, originAt) > persistenceTask.maximumGapDays
    ) {
      runs = new Map();
    }
    const current = grouped[index] ?? new Map<string, Group>();
    runs = currentRuns(current, runs, originAt);
    decisions.push(
      ...decisionsAt(origin, snapshots[index + 1], { current, future: grouped[index + 1], runs }),
    );
  }
  return decisions;
}
function decisionsAt(
  origin: ShortageSnapshot,
  target: ShortageSnapshot | undefined,
  context: {
    current: Map<string, Group>;
    future: Map<string, Group> | undefined;
    runs: Map<string, Run>;
  },
): Decision[] {
  const originAt = origin.capture.capturedAt;
  const targetAt = target?.capture.capturedAt ?? null;
  const gapDays = targetAt === null ? null : daysBetween(originAt, targetAt);
  return [...context.current.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, group]) => {
      if (!group.rows.some((row) => row.status === 'Current')) return [];
      const next = context.future?.get(key);
      const ageDays = daysBetween(context.runs.get(key)?.since ?? originAt, originAt);
      return [
        {
          id: `${snapshotId(origin)}:${key}`,
          key,
          genericName: group.rows[0]?.genericName ?? '',
          originAt,
          targetAt,
          originSnapshotId: snapshotId(origin),
          targetSnapshotId: target === undefined ? null : snapshotId(target),
          originSourceRows: group.rows.map((row) => row.sourceRow),
          targetSourceRows: next?.rows.map((row) => row.sourceRow) ?? [],
          gapDays,
          phase: phaseFor(originAt, targetAt),
          observedCurrentAgeDays: ageDays,
          ageBand: ageBand(ageDays),
          ...outcome(group, next, gapDays),
        },
      ];
    });
}
function daysBetween(after: string, by: string): number {
  return (Date.parse(by) - Date.parse(after)) / MS_PER_DAY;
}
