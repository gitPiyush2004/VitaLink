/** Bounded research retrieval; historical captures never replace the live feed. */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { ArchiveCapture, ShortageSnapshot } from '@vitalink/contracts';

import type { CachedHttpClient, Fetched, SourceRequest } from '../http/cached-client';

import { parseArchiveCsv } from './fda-archive-csv';
import { archiveReplayUrl, FDA_ARCHIVE_ORIGINAL, parseArchiveIndex } from './fda-archive-index';

const INDEX_LIMIT = 5000;
const COURTESY_INTERVAL_MS = 2000;
const CACHE_TTL_SECONDS = 86400;
const TIMEOUT_MS = 25_000;
function request(url: string, query: string): SourceRequest {
  return {
    sourceId: 'wayback_fda_shortages',
    displayName: 'FDA Drug Shortages via Internet Archive',
    url,
    queryDescription: query,
    minIntervalMs: COURTESY_INTERVAL_MS,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    timeoutMs: TIMEOUT_MS,
    maxAttempts: 2,
    redirect: 'manual',
    headers: { 'user-agent': 'VitaLink academic FDA history research', accept: '*/*' },
  };
}
export class FdaArchiveClient {
  constructor(private readonly http: Pick<CachedHttpClient, 'getJson' | 'getText'>) {}

  async index(from: string, to: string) {
    if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to) || from > to) {
      throw new Error('Archive query requires ordered YYYYMMDD dates.');
    }
    const params = new URLSearchParams({
      url: FDA_ARCHIVE_ORIGINAL,
      matchType: 'exact',
      output: 'json',
      filter: 'statuscode:200',
      from,
      to,
      limit: String(INDEX_LIMIT),
      fl: 'timestamp,original,mimetype,statuscode,digest',
    });
    const response = await this.http.getJson(
      request(
        `https://web.archive.org/cdx/search/cdx?${params.toString()}`,
        `FDA CSV captures ${from} through ${to}`,
      ),
      z.array(z.array(z.string())),
    );
    return {
      ...response,
      data: parseArchiveIndex(response.data),
      truncated: response.data.length - 1 >= INDEX_LIMIT,
    };
  }

  fetchCapture(capture: ArchiveCapture): Promise<Fetched<string>> {
    return this.http.getText(
      request(archiveReplayUrl(capture), `Exact FDA CSV capture ${capture.timestamp}`),
    );
  }
  async capture(capture: ArchiveCapture): Promise<{ snapshot: ShortageSnapshot; rawBody: string }> {
    const response = await this.fetchCapture(capture);
    return { rawBody: response.rawBody, snapshot: interpretArchiveCapture(capture, response) };
  }
}
export function interpretArchiveCapture(
  capture: ArchiveCapture,
  response: Fetched<string>,
): ShortageSnapshot {
  const { rows, parser } = parseArchiveCsv(response.rawBody);
  return {
    schemaVersion: 1,
    parser,
    capture,
    provenance: response.provenance,
    bodySha256: createHash('sha256').update(response.rawBody).digest('hex'),
    rows,
    rowCount: rows.length,
  };
}
