/** Semantic date checks are separate from calendar parsing and preserve printed values. */
import type { ShortageSnapshot } from '@vitalink/contracts';

const historicalFields = ['initialPostingDate', 'updateDate', 'changeDate'] as const;
export function historicalDateIssues(snapshots: ShortageSnapshot[]) {
  return snapshots.flatMap((snapshot) =>
    snapshot.rows.flatMap((row) =>
      historicalFields.flatMap((field) => {
        const value = row[field];
        if (value === null || value <= snapshot.capture.capturedAt.slice(0, 10)) return [];
        return [
          {
            snapshotId: `${snapshot.capture.timestamp}-${snapshot.bodySha256}`,
            sourceRow: row.sourceRow,
            key: row.key,
            genericName: row.genericName,
            field,
            value,
            capturedAt: snapshot.capture.capturedAt,
            issue:
              'Printed historical date falls after capture; do not use as a contemporaneous event/predictor date.',
          },
        ];
      }),
    ),
  );
}
