/** Descriptive holdout metrics, without pretending repeated rows are independent. */
import { baselineNames, type BaselineName, type ScoredDecision } from './baselines';

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((n, value) => n + value, 0) / values.length;
}
export function measure(rows: ScoredDecision[], model: BaselineName) {
  const origins = [...new Set(rows.map((r) => r.originAt))].sort();
  const brier = (row: ScoredDecision) => (row.probabilities[model] - row.label) ** 2;
  const resolved = rows.filter((row) => row.label === 0);
  const predictedResolved = rows.filter((row) => row.probabilities[model] < 0.5);
  const trueResolved = predictedResolved.filter((row) => row.label === 0);
  const calibration = Array.from({ length: 10 }, (_, index) => {
    const lower = index / 10;
    const upper = (index + 1) / 10;
    const selected = rows.filter(
      (r) =>
        r.probabilities[model] >= lower &&
        (r.probabilities[model] < upper || (index === 9 && r.probabilities[model] === 1)),
    );
    return {
      lower,
      upper,
      rows: selected.length,
      meanProbability: mean(selected.map((r) => r.probabilities[model])),
      observedCurrentFraction: mean(selected.map((r) => r.label)),
    };
  });
  return {
    rows: rows.length,
    originCaptures: origins.length,
    presentationKeys: new Set(rows.map((r) => r.key)).size,
    printedGenericNames: new Set(rows.map((r) => r.genericName.trim().toLowerCase())).size,
    currentOutcomes: rows.length - resolved.length,
    resolvedOutcomes: resolved.length,
    observedCurrentFraction: mean(rows.map((r) => r.label)),
    brierScore: mean(rows.map(brier)),
    captureMacroBrierScore: mean(
      origins.map((at) => mean(rows.filter((r) => r.originAt === at).map(brier)) ?? 0),
    ),
    captureNameMacroBrierScore: captureNameMacro(rows, model),
    accuracyAtHalf: mean(
      rows.map((r) => Number(Number(r.probabilities[model] >= 0.5) === r.label)),
    ),
    predictedResolved: predictedResolved.length,
    resolutionRecallAtHalf: resolved.length === 0 ? null : trueResolved.length / resolved.length,
    resolutionPrecisionAtHalf:
      predictedResolved.length === 0 ? null : trueResolved.length / predictedResolved.length,
    calibration,
  };
}
function captureNameMacro(rows: ScoredDecision[], model: BaselineName): number | null {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const key = `${row.originAt}:${row.genericName.trim().toLowerCase()}`;
    const group = groups.get(key) ?? { sum: 0, count: 0 };
    group.sum += (row.probabilities[model] - row.label) ** 2;
    group.count++;
    groups.set(key, group);
  }
  return mean([...groups.values()].map((group) => group.sum / group.count));
}
export function comparison(rows: ScoredDecision[]) {
  return baselineNames.map((model) => ({ model, ...measure(rows, model) }));
}
export function evaluationSummary(rows: ScoredDecision[]) {
  return {
    validation: comparison(rows.filter((r) => r.phase === 'validation')),
    test: comparison(rows.filter((r) => r.phase === 'test')),
    testSeenKeys: comparison(rows.filter((r) => r.phase === 'test' && r.seenKeyInTraining)),
    testUnseenKeys: comparison(rows.filter((r) => r.phase === 'test' && !r.seenKeyInTraining)),
    testByYear: [
      ...new Set(rows.filter((r) => r.phase === 'test').map((r) => r.originAt.slice(0, 4))),
    ]
      .sort()
      .map((year) => ({
        year,
        models: comparison(rows.filter((r) => r.phase === 'test' && r.originAt.startsWith(year))),
      })),
    byOrigin: [...new Set(rows.map((r) => r.originAt))].sort().map((originAt) => ({
      originAt,
      models: comparison(rows.filter((r) => r.originAt === originAt)),
    })),
  };
}
