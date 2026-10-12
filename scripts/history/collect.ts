/** Research ingestion entry point: bounded HTTP, immutable source store, explicit failures. */
import { mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  CachedHttpClient,
  createMemoryCache,
  FdaArchiveClient,
  interpretArchiveCapture,
} from '@vitalink/connectors';

import { selectCaptures } from './domain/selection';
import { buildHistoryReport } from './report';
import { SnapshotStore, writeImmutable } from './snapshot-store';

const DEFAULT_BUDGET = 12;
const MAX_BUDGET = 96;
const CONSECUTIVE_FAILURE_LIMIT = 3;
export type CaptureAttempt = {
  timestamp: string;
  snapshotId: string | null;
  error: string | null;
  bodySha256: string | null;
};
function configuration() {
  const directory = resolve(
    process.argv[2] ?? `data/history/${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  const from = process.argv[3] ?? '2019-01';
  const to = process.argv[4] ?? new Date().toISOString().slice(0, 7);
  const budget = Number(process.argv[5] ?? DEFAULT_BUDGET);
  if (!Number.isInteger(budget) || budget < 1 || budget > MAX_BUDGET) {
    throw new Error('Budget must be 1–96 captures.');
  }
  selectCaptures([], from, to, budget);
  mkdirSync(directory, { recursive: true });
  if (readdirSync(directory).length > 0) throw new Error('Use a fresh empty collection directory.');
  return { directory, from, to, budget, reuse: process.argv[6] };
}
function monthEnd(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}
async function collectOne(
  client: FdaArchiveClient,
  store: SnapshotStore,
  capture: ReturnType<typeof selectCaptures>['selected'][number],
  reuse: SnapshotStore | null,
): Promise<CaptureAttempt> {
  let bodySha256: string | null = null;
  try {
    const available = reuse?.findCapture(capture.timestamp) ?? null;
    const saved =
      available !== null && JSON.stringify(available.capture) === JSON.stringify(capture)
        ? available
        : null;
    const response =
      saved === null
        ? await client.fetchCapture(capture)
        : {
            rawBody: saved.rawBody,
            data: saved.rawBody,
            provenance: saved.provenance,
            fromCache: true,
          };
    bodySha256 = store.putBody(response.rawBody);
    const snapshot = interpretArchiveCapture(capture, response);
    const snapshotId = store.put(snapshot, response.rawBody);
    console.log(
      `${capture.timestamp}: preserved ${String(snapshot.rowCount)} source rows${saved === null ? '' : ' (verified local reuse)'}`,
    );
    return { timestamp: capture.timestamp, snapshotId, bodySha256, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${capture.timestamp}: failure preserved — ${message}`);
    return { timestamp: capture.timestamp, snapshotId: null, bodySha256, error: message };
  }
}
async function collectSelected(
  client: FdaArchiveClient,
  store: SnapshotStore,
  selected: ReturnType<typeof selectCaptures>['selected'],
  reuse: SnapshotStore | null,
) {
  const attempts: CaptureAttempt[] = [];
  let consecutiveFailures = 0;
  for (const capture of selected) {
    if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
      attempts.push({
        timestamp: capture.timestamp,
        snapshotId: null,
        bodySha256: null,
        error: 'Not attempted: consecutive source failures stopped this run.',
      });
      continue;
    }
    const attempt = await collectOne(client, store, capture, reuse);
    attempts.push(attempt);
    consecutiveFailures = attempt.error === null ? 0 : consecutiveFailures + 1;
  }
  return attempts;
}
async function main(): Promise<void> {
  const config = configuration();
  const client = new FdaArchiveClient(new CachedHttpClient({ cache: createMemoryCache() }));
  const store = new SnapshotStore(config.directory);
  const index = await client.index(`${config.from.replace('-', '')}01`, monthEnd(config.to));
  writeImmutable(join(config.directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  const selection = selectCaptures(index.data, config.from, config.to, config.budget);
  console.log(
    `Indexed ${String(index.data.length)} captures; ${String(selection.availableMonths)} months; selecting ${String(selection.selected.length)}.`,
  );
  const reuse = config.reuse === undefined ? null : new SnapshotStore(resolve(config.reuse));
  const attempts = await collectSelected(client, store, selection.selected, reuse);
  const manifest = {
    schemaVersion: 1 as const,
    startedAt: index.provenance.fetched_at,
    completedAt: new Date().toISOString(),
    from: config.from,
    to: config.to,
    budget: config.budget,
    selection: 'Earliest indexed CSV capture per month, chronological budget.',
    indexTruncated: index.truncated,
    indexed: index.data,
    selected: selection.selected,
    attempts,
  };
  writeImmutable(join(config.directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  buildHistoryReport(config.directory);
  if (attempts.some((a) => a.snapshotId === null)) process.exitCode = 2;
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
