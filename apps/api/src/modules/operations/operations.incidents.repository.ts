import {
  incidentSchema,
  incidentVersionSchema,
  type Incident,
  type IncidentVersion,
} from '@vitalink/contracts';

import { incidentDigest, incidentVersion } from './domain/incident-history';
import { IncidentModel, IncidentVersionModel } from './models/operations.model';

const PUBLIC = 'public-regulatory-data';
const LIST_LIMIT = 5000;
const HISTORY_LIMIT = 100;
function retainLocation(payload: Incident, prior: Incident | null): Incident['location'] {
  if (prior?.location?.provenance && payload.location?.label === prior.location.label) {
    return prior.location;
  }
  return payload.location;
}
async function retainVersion(version: IncidentVersion): Promise<void> {
  await IncidentVersionModel.updateOne(
    { _id: version.id, org_id: PUBLIC },
    {
      $setOnInsert: {
        org_id: PUBLIC,
        payload: incidentVersionSchema.parse(version),
        changed_at: new Date(version.recordedAt),
      },
    },
    { upsert: true },
  ).exec();
}
export function incidentRepository() {
  return {
    async incidents(): Promise<Incident[]> {
      const docs = await IncidentModel.find({ org_id: PUBLIC })
        .sort({ 'payload.publishedAt': -1, _id: 1 })
        .limit(LIST_LIMIT)
        .lean()
        .exec();
      return docs.map((doc) => incidentSchema.parse(doc.payload));
    },
    async incident(id: string): Promise<Incident | null> {
      const doc = await IncidentModel.findOne({ _id: id, org_id: PUBLIC }).lean().exec();
      return doc === null ? null : incidentSchema.parse(doc.payload);
    },
    async incidentHistory(id: string) {
      const docs = await IncidentVersionModel.find({ org_id: PUBLIC, 'payload.incidentId': id })
        .sort({ 'payload.observedAt': -1, _id: 1 })
        .limit(HISTORY_LIMIT + 1)
        .lean()
        .exec();
      return {
        versions: docs
          .slice(0, HISTORY_LIMIT)
          .map((doc) => incidentVersionSchema.parse(doc.payload))
          .reverse(),
        hasMore: docs.length > HISTORY_LIMIT,
      };
    },
    saveIncident,
  };
}

async function saveIncident(incident: Incident): Promise<boolean> {
  const payload = incidentSchema.parse(incident);
  const digest = incidentDigest(payload);
  const old = await IncidentModel.findById(payload.id).lean().exec();
  const prior = old ? incidentSchema.parse(old.payload) : null;
  if (
    prior &&
    Date.parse(prior.provenance.fetched_at) > Date.parse(payload.provenance.fetched_at)
  ) {
    return false;
  }
  const changed = prior === null || incidentDigest(prior) !== digest;
  payload.location = retainLocation(payload, prior);
  await retainObservations({ payload, prior, versioned: Boolean(old?.versioned), changed });
  await IncidentModel.updateOne(
    { _id: payload.id },
    {
      $set: {
        org_id: PUBLIC,
        payload,
        digest,
        versioned: true,
        changed_at: changed ? new Date() : old?.changed_at,
      },
    },
    { upsert: true },
  ).exec();
  return changed;
}

async function retainObservations(input: {
  payload: Incident;
  prior: Incident | null;
  versioned: boolean;
  changed: boolean;
}): Promise<void> {
  const at = new Date().toISOString();
  if (input.prior && !input.versioned) {
    await retainVersion(incidentVersion(input.prior, 'retained_before_tracking', at));
  }
  if (input.changed || !input.versioned) {
    await retainVersion(incidentVersion(input.payload, 'live_refresh', at));
  }
}
