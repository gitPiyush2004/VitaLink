import { describe, expect, it, vi } from 'vitest';

import type { OpenFdaClient, ShortageRecord } from '@vitalink/connectors';
import type { FeedStatus } from '@vitalink/contracts';

vi.mock('@shared/logger', () => ({ logger: { warn: vi.fn() } }));

import { OperationsIngestion } from '../operations.ingestion';
import type { OperationsRepository } from '../operations.repository';

const provenance = {
  source_name: 'FDA test',
  source_url: 'https://api.fda.gov/drug/shortages.json',
  query: null,
  fetched_at: '2026-10-13T00:00:00.000Z',
};
function setup(searchShortages: ReturnType<typeof vi.fn>) {
  const feeds = new Map<string, FeedStatus>([
    [
      'shortages',
      {
        id: 'shortages',
        label: 'FDA',
        state: 'healthy',
        attemptedAt: provenance.fetched_at,
        succeededAt: provenance.fetched_at,
        records: 120,
        changed: 0,
        error: null,
        coverage: 'Earlier snapshot',
      },
    ],
  ]);
  const repo = {
    feeds: vi.fn(() => Promise.resolve([...feeds.values()])),
    saveFeed: vi.fn((feed: FeedStatus) => {
      feeds.set(feed.id, { ...feed });
      return Promise.resolve();
    }),
    incidents: vi.fn().mockResolvedValue([]),
    saveIncident: vi.fn().mockResolvedValue(true),
    prune: vi.fn().mockResolvedValue(undefined),
  };
  const fda = {
    searchShortages,
    searchEnforcement: vi.fn().mockResolvedValue({ data: [], total: 0, provenance }),
  };
  const ingestion = new OperationsIngestion(
    repo as unknown as OperationsRepository,
    fda as unknown as OpenFdaClient,
    null,
  );
  return { repo, feeds, ingestion };
}
function rows(count: number, offset = 0): ShortageRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    generic_name: 'Medicine',
    company_name: 'Company',
    package_ndc: `test-${String(offset + i)}`,
    status: i % 2 === 0 ? 'Current' : 'Resolved',
    availability: 'Available',
  }));
}
describe('regulatory ingestion coverage and failure boundaries', () => {
  it('fetches all published statuses and prunes only a demonstrably exhausted query', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(100), total: 101, provenance })
      .mockResolvedValueOnce({ data: rows(1, 100), total: 101, provenance });
    const { repo, ingestion, feeds } = setup(search);
    await ingestion.sync();
    expect(search).toHaveBeenNthCalledWith(1, {
      search: '_exists_:generic_name',
      limit: 100,
      skip: 0,
    });
    expect(repo.saveIncident).toHaveBeenCalledTimes(101);
    expect(repo.saveIncident.mock.calls.some(([row]) => row.status === 'Resolved')).toBe(true);
    expect(repo.prune).toHaveBeenCalledWith('SHORTAGE', expect.any(Array));
    expect(feeds.get('shortages')?.coverage).toContain('Query exhausted');
  });
  it('keeps the last usable monitor when a later page fails instead of publishing half a refresh', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(100), total: 101, provenance })
      .mockRejectedValueOnce(new Error('FDA unavailable'));
    const { repo, ingestion, feeds } = setup(search);
    await ingestion.sync();
    expect(repo.saveIncident).not.toHaveBeenCalled();
    expect(repo.prune.mock.calls.some(([kind]) => kind === 'SHORTAGE')).toBe(false);
    expect(feeds.get('shortages')).toMatchObject({
      state: 'error',
      records: 120,
      error: 'FDA unavailable',
    });
  });
  it('retains evidence without pruning when paginated totals change', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(100), total: 101, provenance })
      .mockResolvedValueOnce({ data: rows(1, 100), total: 102, provenance });
    const { repo, ingestion, feeds } = setup(search);
    await ingestion.sync();
    expect(repo.saveIncident).toHaveBeenCalledTimes(101);
    expect(repo.prune.mock.calls.some(([kind]) => kind === 'SHORTAGE')).toBe(false);
    expect(feeds.get('shortages')?.coverage).toContain('absence is not resolution');
  });
});
