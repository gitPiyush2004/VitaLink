/** Deterministic month selection; missing index periods remain explicit. */
import type { ArchiveCapture } from '@vitalink/contracts';

export function monthsBetween(from: string, to: string): string[] {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!valid.test(from) || !valid.test(to) || from > to) {
    throw new Error('Expected ordered YYYY-MM bounds.');
  }
  const result: string[] = [];
  const date = new Date(`${from}-01T00:00:00.000Z`);
  while (date.toISOString().slice(0, 7) <= to) {
    result.push(date.toISOString().slice(0, 7));
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return result;
}
export function selectCaptures(
  captures: ArchiveCapture[],
  from: string,
  to: string,
  budget: number,
) {
  if (!Number.isInteger(budget) || budget < 1) {
    throw new Error('Capture budget must be a positive integer.');
  }
  const months = monthsBetween(from, to);
  const first = new Map<string, ArchiveCapture>();
  for (const capture of [...captures].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const month = capture.capturedAt.slice(0, 7);
    if (months.includes(month) && !first.has(month)) first.set(month, capture);
  }
  return { months, selected: [...first.values()].slice(0, budget), availableMonths: first.size };
}
