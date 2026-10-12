import type { Incident } from '@vitalink/contracts';

export type Place = {
  id: string;
  label: string;
  coordinates: [number, number];
  incidentIds: string[];
  criticalCount: number;
};
export type RecordScope = 'all' | 'mapped' | 'unmapped' | 'place';

/** Only reported recalling-firm cities may become geographic contacts. */
export function hasMappedLocation(incident: Incident): boolean {
  const coordinates = incident.location?.coordinates;
  return Boolean(
    incident.kind === 'RECALL' &&
    coordinates &&
    coordinates.every(Number.isFinite) &&
    Math.abs(coordinates[0]) <= 180 &&
    Math.abs(coordinates[1]) <= 90,
  );
}
export function groupPlaces(incidents: Incident[]): Place[] {
  const places = new Map<string, Place>();
  for (const incident of incidents) {
    if (!hasMappedLocation(incident) || !incident.location?.coordinates) continue;
    const coordinates = incident.location.coordinates;
    const id = coordinates.join(',');
    const place = places.get(id) ?? {
      id,
      label: [incident.location.city, incident.location.country].filter(Boolean).join(', '),
      coordinates,
      incidentIds: [],
      criticalCount: 0,
    };
    if (!place.incidentIds.includes(incident.id)) {
      place.incidentIds.push(incident.id);
      if (incident.classification === 'Class I') place.criticalCount += 1;
    }
    places.set(id, place);
  }
  return [...places.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function scopeRecords(
  incidents: Incident[],
  scope: RecordScope,
  placeIds: string[],
): Incident[] {
  const ids = new Set(placeIds);
  return incidents.filter((incident) => {
    if (scope === 'mapped') return hasMappedLocation(incident);
    if (scope === 'unmapped') return !hasMappedLocation(incident);
    if (scope === 'place') return ids.has(incident.id);
    return true;
  });
}
export function sourceFreshness(feeds: { succeededAt: string | null }[]): string | null {
  const times = feeds.flatMap((feed) => {
    const time = feed.succeededAt ? Date.parse(feed.succeededAt) : NaN;
    return Number.isFinite(time) ? [time] : [];
  });
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
