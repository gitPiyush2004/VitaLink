import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseArchiveCsv } from '@vitalink/connectors';
import type { ShortageSnapshot } from '@vitalink/contracts';

import { historicalDateIssues } from '../domain/quality';
import { observedTransitions, reconstructHistory } from '../domain/reconstruction';
import { monthsBetween, selectCaptures } from '../domain/selection';
import { buildHistoryReport } from '../report';
import { sha256, SnapshotStore, writeImmutable } from '../snapshot-store';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'vitalink-history-'));
  folders.push(path);
  return path;
}
function snapshot(timestamp = '20191020223457', status = 'Current') {
  const rawBody = `Generic Name,Company Name,Presentation,Status,Initial Posting Date\nDrug,Company,Tablet,${status},10/01/2019`;
  const parsed = parseArchiveCsv(rawBody);
  const value: ShortageSnapshot = {
    schemaVersion: 1,
    parser: parsed.parser,
    capture: {
      timestamp,
      capturedAt: `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T22:34:57.000Z`,
      originalUrl: 'https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm',
      mimeType: 'text/csv',
      archiveDigest: 'digest',
    },
    provenance: {
      source_name: 'FDA via Archive',
      source_url: `https://web.archive.org/web/${timestamp}id_/https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm`,
      query: 'unit test',
      fetched_at: '2026-10-12T00:00:00.000Z',
    },
    bodySha256: sha256(rawBody),
    rows: parsed.rows,
    rowCount: parsed.rows.length,
  };
  return { value, rawBody };
}
describe('immutable snapshot storage', () => {
  it('persists original contents and reloads the same captured observation', () => {
    const store = new SnapshotStore(directory());
    const data = snapshot();
    const id = store.put(data.value, data.rawBody);
    expect(store.load(id)).toEqual(data.value);
    expect(readFileSync(join(store.root, 'bodies', data.value.bodySha256 + '.csv'), 'utf8')).toBe(
      data.rawBody,
    );
    expect(
      store.put(
        {
          ...data.value,
          provenance: { ...data.value.provenance, fetched_at: '2026-10-13T00:00:00.000Z' },
        },
        data.rawBody,
      ),
    ).toBe(id);
    expect(store.load(id).provenance.fetched_at).toBe('2026-10-12T00:00:00.000Z');
  });
  it('refuses changed immutable content, invalid hashes and path traversal', () => {
    const path = join(directory(), 'immutable.json');
    writeImmutable(path, 'original');
    expect(() => writeImmutable(path, 'changed')).toThrow();
    expect(readFileSync(path, 'utf8')).toBe('original');
    const store = new SnapshotStore(directory());
    const data = snapshot();
    expect(() => store.put(data.value, 'wrong body')).toThrow('hash');
    expect(() => store.load('../../outside')).toThrow('identifier');
  });
  it('detects altered normalized metadata even when the original body still hashes correctly', () => {
    const store = new SnapshotStore(directory());
    const data = snapshot();
    const id = store.put(data.value, data.rawBody);
    const path = join(store.root, 'snapshots', `${id}.json`);
    chmodSync(path, 0o644);
    writeFileSync(
      path,
      JSON.stringify({
        ...data.value,
        rows: data.value.rows.map((r) => ({ ...r, genericName: 'Invented' })),
      }),
    );
    expect(() => store.load(id)).toThrow('interpretation');
  });
  it('detects source-body tampering during replay', () => {
    const store = new SnapshotStore(directory());
    const data = snapshot();
    const id = store.put(data.value, data.rawBody);
    const path = join(store.root, 'bodies', data.value.bodySha256 + '.csv');
    chmodSync(path, 0o644);
    writeFileSync(path, 'modified');
    expect(() => store.load(id)).toThrow('integrity');
  });
});
describe('historical observations and coverage', () => {
  it('flags a valid calendar date that cannot be historical at capture time without changing the source', () => {
    const first = snapshot().value;
    const row = {
      ...first.rows[0]!,
      initialPostingDate: '2108-12-03',
      discontinuedDate: '2020-01-01',
    };
    const issues = historicalDateIssues([{ ...first, rows: [row] }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: 'initialPostingDate', value: '2108-12-03' });
    expect(row.initialPostingDate).toBe('2108-12-03');
  });
  it('replays a collection deterministically and exposes a missing month instead of assigning an outcome', () => {
    const root = directory();
    const store = new SnapshotStore(root);
    const first = snapshot();
    const last = snapshot('20191220223457', 'Resolved');
    const attempts = [first, last].map((data) => ({
      timestamp: data.value.capture.timestamp,
      snapshotId: store.put(data.value, data.rawBody),
      error: null,
      bodySha256: data.value.bodySha256,
    }));
    writeImmutable(
      join(root, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        from: '2019-10',
        to: '2019-12',
        indexTruncated: false,
        indexed: [first.value.capture, last.value.capture],
        selected: [first.value.capture, last.value.capture],
        attempts,
      }),
    );
    buildHistoryReport(root);
    const path = join(root, 'derived', 'v1', 'coverage.json');
    const before = readFileSync(path, 'utf8');
    buildHistoryReport(root);
    expect(readFileSync(path, 'utf8')).toBe(before);
    const report = JSON.parse(before) as {
      months: { month: string; status: string }[];
      observedStatusDifferences: number;
    };
    expect(report.months[1]).toEqual({
      month: '2019-11',
      status: 'NO_CAPTURE_IN_RETRIEVED_INDEX',
      indexedCaptures: 0,
      error: null,
    });
    expect(report.observedStatusDifferences).toBe(1);
  });
  it('selects the earliest available capture in each month and discloses the budget', () => {
    const a = snapshot().value.capture;
    const b = snapshot('20191021223457').value.capture;
    const c = snapshot('20191220223457').value.capture;
    const selected = selectCaptures([b, c, a], '2019-10', '2019-12', 1);
    expect(selected.months).toEqual(['2019-10', '2019-11', '2019-12']);
    expect(selected.availableMonths).toBe(2);
    expect(selected.selected).toEqual([a]);
    expect(() => monthsBetween('2019-13', '2020-01')).toThrow();
  });
  it('does not infer resolution from disappearance and bounds observed status changes by capture dates', () => {
    const first = snapshot().value;
    const absent = { ...snapshot('20191120223457').value, rows: [], rowCount: 0 };
    const last = snapshot('20191220223457', 'Resolved').value;
    const histories = reconstructHistory([last, absent, first]);
    expect(histories[0]?.observations).toHaveLength(2);
    const changes = observedTransitions(histories[0]!);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      from: 'Current',
      to: 'Resolved',
      after: first.capture.capturedAt,
      by: last.capture.capturedAt,
    });
    expect(changes[0]?.interpretation).toContain('not an exact');
    expect(observedTransitions(reconstructHistory([first, absent])[0]!)).toEqual([]);
  });
  it('retains conflicting same-identity rows without arbitrarily choosing one status', () => {
    const first = snapshot().value;
    const resolved = { ...snapshot(undefined, 'Resolved').value.rows[0]!, sourceRow: 2 };
    const history = reconstructHistory([
      { ...first, rows: [...first.rows, resolved], rowCount: 2 },
    ]);
    expect(history[0]?.observations[0]).toMatchObject({
      status: 'Conflicting',
      sourceRows: [1, 2],
    });
  });
});
