import type { NominatimClient, OpenFdaClient } from '@vitalink/connectors';
import type { FeedStatus, Incident } from '@vitalink/contracts';

import { logger } from '@shared/logger';

import { latestIncidents, recallIncident, shortageIncident } from './domain/incidents';
import type { OperationsRepository } from './operations.repository';

const PAGE_SIZE = 100;
const RECALL_LIMIT = 300;
const SHORTAGE_LIMIT = 2000;
const GEOCODE_BATCH = 12;
const GEOCODE_RETRY_MS = 604_800_000; // Seven days; unsuccessful lookups do not starve new cities.
function pendingLocations(incidents: Incident[]): Incident[] {
  return incidents
    .filter((one) => {
      if (!one.location || one.location.coordinates) return false;
      const at = one.location.provenance?.fetched_at;
      return !at || Date.now() - Date.parse(at) > GEOCODE_RETRY_MS;
    })
    .sort((a, b) =>
      (a.location?.provenance?.fetched_at ?? '').localeCompare(
        b.location?.provenance?.fetched_at ?? '',
      ),
    )
    .slice(0, GEOCODE_BATCH);
}
export class OperationsIngestion {
  constructor(
    private readonly repository: OperationsRepository,
    private readonly fda: OpenFdaClient,
    private readonly geo: NominatimClient | null,
  ) {}

  async sync(): Promise<FeedStatus[]> {
    await Promise.allSettled([this.syncSource('recalls'), this.syncSource('shortages')]);
    await this.locateBatch();
    return this.repository.feeds();
  }

  private async syncSource(id: 'recalls' | 'shortages'): Promise<void> {
    const old = (await this.repository.feeds()).find((feed) => feed.id === id);
    const feed: FeedStatus = {
      id,
      label: id === 'recalls' ? 'FDA recall enforcement' : 'FDA drug shortages',
      state: 'running',
      attemptedAt: new Date().toISOString(),
      succeededAt: old?.succeededAt ?? null,
      records: old?.records ?? 0,
      changed: 0,
      error: null,
      coverage:
        id === 'recalls'
          ? 'Latest 300 recall reports, including completed/terminated records. Older events remain in saved investigations.'
          : 'Published shortage presentations across Current, Resolved and planned discontinuation statuses, up to 2,000 records. Status and presentation availability are separate.',
    };
    await this.repository.saveFeed(feed);
    try {
      const counts = await this.collect(id);
      Object.assign(feed, {
        records: counts.records,
        changed: counts.changed,
        state: 'healthy',
        succeededAt: new Date().toISOString(),
      });
      feed.coverage += retrievalCoverage(counts);
    } catch (error) {
      feed.state = 'error';
      feed.error = error instanceof Error ? error.message : 'Source unavailable';
    }
    await this.repository.saveFeed(feed);
  }

  private limit(id: 'recalls' | 'shortages'): number {
    return id === 'recalls' ? RECALL_LIMIT : SHORTAGE_LIMIT;
  }

  private async collect(id: 'recalls' | 'shortages'): Promise<{
    records: number;
    unique: number;
    changed: number;
    total: number | null;
    complete: boolean;
  }> {
    const collected: Incident[] = [];
    let changed = 0;
    const totals = new Set<number | null>();
    let exhausted = false;
    for (let skip = 0; skip < this.limit(id); skip += PAGE_SIZE) {
      const page = await this.page(id, skip);
      totals.add(page.total);
      collected.push(...page.incidents);
      if (exhaustedPage(page.incidents.length, page.total, collected.length)) {
        exhausted = true;
        break;
      }
    }
    const unique = latestIncidents(collected);
    for (const incident of unique) changed += Number(await this.repository.saveIncident(incident));
    const total = totals.size === 1 ? ([...totals][0] ?? null) : null;
    const complete = exhausted && total !== null && collected.length === total;
    // Pruning only removes a row from this bounded monitor, never its retained history or saved case.
    if (complete) {
      await this.repository.prune(
        id === 'recalls' ? 'RECALL' : 'SHORTAGE',
        unique.map((one) => one.id),
      );
    }
    return { records: collected.length, unique: unique.length, changed, total, complete };
  }

  private async page(id: 'recalls' | 'shortages', skip: number) {
    if (id === 'recalls') {
      const result = await this.fda.searchEnforcement({
        search: '_exists_:recall_number',
        sort: 'report_date:desc',
        limit: PAGE_SIZE,
        skip,
      });
      return {
        incidents: result.data.map((row) => recallIncident(row, result.provenance)),
        total: result.total,
      };
    }
    const result = await this.fda.searchShortages({
      search: '_exists_:generic_name',
      limit: PAGE_SIZE,
      skip,
    });
    return {
      incidents: result.data.map((row) => shortageIncident(row, result.provenance)),
      total: result.total,
    };
  }

  async locate(incident: Incident): Promise<Incident> {
    if (!this.geo || !incident.location || incident.location.coordinates) return incident;
    const found = await this.geo.geocode(incident.location.label);
    const first = found.data[0];
    const coordinates: [number, number] | null = first
      ? [Number(first.lon), Number(first.lat)]
      : null;
    if (coordinates && !coordinates.every(Number.isFinite)) return incident;
    const located = {
      ...incident,
      location: { ...incident.location, coordinates, provenance: found.provenance },
    };
    await this.repository.locate(located);
    return located;
  }

  private async locateBatch(): Promise<void> {
    const incidents = await this.repository.incidents();
    const pending = pendingLocations(incidents);
    let error: string | null = this.geo
      ? null
      : 'Configure a contactable NOMINATIM_USER_AGENT to enable city geocoding.';
    let changed = 0;
    for (const incident of pending) {
      try {
        const located = await this.locate(incident);
        changed += Number(Boolean(located.location?.coordinates));
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Geocoding unavailable';
        logger.warn({ err: cause }, 'City geocoding unavailable');
        break;
      }
    }
    await this.repository.saveFeed({
      id: 'geography',
      label: 'OpenStreetMap city geography',
      state: error ? 'error' : 'healthy',
      attemptedAt: new Date().toISOString(),
      succeededAt: error ? null : new Date().toISOString(),
      records: pending.length,
      changed,
      error,
      coverage:
        'Up to 12 recalling-firm cities per refresh. These points are geographic context, not manufacturing sites or delivery routes.',
    });
  }
}

function exhaustedPage(length: number, total: number | null, collected: number): boolean {
  return length < PAGE_SIZE || (total !== null && collected >= total);
}
function retrievalCoverage(counts: {
  records: number;
  unique: number;
  total: number | null;
  complete: boolean;
}): string {
  const total = counts.total === null ? 'not reported' : String(counts.total);
  return (
    ` Retrieved ${String(counts.records)} rows (${String(counts.unique)} unique identities); FDA query total: ${total}.` +
    (counts.complete
      ? ' Query exhausted; paged retrieval is not an atomic snapshot.'
      : ' Retrieval is partial or totals changed; absence is not resolution.')
  );
}
