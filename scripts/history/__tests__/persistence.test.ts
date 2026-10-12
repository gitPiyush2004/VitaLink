import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { archiveTimestampToIso, parseArchiveCsv } from '@vitalink/connectors';
import type { ShortageSnapshot } from '@vitalink/contracts';

import { fitBaselines, scoreHoldout, type ScoredDecision } from '../forecast/baselines';
import { buildCohort, type Decision } from '../forecast/cohort';
import { evaluatePersistence } from '../forecast/evaluate';
import { measure } from '../forecast/metrics';
import { ageBand, phaseFor } from '../forecast/task';
import { sha256, SnapshotStore, writeImmutable } from '../snapshot-store';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'vitalink-persistence-'));
  directories.push(directory);
  return directory;
}
function source(timestamp: string, records = ['Drug,Company,Tablet,Current,01/01/2019']) {
  const rawBody =
    'Generic Name,Company Name,Presentation,Status,Initial Posting Date\n' + records.join('\n');
  const parsed = parseArchiveCsv(rawBody);
  const snapshot: ShortageSnapshot = {
    schemaVersion: 1,
    parser: parsed.parser,
    capture: {
      timestamp,
      capturedAt: archiveTimestampToIso(timestamp),
      originalUrl: 'https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm',
      mimeType: 'text/csv',
      archiveDigest: 'test-digest',
    },
    provenance: {
      source_name: 'FDA via archive',
      source_url: `https://web.archive.org/web/${timestamp}id_/https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm`,
      query: 'unit test',
      fetched_at: '2026-10-12T00:00:00.000Z',
    },
    bodySha256: sha256(rawBody),
    rows: parsed.rows,
    rowCount: parsed.rows.length,
  };
  return { snapshot, rawBody };
}
function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'test',
    key: 'drug',
    genericName: 'Drug',
    originAt: '2020-06-01T00:00:00.000Z',
    targetAt: '2020-07-01T00:00:00.000Z',
    originSnapshotId: 'origin',
    targetSnapshotId: 'target',
    originSourceRows: [1],
    targetSourceRows: [1],
    gapDays: 30,
    phase: 'train',
    observedCurrentAgeDays: 0,
    ageBand: 'first_observation',
    label: 1,
    exclusion: null,
    ...overrides,
  };
}
describe('observable persistence outcomes', () => {
  it('uses the next global capture, never the next reappearance, and does not infer resolution from absence', () => {
    const a = source('20200601000000').snapshot;
    const b = source('20200701000000', ['Other,Company,Tablet,Current,01/01/2019']).snapshot;
    const c = source('20200801000000', ['Drug,Company,Tablet,Resolved,01/01/2019']).snapshot;
    const rows = buildCohort([c, a, b]);
    expect(rows[0]).toMatchObject({
      originAt: a.capture.capturedAt,
      targetAt: b.capture.capturedAt,
      label: null,
      exclusion: 'TARGET_ABSENT',
      targetSourceRows: [],
    });
    expect(rows.some((r) => r.originAt === a.capture.capturedAt && r.label === 0)).toBe(false);
  });
  it('keeps Current and Resolved as distinct labels; discontinuation, unknown and conflicting outcomes are excluded', () => {
    const a = source('20200601000000').snapshot;
    for (const [status, label, exclusion] of [
      ['Current', 1, null],
      ['Resolved', 0, null],
      ['To Be Discontinued', null, 'TARGET_TO_BE_DISCONTINUED'],
      ['pending', null, 'TARGET_UNKNOWN'],
    ] as const) {
      const b = source('20200701000000', [`Drug,Company,Tablet,${status},01/01/2019`]).snapshot;
      expect(buildCohort([a, b])[0]).toMatchObject({ label, exclusion });
    }
    const b = source('20200701000000', [
      'Drug,Company,Tablet,Current,01/01/2019',
      'Drug,Company,Tablet,Resolved,01/01/2019',
    ]).snapshot;
    expect(buildCohort([a, b])[0]).toMatchObject({ label: null, exclusion: 'TARGET_CONFLICTING' });
    expect(buildCohort([a, b])[1]).toMatchObject({ label: null, exclusion: 'ORIGIN_CONFLICTING' });
  });
  it('enforces the 14–60 day window inclusively and leaves the final capture unlabelled', () => {
    const a = source('20200601000000').snapshot;
    for (const [timestamp, expected] of [
      ['20200614000000', null],
      ['20200615000000', 1],
      ['20200731000000', 1],
      ['20200801000000', null],
    ] as const) {
      const rows = buildCohort([a, source(timestamp).snapshot]);
      expect(rows[0]?.label).toBe(expected);
      expect(rows[1]?.exclusion).toBe('NO_LATER_CAPTURE');
    }
  });
  it('excludes unparseable dates and historically impossible dates at origin or target without rewriting them', () => {
    const good = source('20200601000000').snapshot;
    const future = source('20200701000000', ['Drug,Company,Tablet,Current,12/03/2108']).snapshot;
    expect(buildCohort([good, future])[0]?.exclusion).toBe('TARGET_DATE_UNUSABLE');
    expect(buildCohort([future, source('20200801000000').snapshot])[0]?.exclusion).toBe(
      'ORIGIN_DATE_UNUSABLE',
    );
    expect(future.rows[0]?.initialPostingDate).toBe('2108-12-03');
    const invalid = source('20200701000000', ['Drug,Company,Tablet,Current,02/30/2020']).snapshot;
    expect(buildCohort([good, invalid])[0]?.exclusion).toBe('TARGET_DATE_UNUSABLE');
  });
  it('features depend only on the prefix, and Current-run age resets after absence or a long gap', () => {
    const a = source('20200601000000').snapshot;
    const b = source('20200701000000').snapshot;
    const c = source('20200801000000').snapshot;
    const later = source('20200801000000', ['Drug,Company,Tablet,Resolved,01/01/2019']).snapshot;
    const features = (rows: Decision[]) =>
      rows
        .filter((r) => r.originAt <= b.capture.capturedAt)
        .map((r) => ({ id: r.id, age: r.observedCurrentAgeDays, band: r.ageBand }));
    expect(features(buildCohort([a, b, c]))).toEqual(features(buildCohort([a, b, later])));
    expect(buildCohort([a, b, c])[1]?.observedCurrentAgeDays).toBe(30);
    const absent = source('20200701000000', ['Other,Company,Tablet,Current,01/01/2019']).snapshot;
    expect(
      buildCohort([a, absent, c]).find(
        (r) => r.originAt === c.capture.capturedAt && r.genericName === 'Drug',
      )?.observedCurrentAgeDays,
    ).toBe(0);
    expect(buildCohort([a, source('20200901000000').snapshot])[1]?.observedCurrentAgeDays).toBe(0);
  });
  it('retains same-status duplicate source records and rejects duplicate capture times', () => {
    const a = source(
      '20200601000000',
      Array.from({ length: 2 }, () => 'Drug,Company,Tablet,Current,01/01/2019'),
    ).snapshot;
    const b = source('20200701000000').snapshot;
    expect(buildCohort([a, b])[0]).toMatchObject({ label: 1, originSourceRows: [1, 2] });
    expect(() => buildCohort([a, a])).toThrow('Duplicate capture');
    expect(ageBand(0)).toBe('first_observation');
    expect(ageBand(60)).toBe('up_to_60_days');
    expect(ageBand(180)).toBe('61_to_180_days');
  });
});
describe('training availability and honest metrics', () => {
  it('purges boundary-crossing labels instead of training on future outcomes', () => {
    expect(phaseFor('2020-12-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z')).toBe('boundary');
    expect(phaseFor('2021-12-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z')).toBe('boundary');
    expect(phaseFor('2023-01-01T00:00:00.000Z', '2023-02-01T00:00:00.000Z')).toBe('test');
    expect(() => fitBaselines([decision({ targetAt: '2021-01-01T00:00:00.000Z' })])).toThrow(
      'cutoff',
    );
    expect(() => fitBaselines([])).toThrow('No eligible training');
  });
  it('does not fit on validation/test labels, preserves unseen-key reporting and rejects an overlapping holdout', () => {
    const train = decision();
    const holdout = decision({
      phase: 'test',
      originAt: '2023-01-01T00:00:00.000Z',
      targetAt: '2023-02-01T00:00:00.000Z',
      key: 'new-drug',
      label: 0,
    });
    const fit = fitBaselines([train, holdout]);
    expect(fit).toEqual(fitBaselines([train, { ...holdout, label: 1 }]));
    expect(fit.globalProbability).toBeCloseTo(2 / 3);
    expect(scoreHoldout([train, holdout], fit)[0]).toMatchObject({ seenKeyInTraining: false });
    expect(scoreHoldout([train, holdout], fit)).toHaveLength(1);
    expect(() => scoreHoldout([{ ...holdout, originAt: train.originAt }], fit)).toThrow('Holdout');
  });
  it('reports missed resolutions even when the majority baseline has high accuracy; probabilities of one enter the final calibration bin', () => {
    const rows: ScoredDecision[] = [1, 1, 1, 0].map((label) => ({
      ...decision(),
      label: label as 0 | 1,
      exclusion: null,
      seenKeyInTraining: false,
      probabilities: { always_current: 1, training_rate: 0.75, observed_age: 0.75 },
    }));
    expect(measure(rows, 'always_current')).toMatchObject({
      brierScore: 0.25,
      accuracyAtHalf: 0.75,
      resolvedOutcomes: 1,
      resolutionRecallAtHalf: 0,
      resolutionPrecisionAtHalf: null,
    });
    expect(measure(rows, 'training_rate').brierScore).toBe(0.1875);
    expect(measure(rows, 'always_current').calibration[9]?.rows).toBe(4);
    expect(measure([], 'always_current')).toMatchObject({
      brierScore: null,
      resolutionRecallAtHalf: null,
    });
  });
  it('weights capture macro metrics equally instead of treating every presentation row as independent', () => {
    const rows: ScoredDecision[] = [
      decision(),
      decision(),
      decision({ originAt: '2023-02-01T00:00:00.000Z', label: 0 }),
    ].map((row) => ({
      ...row,
      label: row.label as 0 | 1,
      exclusion: null,
      seenKeyInTraining: false,
      probabilities: { always_current: 1, training_rate: 1, observed_age: 1 },
    }));
    expect(measure(rows, 'always_current').brierScore).toBeCloseTo(1 / 3);
    expect(measure(rows, 'always_current').captureMacroBrierScore).toBe(0.5);
  });
});
it('replays verified source bodies into hash-linked deterministic evaluation artifacts without network access', () => {
  const root = temporary();
  const output = temporary();
  const store = new SnapshotStore(root);
  const sources = [
    '20200601000000',
    '20200701000000',
    '20210101000000',
    '20210201000000',
    '20230101000000',
    '20230201000000',
  ].map((timestamp) => source(timestamp));
  const attempts = sources.map(({ snapshot, rawBody }) => ({
    timestamp: snapshot.capture.timestamp,
    snapshotId: store.put(snapshot, rawBody),
    bodySha256: snapshot.bodySha256,
    error: null,
  }));
  writeImmutable(
    join(root, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      from: '2020-06',
      to: '2023-02',
      indexTruncated: false,
      indexed: sources.map((s) => s.snapshot.capture),
      selected: sources.map((s) => s.snapshot.capture),
      attempts,
    }),
  );
  evaluatePersistence(root, output);
  const before = readFileSync(join(output, 'audit.json'), 'utf8');
  evaluatePersistence(root, output);
  expect(readFileSync(join(output, 'audit.json'), 'utf8')).toBe(before);
  const audit = JSON.parse(before) as {
    cohortSha256: string;
    fitSha256: string;
    readiness: string;
  };
  expect(audit.cohortSha256).toBe(sha256(readFileSync(join(output, 'cohort.json'), 'utf8')));
  expect(audit.fitSha256).toBe(sha256(readFileSync(join(output, 'fit.json'), 'utf8')));
  expect(audit.readiness).toBe('RETROSPECTIVE_CONDITIONAL_BASELINES_ONLY');
});
