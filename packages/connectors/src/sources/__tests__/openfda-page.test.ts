import { describe, expect, it, vi } from 'vitest';

import { CachedHttpClient } from '../../http/cached-client';
import { ConnectorError } from '../../http/connector-error';
import { createMemoryCache } from '../../http/ports';
import { OpenFdaClient } from '../openfda.client';

const provenance = {
  source_name: 'FDA unit port',
  source_url: 'https://api.fda.gov/drug/ndc.json',
  query: 'test',
  fetched_at: '2026-10-12T00:00:00.000Z',
};
describe('FDA page metadata', () => {
  it('retains the source total separately from the retrieved page size', async () => {
    const http = new CachedHttpClient({ cache: createMemoryCache() });
    vi.spyOn(http, 'getJson').mockResolvedValue({
      data: { meta: { results: { total: 515 } }, results: [{ product_ndc: '0001-1' }] },
      rawBody: '{}',
      provenance,
      fromCache: false,
    });
    const result = await new OpenFdaClient(http).searchNdc({ search: 'test', limit: 100 });
    expect(result.total).toBe(515);
    expect(result.data).toHaveLength(1);
  });
  it('uses null when source total metadata is absent', async () => {
    const http = new CachedHttpClient({ cache: createMemoryCache() });
    vi.spyOn(http, 'getJson').mockResolvedValue({
      data: { meta: {}, results: [] },
      rawBody: '{}',
      provenance,
      fromCache: false,
    });
    expect((await new OpenFdaClient(http).searchNdc({ search: 'test' })).total).toBeNull();
  });
  it('preserves an empty 404 query as zero results while retaining provenance', async () => {
    const http = new CachedHttpClient({ cache: createMemoryCache() });
    vi.spyOn(http, 'getJson').mockRejectedValue(
      new ConnectorError({
        kind: 'not_found',
        sourceId: 'openfda_ndc',
        message: 'no matches',
        httpStatus: 404,
      }),
    );
    const result = await new OpenFdaClient(http).searchNdc({ search: 'test' });
    expect(result).toMatchObject({ data: [], total: 0 });
    expect(result.provenance.source_url).toContain('search=test');
  });
});
