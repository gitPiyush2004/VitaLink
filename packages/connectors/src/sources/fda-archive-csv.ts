/** Parse original FDA CSVs without turning missing dates or states into outcomes. */
import { createHash } from 'node:crypto';

import { CsvError, parse } from 'csv-parse/sync';
import { z } from 'zod';

import type { HistoricalShortageRow } from '@vitalink/contracts';

import { repairEmbeddedQuotes } from './fda-csv-quotes';
import { parseFdaDate } from './fda-date';

const required = ['generic name', 'company name', 'presentation', 'status', 'initial posting date'];
const rowSchema = z.record(z.string(), z.string());
function header(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
function columns(values: string[]): string[] {
  const names = values.map(header);
  if (new Set(names).size !== names.length || required.some((name) => !names.includes(name))) {
    throw new Error('Archived FDA CSV has duplicate or missing required columns.');
  }
  return names;
}
function text(row: Record<string, string>, field: string): string | null {
  const value = row[field]?.trim();
  return value === undefined || value === '' ? null : value;
}
function status(raw: string | null): HistoricalShortageRow['status'] {
  const value = raw?.toLowerCase();
  if (value === 'current') return 'Current';
  if (value === 'resolved') return 'Resolved';
  if (value === 'to be discontinued') return 'To Be Discontinued';
  return 'Unknown';
}
function dates(row: Record<string, string>) {
  const fields = {
    initialPostingDate: 'initial posting date',
    updateDate: 'date of update',
    changeDate: 'change date',
    discontinuedDate: 'date discontinued',
  };
  const result: Record<string, string | null> = {};
  const dateIssues: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    const raw = text(row, field);
    result[name] = parseFdaDate(raw);
    if (raw !== null && result[name] === null) dateIssues.push(`${field}: ${raw}`);
  }
  return { result, dateIssues };
}
function mapRow(row: Record<string, string>, index: number): HistoricalShortageRow {
  const genericName = text(row, 'generic name');
  if (genericName === null) {
    throw new Error(`Missing generic name in CSV record ${String(index + 1)}.`);
  }
  const companyName = text(row, 'company name');
  const presentation = text(row, 'presentation');
  const identity = [genericName, companyName, presentation].map(
    (v) => v?.toLowerCase().replace(/\s+/g, ' ') ?? null,
  );
  const { result, dateIssues } = dates(row);
  const statusRaw = text(row, 'status');
  return {
    key: createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
    sourceRow: index + 1,
    genericName,
    companyName,
    presentation,
    status: status(statusRaw),
    statusRaw,
    availability: text(row, 'availability information'),
    reason: text(row, 'reason for shortage'),
    therapeuticCategory: text(row, 'therapeutic category'),
    initialPostingDate: result.initialPostingDate ?? null,
    updateDate: result.updateDate ?? null,
    changeDate: result.changeDate ?? null,
    discontinuedDate: result.discontinuedDate ?? null,
    dateIssues,
  };
}
export function parseArchiveCsv(body: string) {
  const options = { bom: true, columns, skip_empty_lines: true, relax_column_count: false };
  const input = body.replace(/^\uFEFF/, '').trimStart();
  let parsed: unknown;
  let mode: 'strict' | 'repaired_embedded_quotes' = 'strict';
  const issues: string[] = [];
  try {
    parsed = parse(input, options);
  } catch (error) {
    if (
      !(error instanceof CsvError) ||
      !['CSV_INVALID_CLOSING_QUOTE', 'INVALID_OPENING_QUOTE'].includes(error.code)
    ) {
      throw error;
    }
    // Older FDA CSVs contain unescaped quotes inside quoted prose. Keep strict
    // column counts, preserve the original body, and disclose this fallback.
    const repaired = repairEmbeddedQuotes(input);
    parsed = parse(repaired.text, options);
    mode = 'repaired_embedded_quotes';
    issues.push(
      `Escaped ${String(repaired.repaired)} illegal embedded quote(s) after ${error.code}. Column counts remain strict.`,
    );
  }
  const records = z.array(rowSchema).parse(parsed);
  if (records.length === 0) throw new Error('Archived FDA CSV has no presentation rows.');
  return { rows: records.map(mapRow), parser: { version: 1 as const, mode, issues } };
}
export function parseArchivedShortageCsv(body: string): HistoricalShortageRow[] {
  return parseArchiveCsv(body).rows;
}
