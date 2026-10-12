/** Frozen training-only estimators, with the obvious persistence assumption as a comparator. */
import type { Decision } from './cohort';
import { persistenceTask, phaseFor } from './task';

export type LabelledDecision = Decision & { label: 0 | 1; exclusion: null };
export function isLabelled(row: Decision): row is LabelledDecision {
  return row.label !== null && row.exclusion === null && row.phase !== 'boundary';
}
export type BaselineFit = {
  trainingRows: number;
  trainingOriginCaptures: number;
  maximumTrainingLabelAt: string;
  trainingKeys: string[];
  globalProbability: number;
  bands: { band: string; rows: number; positives: number; probability: number }[];
};
export function fitBaselines(rows: Decision[]): BaselineFit {
  const train = rows.filter(isLabelled).filter((row) => row.phase === 'train');
  if (train.length === 0) throw new Error('No eligible training outcomes. No model can be fit.');
  const labelTimes = train.map((row) => row.targetAt ?? '');
  if (
    train.some((row) => phaseFor(row.originAt, row.targetAt) !== 'train') ||
    labelTimes.some((at) => at === '' || at >= persistenceTask.trainingEnd)
  ) {
    throw new Error('Training label is unavailable before the frozen cutoff.');
  }
  const globalProbability = (train.reduce((n, r) => n + r.label, 0) + 1) / (train.length + 2);
  return {
    trainingRows: train.length,
    trainingOriginCaptures: new Set(train.map((r) => r.originAt)).size,
    maximumTrainingLabelAt: [...labelTimes].sort().at(-1) ?? '',
    trainingKeys: [...new Set(train.map((r) => r.key))].sort(),
    globalProbability,
    bands: persistenceTask.ageBands.map((band) => {
      const selected = train.filter((row) => row.ageBand === band);
      const positives = selected.reduce((n, row) => n + row.label, 0);
      return {
        band,
        rows: selected.length,
        positives,
        probability:
          (positives + persistenceTask.shrinkageWeight * globalProbability) /
          (selected.length + persistenceTask.shrinkageWeight),
      };
    }),
  };
}
export const baselineNames = ['always_current', 'training_rate', 'observed_age'] as const;
export type BaselineName = (typeof baselineNames)[number];
export type ScoredDecision = LabelledDecision & {
  seenKeyInTraining: boolean;
  probabilities: Record<BaselineName, number>;
};
export function scoreHoldout(rows: Decision[], fit: BaselineFit): ScoredDecision[] {
  const seen = new Set(fit.trainingKeys);
  const holdout = rows.filter(isLabelled).filter((row) => row.phase !== 'train');
  if (
    holdout.some(
      (row) =>
        row.originAt <= fit.maximumTrainingLabelAt ||
        phaseFor(row.originAt, row.targetAt) !== row.phase,
    )
  ) {
    throw new Error(
      'Holdout must follow training label availability and retain its temporal phase.',
    );
  }
  return holdout.map((row) => ({
    ...row,
    seenKeyInTraining: seen.has(row.key),
    probabilities: {
      always_current: 1,
      training_rate: fit.globalProbability,
      observed_age:
        fit.bands.find((b) => b.band === row.ageBand)?.probability ?? fit.globalProbability,
    },
  }));
}
