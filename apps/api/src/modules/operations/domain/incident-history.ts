/** Normalized source-fact fingerprints, independent of refresh time and geocoding. */
import { createHash } from 'node:crypto';

import type { Incident, IncidentVersion } from '@vitalink/contracts';

export function incidentFacts(incident: Incident) {
  const { updatedAt: _at, provenance: _source, location, ...facts } = incident;
  return { ...facts, location: location?.label ?? null };
}
export function incidentDigest(incident: Incident): string {
  return createHash('sha256')
    .update(JSON.stringify(incidentFacts(incident)))
    .digest('hex');
}
export function incidentVersion(
  snapshot: Incident,
  origin: IncidentVersion['origin'],
  recordedAt: string,
): IncidentVersion {
  const digest = incidentDigest(snapshot);
  const observedAt = snapshot.provenance.fetched_at;
  const id = createHash('sha256').update(`${snapshot.id}|${digest}|${observedAt}`).digest('hex');
  return { id, incidentId: snapshot.id, digest, observedAt, recordedAt, origin, snapshot };
}
