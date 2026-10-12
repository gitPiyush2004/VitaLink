/** Replay an immutable collection into derived history, without network access. */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { archiveCaptureSchema } from '@vitalink/contracts';

import { historicalDateIssues } from './domain/quality';
import { observationGaps, observedTransitions, reconstructHistory } from './domain/reconstruction';
import { monthsBetween } from './domain/selection';
import { sha256, SnapshotStore, writeImmutable } from './snapshot-store';

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  from: z.string(),
  to: z.string(),
  indexTruncated: z.boolean(),
  indexed: z.array(archiveCaptureSchema),
  selected: z.array(archiveCaptureSchema),
  attempts: z.array(
    z.object({
      timestamp: z.string().regex(/^\d{14}$/),
      snapshotId: z.string().nullable(),
      error: z.string().nullable(),
      bodySha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable()
        .default(null),
    }),
  ),
});
export function buildHistoryReport(directory: string): void {
  const manifestText = readFileSync(join(directory, 'manifest.json'), 'utf8');
  const manifest = manifestSchema.parse(JSON.parse(manifestText));
  const store = new SnapshotStore(directory);
  const snapshots = manifest.attempts.flatMap((a) =>
    a.snapshotId === null ? [] : [store.load(a.snapshotId)],
  );
  for (const attempt of manifest.attempts) {
    if (
      attempt.bodySha256 !== null &&
      sha256(readFileSync(join(directory, 'bodies', `${attempt.bodySha256}.csv`), 'utf8')) !==
        attempt.bodySha256
    ) {
      throw new Error('Failed-attempt source body integrity check failed.');
    }
  }
  const histories = reconstructHistory(snapshots);
  const transitions = histories.flatMap(observedTransitions);
  const gaps = observationGaps(snapshots);
  const dateIssues = historicalDateIssues(snapshots);
  const reportDirectory = join(directory, 'derived', 'v1');
  mkdirSync(reportDirectory, { recursive: true });
  const months = monthsBetween(manifest.from, manifest.to).map((month) => {
    const indexed = manifest.indexed.filter((c) => c.capturedAt.startsWith(month)).length;
    const selected = manifest.selected.find((c) => c.capturedAt.startsWith(month));
    const attempt = manifest.attempts.find((a) => a.timestamp === selected?.timestamp);
    return {
      month,
      indexedCaptures: indexed,
      status: monthStatus(indexed, attempt?.snapshotId, attempt?.error),
      error: attempt?.error ?? null,
    };
  });
  const report = {
    schemaVersion: 1,
    manifestSha256: sha256(manifestText),
    selectedSnapshots: manifest.selected.length,
    collectedSnapshots: snapshots.length,
    sourceRows: snapshots.reduce((count, s) => count + s.rows.length, 0),
    presentationKeys: histories.length,
    observedStatusDifferences: transitions.length,
    conflictingObservations: histories
      .flatMap((h) => h.observations)
      .filter((o) => o.status === 'Conflicting').length,
    unreadableDateValues: snapshots.reduce(
      (count, s) => count + s.rows.reduce((n, r) => n + r.dateIssues.length, 0),
      0,
    ),
    snapshotsWithQuoteRepairs: snapshots.filter((s) => s.parser.mode !== 'strict').length,
    postCaptureDateRows: new Set(
      dateIssues.map((issue) => `${issue.snapshotId}:${String(issue.sourceRow)}`),
    ).size,
    indexTruncated: manifest.indexTruncated,
    months,
    gaps,
    maximumObservationGapDays: gaps.length === 0 ? null : Math.max(...gaps.map((g) => g.gapDays)),
    predictionGate: 'OUTCOME_AND_COHORT_DEFINITION_REQUIRED',
    limitations: [
      'Only the exact legacy FDA CSV URL is indexed. No indexed capture is not proof that no shortage occurred.',
      'One capture per available month; coverage is irregular and the index or request budget can be incomplete.',
      'Presentation keys are normalized printed name/company/presentation associations, not stable clinical identifiers.',
      'First observed presence is not an exact onset. Disappearance is not resolution and never a negative label.',
      'Status differences are observed across intervals, not verified episode boundaries.',
      'Printed future historical dates are flagged and must be excluded or separately adjudicated before defining forecast features/outcomes.',
      'These retained shortage presentations do not supply an eligible historical non-shortage product universe.',
    ],
  };
  writeImmutable(join(reportDirectory, 'history.json'), JSON.stringify(histories, null, 2) + '\n');
  writeImmutable(
    join(reportDirectory, 'transitions.json'),
    JSON.stringify(transitions, null, 2) + '\n',
  );
  writeImmutable(join(reportDirectory, 'coverage.json'), JSON.stringify(report, null, 2) + '\n');
  writeImmutable(
    join(reportDirectory, 'date-quality-issues.json'),
    JSON.stringify(dateIssues, null, 2) + '\n',
  );
  console.log(
    `History: ${String(snapshots.length)} snapshots, ${String(histories.length)} printed presentation keys. Forecast gate: ${report.predictionGate}.`,
  );
}
function monthStatus(
  indexed: number,
  snapshotId: string | null | undefined,
  error: string | null | undefined,
): string {
  if (indexed === 0) return 'NO_CAPTURE_IN_RETRIEVED_INDEX';
  if (snapshotId !== undefined && snapshotId !== null) return 'COLLECTED';
  if (error !== undefined && error !== null) return 'FAILED_OR_NOT_ATTEMPTED';
  return 'NOT_SELECTED_BY_BUDGET';
}
