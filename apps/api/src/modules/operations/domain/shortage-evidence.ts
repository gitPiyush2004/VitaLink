import { parseFdaDate, type ShortageRecord } from '@vitalink/connectors';
import type { ProductCandidate } from '@vitalink/contracts';

type Evidence = NonNullable<ProductCandidate['reportedShortage']>;
const ISO_DATE_LENGTH = 10;
function observedStatus(row: ShortageRecord, fetchedAt: string): Evidence | null {
  const date = parseFdaDate(row.update_date ?? row.change_date ?? row.initial_posting_date);
  return !row.status || date === null || date > fetchedAt.slice(0, ISO_DATE_LENGTH)
    ? null
    : { status: row.status, availability: row.availability ?? null, updatedAt: date };
}
/** FDA harmonised NDC associations can cover several presentations. Preserve disagreement. */
export function shortageEvidenceByNdc(
  rows: ShortageRecord[],
  fetchedAt: string,
): Map<string, Evidence> {
  const groups = new Map<string, Evidence[]>();
  for (const row of rows) {
    const evidence = observedStatus(row, fetchedAt);
    if (evidence === null) continue;
    for (const ndc of row.openfda?.product_ndc ?? []) {
      const group = groups.get(ndc) ?? [];
      group.push(evidence);
      groups.set(ndc, group);
    }
  }
  return new Map(
    [...groups].map(([ndc, group]) => [
      ndc,
      {
        status: oneValue(group.map((row) => row.status)) ?? 'Mixed FDA presentation statuses',
        availability: oneValue(group.map((row) => row.availability)),
        updatedAt:
          group
            .map((row) => row.updatedAt)
            .sort()
            .at(-1) ?? fetchedAt,
      },
    ]),
  );
}
function oneValue<T>(values: T[]): T | null {
  const unique = [...new Set(values)];
  return unique.length === 1 ? (unique[0] ?? null) : null;
}
