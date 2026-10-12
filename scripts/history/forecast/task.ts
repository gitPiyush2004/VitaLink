/** Predeclared retrospective question; no parameters selected from holdout results. */
export const persistenceTask = {
  version: 1,
  id: 'current-presentation-next-observed-status-v1',
  question: 'Is a Current printed presentation still Current at the next global archive capture?',
  minimumGapDays: 14,
  maximumGapDays: 60,
  trainingEnd: '2021-01-01T00:00:00.000Z',
  validationEnd: '2023-01-01T00:00:00.000Z',
  shrinkageWeight: 20,
  ageBoundariesDays: [0, 60, 180],
  ageBands: ['first_observation', 'up_to_60_days', '61_to_180_days', 'over_180_days'],
  positiveLabel: 'Current at next capture',
  negativeLabel: 'Resolved at next capture',
  targetScope:
    'Conditional on the same printed presentation being observed with a usable status at both captures.',
  availabilityBasis:
    'Original archive capture time, not the later retrieval time. Retrospective source reconstruction.',
  limitations: [
    'This is not new-shortage prediction, an exact 30-day forecast or time-to-resolution estimation.',
    'Absence, discontinuation, conflicting status, invalid dates and gaps outside 14–60 days have unknown outcomes.',
    'Eligibility uses future observation coverage; a deployable model cannot know that coverage in advance.',
    'Presentation keys are printed associations, not stable clinical identifiers or independent episodes.',
    'Repeated presentations and captures are dependent; row counts are not independent sample sizes.',
    'One originating authority and historical source revisions limit generalization; no prospective validation.',
    'Observed Current-run age is a lower bound, reset after absence, conflicting/unusable status or a gap over 60 days.',
    'No latest product catalogue, source future dates, news or supplier data are used as historical predictors.',
  ],
} as const;

export type Phase = 'train' | 'validation' | 'test' | 'boundary';
export function phaseFor(originAt: string, targetAt: string | null): Phase {
  if (originAt < persistenceTask.trainingEnd) {
    return targetAt !== null && targetAt < persistenceTask.trainingEnd ? 'train' : 'boundary';
  }
  if (originAt < persistenceTask.validationEnd) {
    return targetAt !== null && targetAt < persistenceTask.validationEnd
      ? 'validation'
      : 'boundary';
  }
  return 'test';
}
export function ageBand(ageDays: number): string {
  if (ageDays === 0) return persistenceTask.ageBands[0];
  if (ageDays <= persistenceTask.ageBoundariesDays[1]) return persistenceTask.ageBands[1];
  if (ageDays <= persistenceTask.ageBoundariesDays[2]) return persistenceTask.ageBands[2];
  return persistenceTask.ageBands[3];
}
