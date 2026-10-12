import type { FeedStatus, Incident, Investigation, Watch } from '@vitalink/contracts';

import { request } from '../api/client';

export type Dashboard = {
  incidents: Incident[];
  feeds: FeedStatus[];
  investigations: Investigation[];
  watches: Watch[];
  worker: { online: boolean; lastSeen: string | null };
};
export const operations = {
  dashboard: () => request<Dashboard>('/operations'),
  refresh: () => request('/operations/refresh', { method: 'POST' }),
  create: (incidentId: string) =>
    request<Investigation>('/operations/investigations', { method: 'POST', body: { incidentId } }),
  change: (id: string, body: unknown, action = '') =>
    request<Investigation>(`/operations/investigations/${encodeURIComponent(id)}${action}`, {
      method: action ? 'POST' : 'PATCH',
      body,
    }),
  watch: (term: string, kind: Watch['kind']) =>
    request<Watch>('/operations/watches', { method: 'POST', body: { term, kind } }),
  unwatch: (id: string) =>
    request(`/operations/watches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
export function dateLabel(value: string | null): string {
  return value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not available';
}
export function isWatched(incident: Incident, watches: Watch[]): boolean {
  return watches.some((watch) => {
    const text =
      watch.kind === 'company'
        ? incident.company
        : [incident.product, ...incident.genericNames, ...incident.substances].join(' ');
    const normalise = (value: string): string =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return ` ${normalise(text)} `.includes(` ${normalise(watch.term)} `);
  });
}
