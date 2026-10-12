/** Offline evidence-to-cohort evaluation. Frozen outputs refuse incompatible replacement. */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildHistoryReport, manifestSchema } from '../report';
import { sha256, SnapshotStore, writeImmutable } from '../snapshot-store';

import { fitBaselines, scoreHoldout } from './baselines';
import { buildCohort } from './cohort';
import { evaluationSummary } from './metrics';
import { persistenceTask } from './task';

function loadCollection(directory: string) {
  // Validate all source bodies, interpretations, provenance and failed-attempt bodies first.
  buildHistoryReport(directory);
  const text = readFileSync(join(directory, 'manifest.json'), 'utf8');
  const manifest = manifestSchema.parse(JSON.parse(text));
  const store = new SnapshotStore(directory);
  const snapshots = manifest.attempts.flatMap((attempt) => {
    if (attempt.snapshotId === null) return [];
    const snapshot = store.load(attempt.snapshotId);
    const selected = manifest.selected.find((capture) => capture.timestamp === attempt.timestamp);
    if (
      attempt.timestamp !== snapshot.capture.timestamp ||
      attempt.bodySha256 !== snapshot.bodySha256 ||
      attempt.error !== null ||
      JSON.stringify(selected) !== JSON.stringify(snapshot.capture)
    ) {
      throw new Error('Collection manifest does not identify the validated snapshot.');
    }
    return [snapshot];
  });
  return { snapshots, manifestSha256: sha256(text), indexTruncated: manifest.indexTruncated };
}
export function evaluatePersistence(collectionDirectory: string, outputDirectory: string): void {
  const source = loadCollection(collectionDirectory);
  const decisions = buildCohort(source.snapshots);
  const fit = fitBaselines(decisions);
  const scored = scoreHoldout(decisions, fit);
  const metrics = evaluationSummary(scored);
  const taskText = JSON.stringify(persistenceTask, null, 2) + '\n';
  const datasetText = JSON.stringify(decisions, null, 2) + '\n';
  const fitText = JSON.stringify(fit, null, 2) + '\n';
  const scoredText = JSON.stringify(scored, null, 2) + '\n';
  const audit = {
    schemaVersion: 1,
    manifestSha256: source.manifestSha256,
    taskSha256: sha256(taskText),
    cohortSha256: sha256(datasetText),
    fitSha256: sha256(fitText),
    predictionsSha256: sha256(scoredText),
    indexTruncated: source.indexTruncated,
    snapshots: source.snapshots.map((snapshot) => ({
      id: `${snapshot.capture.timestamp}-${snapshot.bodySha256}`,
      capturedAt: snapshot.capture.capturedAt,
      fetchedAt: snapshot.provenance.fetched_at,
      sourceUrl: snapshot.provenance.source_url,
      quoteRepair: snapshot.parser.mode !== 'strict',
    })),
    decisions: decisions.length,
    eligibleByPhase: tally(decisions.filter((row) => row.label !== null).map((row) => row.phase)),
    exclusions: tally(
      decisions.filter((row) => row.label === null).map((row) => row.exclusion ?? 'UNKNOWN'),
    ),
    boundaryLabelledRows: decisions.filter((r) => r.phase === 'boundary' && r.label !== null)
      .length,
    outcomeCoverageByOrigin: [...new Set(decisions.map((r) => r.originAt))]
      .sort()
      .map((originAt) => {
        const rows = decisions.filter((r) => r.originAt === originAt);
        return {
          originAt,
          decisions: rows.length,
          labelled: rows.filter((r) => r.label !== null).length,
          exclusions: tally(
            rows.filter((r) => r.label === null).map((r) => r.exclusion ?? 'UNKNOWN'),
          ),
        };
      }),
    readiness: 'RETROSPECTIVE_CONDITIONAL_BASELINES_ONLY',
    deploymentGate: 'NO_PROSPECTIVE_VALIDATION_OR_COMPLETE_OUTCOME_COVERAGE',
    newOnsetGate: 'HISTORICAL_ELIGIBLE_NON_SHORTAGE_UNIVERSE_MISSING',
  };
  const reports = {
    'task.json': taskText,
    'cohort.json': datasetText,
    'fit.json': fitText,
    'predictions.json': scoredText,
    'audit.json': JSON.stringify(audit, null, 2) + '\n',
    'metrics.json': JSON.stringify(metrics, null, 2) + '\n',
  };
  mkdirSync(outputDirectory, { recursive: true });
  for (const [name, content] of Object.entries(reports)) {
    writeImmutable(join(outputDirectory, name), content);
  }
  console.log(
    `Persistence evaluation: ${String(decisions.length)} decision records, ${String(scored.length)} labelled holdout rows. ${audit.readiness}.`,
  );
}
function tally(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of [...values].sort()) result[value] = (result[value] ?? 0) + 1;
  return result;
}
