import { createHash } from 'node:crypto';

import { parseFdaDate, type EnforcementReport, type ShortageRecord } from '@vitalink/connectors';
import type { Incident, Provenance } from '@vitalink/contracts';

function harmonised(row: EnforcementReport | ShortageRecord) {
  return {
    productNdcs: row.openfda?.product_ndc ?? [],
    genericNames: row.openfda?.generic_name ?? [],
    substances: row.openfda?.substance_name ?? [],
  };
}
function recallScope(row: EnforcementReport) {
  return {
    classification: row.classification ?? null,
    lots: row.code_info ?? null,
    distribution: row.distribution_pattern ?? null,
    presentation: row.product_description ?? null,
  };
}
function firmLocation(row: EnforcementReport): Incident['location'] {
  const label = [row.city, row.state, row.country].filter(Boolean).join(', ');
  return label
    ? {
        label,
        city: row.city ?? '',
        country: row.country ?? '',
        coordinates: null,
        precision: 'recalling-firm city',
        provenance: null,
      }
    : null;
}
function shortageIdentity(row: ShortageRecord) {
  const key = [row.package_ndc ?? row.presentation, row.generic_name, row.company_name].join('|');
  return {
    id: `shortage:${createHash('sha256').update(key).digest('hex')}`,
    name: row.generic_name ?? row.proprietary_name ?? 'Unidentified product',
  };
}
function shortageSearch(row: ShortageRecord, name: string): string {
  return row.package_ndc
    ? `package_ndc:"${row.package_ndc}"`
    : `generic_name:"${name.replace(/"/g, '')}"`;
}
/** FDA reports retain their source scope; firm geography is not a plant location. */
export function recallIncident(row: EnforcementReport, provenance: Provenance): Incident {
  const names = harmonised(row);
  return {
    id: `recall:${row.recall_number}`,
    kind: 'RECALL',
    title: row.product_description ?? row.recall_number,
    product: row.openfda?.generic_name?.[0] ?? row.product_description ?? row.recall_number,
    company: row.recalling_firm ?? 'Not reported',
    status: row.status ?? 'Not reported',
    ...recallScope(row),
    reason: row.reason_for_recall ?? 'No reason supplied by the source',
    publishedAt: sourceDate(row.report_date),
    updatedAt: provenance.fetched_at,
    sourceUrl: `https://api.fda.gov/drug/enforcement.json?${new URLSearchParams({ search: `recall_number:"${row.recall_number}"` }).toString()}`,
    provenance,
    ...names,
    availability: null,
    location: firmLocation(row),
  };
}

export function shortageIncident(row: ShortageRecord, provenance: Provenance): Incident {
  const { id, name } = shortageIdentity(row);
  const search = shortageSearch(row, name);
  const names = harmonised(row);
  return {
    id,
    kind: 'SHORTAGE',
    title: `${name} — ${row.availability ?? row.status ?? 'shortage report'}`,
    product: name,
    company: row.company_name ?? 'Not reported',
    status: row.status ?? 'Not reported',
    classification: null,
    reason:
      row.shortage_reason ?? row.availability_information ?? 'No reason supplied by the source',
    publishedAt: sourceDate(row.update_date) ?? sourceDate(row.initial_posting_date),
    updatedAt: provenance.fetched_at,
    sourceUrl: `https://api.fda.gov/drug/shortages.json?${new URLSearchParams({ search }).toString()}`,
    provenance,
    ...names,
    genericNames: [...new Set([...names.genericNames, name])],
    lots: null,
    distribution: null,
    presentation: row.presentation ?? null,
    availability: row.availability ?? null,
    location: null,
  };
}

export function sourceDate(raw: string | undefined): string | null {
  const date = parseFdaDate(raw);
  return date === null ? null : `${date}T00:00:00.000Z`;
}

/** One presentation can appear twice in a source page. Save its newest update once. */
export function latestIncidents(rows: Incident[]): Incident[] {
  const byId = new Map<string, Incident>();
  for (const row of rows) {
    const prior = byId.get(row.id);
    if (!prior || (prior.publishedAt ?? '') <= (row.publishedAt ?? '')) byId.set(row.id, row);
  }
  return [...byId.values()];
}
