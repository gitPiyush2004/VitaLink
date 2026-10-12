/** Strict CDX parsing and exact replay URLs for the original FDA CSV endpoint. */
import type { ArchiveCapture } from '@vitalink/contracts';

import { parseFdaDate } from './fda-date';

export const FDA_ARCHIVE_ORIGINAL =
  'https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm';
const DATE_LENGTH = 8;
const HOUR_END = 10;
const MINUTE_END = 12;
const TIMESTAMP_LENGTH = 14;
function originalUrl(raw: string): string {
  const url = new URL(raw);
  const expected = new URL(FDA_ARCHIVE_ORIGINAL);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.host !== expected.host ||
    url.pathname.toLowerCase() !== expected.pathname.toLowerCase() ||
    url.search !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== ''
  ) {
    throw new Error('CDX record is not the allowed FDA shortage CSV endpoint.');
  }
  return raw;
}
export function archiveTimestampToIso(timestamp: string): string {
  if (timestamp.length !== TIMESTAMP_LENGTH || !/^\d+$/.test(timestamp)) {
    throw new Error('Invalid archive timestamp.');
  }
  const day = parseFdaDate(timestamp.slice(0, DATE_LENGTH));
  if (day === null) throw new Error('Invalid archive calendar date.');
  const iso = `${day}T${timestamp.slice(DATE_LENGTH, HOUR_END)}:${timestamp.slice(HOUR_END, MINUTE_END)}:${timestamp.slice(MINUTE_END, TIMESTAMP_LENGTH)}.000Z`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso) {
    throw new Error('Invalid archive clock time.');
  }
  return iso;
}
export function parseArchiveIndex(table: string[][]): ArchiveCapture[] {
  const [names, ...records] = table;
  if (names === undefined) return [];
  const required = ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'];
  if (new Set(names).size !== names.length || required.some((name) => !names.includes(name))) {
    throw new Error('CDX response has missing or duplicate columns.');
  }
  const found = new Map<string, ArchiveCapture>();
  for (const values of records) {
    if (values.length !== names.length) throw new Error('CDX response has an incomplete record.');
    const row = Object.fromEntries(names.map((name, i) => [name, values[i] ?? '']));
    if (row.statuscode !== '200' || row.mimetype !== 'text/csv') continue;
    const capture = indexCapture(row);
    const timestamp = capture.timestamp;
    found.set(`${timestamp}:${capture.originalUrl}`, capture);
  }
  return [...found.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export function archiveReplayUrl(capture: ArchiveCapture): string {
  archiveTimestampToIso(capture.timestamp);
  return `https://web.archive.org/web/${capture.timestamp}id_/${originalUrl(capture.originalUrl)}`;
}

function indexCapture(row: Record<string, string>): ArchiveCapture {
  const timestamp = row.timestamp ?? '';
  return {
    timestamp,
    capturedAt: archiveTimestampToIso(timestamp),
    originalUrl: originalUrl(row.original ?? ''),
    mimeType: row.mimetype ?? '',
    archiveDigest: row.digest ?? '',
  };
}
