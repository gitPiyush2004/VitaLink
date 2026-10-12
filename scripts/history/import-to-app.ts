/** Explicit import of verified original evidence; never a fabricated runtime fallback. */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createArchiveRepository } from '../../apps/api/src/modules/operations/operations.archive.repository';
import { connectMongo, disconnectMongo } from '../../apps/api/src/shared/db/mongo';

import { buildHistoryReport, manifestSchema } from './report';
import { SnapshotStore } from './snapshot-store';

async function main(): Promise<void> {
  const directory = resolve(process.argv[2] ?? '');
  if (!process.argv[2]) {
    throw new Error('Supply the original verified archive collection directory.');
  }
  buildHistoryReport(directory);
  const manifest = manifestSchema.parse(
    JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')),
  );
  const store = new SnapshotStore(directory);
  const snapshots = manifest.attempts.flatMap((attempt) => {
    if (attempt.snapshotId === null) return [];
    const snapshot = store.load(attempt.snapshotId);
    if (
      attempt.timestamp !== snapshot.capture.timestamp ||
      attempt.bodySha256 !== snapshot.bodySha256 ||
      JSON.stringify(manifest.selected.find((s) => s.timestamp === attempt.timestamp)) !==
        JSON.stringify(snapshot.capture)
    ) {
      throw new Error('Manifest does not identify the validated source snapshot.');
    }
    return [snapshot];
  });
  await connectMongo();
  try {
    let inserted = 0;
    const repository = createArchiveRepository();
    for (const snapshot of snapshots) inserted += Number(await repository.importSnapshot(snapshot));
    console.log(
      `Verified FDA archive import: ${String(snapshots.length)} snapshots, ${String(inserted)} newly retained. Missing/rejected periods remain unknown.`,
    );
  } finally {
    await disconnectMongo();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
