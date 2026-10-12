import { afterEach, describe, expect, it, vi } from 'vitest';

import { CachedHttpClient } from '../../http/cached-client';
import { createMemoryCache } from '../../http/ports';
import { parseArchiveCsv } from '../fda-archive-csv';
import { archiveReplayUrl, archiveTimestampToIso, parseArchiveIndex } from '../fda-archive-index';
import { FdaArchiveClient } from '../fda-archive.client';

const header =
  ' Generic Name,Company Name, Presentation,Status, Initial Posting Date,Date of Update,Availability Information';
const csv =
  '\uFEFF\n\r\n' +
  header +
  '\r\n"Medicine, injection","Company ""A""","500 mg\r\n(NDC 001-1)",Current,10/01/2019,10/02/2019,Available';
const capture = {
  timestamp: '20191020223457',
  capturedAt: '2019-10-20T22:34:57.000Z',
  originalUrl: 'https://www.accessdata.fda.gov/scripts/drugshortages/Drugshortages.cfm',
  mimeType: 'text/csv',
  archiveDigest: 'SOURCE-DIGEST',
};
afterEach(() => vi.unstubAllGlobals());
describe('archived FDA CSV interpretation', () => {
  it('handles BOM, blank lines, padded headings, quoted commas/quotes and multiline presentations', () => {
    const parsed = parseArchiveCsv(csv);
    expect(parsed.parser.mode).toBe('strict');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      genericName: 'Medicine, injection',
      companyName: 'Company "A"',
      presentation: '500 mg\r\n(NDC 001-1)',
      initialPostingDate: '2019-10-01',
      updateDate: '2019-10-02',
      status: 'Current',
    });
  });
  it('preserves invalid/missing dates and unfamiliar statuses as unknown', () => {
    const result = parseArchiveCsv(header + '\nDrug,Company,Tablet,Unpublished,02/30/2019,,');
    expect(result.rows[0]).toMatchObject({
      status: 'Unknown',
      statusRaw: 'Unpublished',
      initialPostingDate: null,
      updateDate: null,
      dateIssues: ['initial posting date: 02/30/2019'],
    });
  });
  it('repairs only illegal embedded quotes while preserving field content and strict column counts', () => {
    const result = parseArchiveCsv(
      header + '\nDrug,Company,"Codes from the "0409" to a "0990" label",Current,10/01/2019,,',
    );
    expect(result.parser.mode).toBe('repaired_embedded_quotes');
    expect(result.rows[0]?.presentation).toBe('Codes from the "0409" to a "0990" label');
    expect(result.parser.issues[0]).toContain('Escaped 4');
    expect(() =>
      parseArchiveCsv(header + '\nDrug,Company,Tablet,Current,10/01/2019,,extra,extra'),
    ).toThrow();
  });
  it('rejects HTML, missing headers and malformed records rather than creating an empty history', () => {
    expect(() => parseArchiveCsv('<html>Unavailable</html>')).toThrow();
    expect(() => parseArchiveCsv(header)).toThrow();
    expect(() => parseArchiveCsv(header + '\nDrug,Company,Tablet')).toThrow();
  });
  it('keeps identity stable across status changes but distinguishes companies', () => {
    const row = (company: string, status: string) =>
      parseArchiveCsv(header + `\nDrug,${company},Tablet,${status},10/01/2019,,`).rows[0];
    expect(row('A', 'Current')?.key).toBe(row('A', 'Resolved')?.key);
    expect(row('A', 'Current')?.key).not.toBe(row('B', 'Current')?.key);
    expect(row('A', 'To be Discontinued')?.status).toBe('To Be Discontinued');
  });
});
describe('archive index and exact replay', () => {
  it('reads reordered CDX columns and validates calendar and clock time', () => {
    const result = parseArchiveIndex([
      ['original', 'digest', 'statuscode', 'timestamp', 'mimetype'],
      [capture.originalUrl, 'digest', '200', capture.timestamp, 'text/csv'],
    ]);
    expect(result[0]?.capturedAt).toBe(capture.capturedAt);
    expect(archiveReplayUrl(capture)).toContain('/20191020223457id_/');
    expect(() => archiveTimestampToIso('20190230000000')).toThrow();
    expect(() => archiveTimestampToIso('20191020240000')).toThrow();
  });
  it('rejects untrusted original URLs and incomplete CDX records', () => {
    expect(() =>
      archiveReplayUrl({ ...capture, originalUrl: 'https://example.com/private' }),
    ).toThrow();
    expect(() =>
      archiveReplayUrl({ ...capture, originalUrl: capture.originalUrl + '?changed=true' }),
    ).toThrow();
    expect(() =>
      parseArchiveIndex([['timestamp', 'original', 'mimetype', 'statuscode', 'digest'], ['2019']]),
    ).toThrow();
  });
  it('does not reuse a permissive redirect cache entry for exact replay', async () => {
    const cache = createMemoryCache();
    const http = new CachedHttpClient({ cache });
    const url = archiveReplayUrl(capture);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(csv, { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 302 }));
    vi.stubGlobal('fetch', fetch);
    await http.getText({
      sourceId: 'wayback_fda_shortages',
      displayName: 'test',
      url,
      queryDescription: 'test',
      minIntervalMs: 0,
      cacheTtlSeconds: 60,
    });
    await expect(new FdaArchiveClient(http).capture(capture)).rejects.toThrow('returned 302');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects redirects rather than silently substituting a different archive date', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('', {
        status: 302,
        headers: { location: 'https://web.archive.org/web/20200101000000id_/changed' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const client = new FdaArchiveClient(new CachedHttpClient({ cache: createMemoryCache() }));
    await expect(client.capture(capture)).rejects.toThrow('returned 302');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });
});
