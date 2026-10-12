import type { Incident } from '@vitalink/contracts';

const fields = [
  ['status', 'Source status'],
  ['availability', 'Presentation availability'],
  ['reason', 'Reason'],
  ['classification', 'Recall classification'],
  ['lots', 'Lot / code scope'],
  ['distribution', 'Distribution'],
  ['presentation', 'Presentation'],
  ['company', 'Company'],
  ['product', 'Product'],
  ['productNdcs', 'Product NDCs'],
  ['genericNames', 'Generic names'],
  ['substances', 'Substances'],
  ['publishedAt', 'Source-reported date'],
] as const;
export function sourceChanges(previous: Incident, current: Incident) {
  return fields.flatMap(([field, label]) => {
    const before = value(previous[field]);
    const after = value(current[field]);
    return before === after ? [] : [{ field, label, before, after }];
  });
}
function value(input: string | string[] | null): string {
  if (Array.isArray(input)) return [...input].sort().join(', ') || 'Not supplied';
  return input || 'Not supplied';
}
export function decisionLabel(action: string): string {
  const labels: Record<string, string> = {
    monitor: 'Monitor source updates',
    investigate_candidate: 'Investigate a product candidate',
    escalate: 'Escalate for review',
    documented_response: 'Follow the saved response decision',
  };
  return labels[action] ?? action;
}
