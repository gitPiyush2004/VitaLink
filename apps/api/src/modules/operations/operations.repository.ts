import { createHash } from 'node:crypto';

import {
  feedStatusSchema,
  incidentSchema,
  investigationSchema,
  watchSchema,
  type FeedStatus,
  type Incident,
  type Investigation,
  type Watch,
} from '@vitalink/contracts';

import {
  FeedModel,
  IncidentModel,
  InvestigationModel,
  WatchModel,
} from './models/operations.model';

const PUBLIC = 'public-regulatory-data';
const LIST_LIMIT = 2000;
function retainLocation(payload: Incident, prior: Incident | null): Incident['location'] {
  if (prior?.location?.provenance && payload.location?.label === prior.location.label) {
    return prior.location;
  }
  return payload.location;
}
function incidentRepository() {
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
    async saveIncident(incident: Incident): Promise<boolean> {
      const payload = incidentSchema.parse(incident);
      const { updatedAt: _at, provenance: _provenance, location, ...content } = payload;
      const digest = createHash('sha256')
        .update(JSON.stringify({ ...content, location: location?.label }))
        .digest('hex');
      const old = await IncidentModel.findById(payload.id).lean().exec();
      const changed = old?.digest !== digest;
      const prior = old ? incidentSchema.parse(old.payload) : null;
      payload.location = retainLocation(payload, prior);
      await IncidentModel.updateOne(
        { _id: payload.id },
        {
          $set: {
            org_id: PUBLIC,
            payload,
            digest,
            changed_at: changed ? new Date() : old?.changed_at,
          },
        },
        { upsert: true },
      ).exec();
      return changed;
    },
  };
}
function feedRepository() {
  return {
    async locate(incident: Incident): Promise<void> {
      await IncidentModel.updateOne(
        { _id: incident.id, org_id: PUBLIC, 'payload.location.label': incident.location?.label },
        { $set: { 'payload.location': incidentSchema.parse(incident).location } },
      ).exec();
    },
    async prune(kind: Incident['kind'], ids: string[]): Promise<void> {
      await IncidentModel.deleteMany({
        org_id: PUBLIC,
        'payload.kind': kind,
        _id: { $nin: ids },
      }).exec();
    },
    async feeds(): Promise<FeedStatus[]> {
      const docs = await FeedModel.find({ org_id: PUBLIC }).lean().exec();
      return docs.map((doc) => feedStatusSchema.parse(doc.payload));
    },
    async saveFeed(feed: FeedStatus): Promise<void> {
      await FeedModel.updateOne(
        { _id: feed.id },
        { $set: { org_id: PUBLIC, payload: feedStatusSchema.parse(feed), changed_at: new Date() } },
        { upsert: true },
      ).exec();
    },
  };
}
function organisationRepository() {
  return {
    async cases(orgId: string): Promise<Investigation[]> {
      const docs = await InvestigationModel.find({ org_id: orgId })
        .sort({ changed_at: -1 })
        .limit(LIST_LIMIT)
        .lean()
        .exec();
      return docs.map((doc) => investigationSchema.parse(doc.payload));
    },
    async case(orgId: string, id: string): Promise<Investigation | null> {
      const doc = await InvestigationModel.findOne({ _id: id, org_id: orgId }).lean().exec();
      return doc === null ? null : investigationSchema.parse(doc.payload);
    },
    async saveCase(
      orgId: string,
      record: Investigation,
      previousUpdatedAt?: string,
    ): Promise<boolean> {
      const filter = {
        _id: record.id,
        org_id: orgId,
        ...(previousUpdatedAt ? { 'payload.updatedAt': previousUpdatedAt } : {}),
      };
      const result = await InvestigationModel.updateOne(
        filter,
        {
          $set: { payload: investigationSchema.parse(record), changed_at: new Date() },
          $setOnInsert: { org_id: orgId },
        },
        { upsert: previousUpdatedAt === undefined },
      ).exec();
      return result.matchedCount > 0 || result.upsertedCount > 0;
    },
  };
}
function watchRepository() {
  return {
    async watches(orgId: string): Promise<Watch[]> {
      const docs = await WatchModel.find({ org_id: orgId })
        .sort({ changed_at: -1 })
        .limit(LIST_LIMIT)
        .lean()
        .exec();
      return docs.map((doc) => watchSchema.parse(doc.payload));
    },
    async saveWatch(orgId: string, record: Watch): Promise<void> {
      await WatchModel.updateOne(
        { _id: `${orgId}:${record.id}`, org_id: orgId },
        { $set: { payload: watchSchema.parse(record), changed_at: new Date() } },
        { upsert: true },
      ).exec();
    },
    async removeWatch(orgId: string, id: string): Promise<void> {
      await WatchModel.deleteOne({ _id: `${orgId}:${id}`, org_id: orgId }).exec();
    },
  };
}
export function createOperationsRepository() {
  return {
    ...incidentRepository(),
    ...feedRepository(),
    ...organisationRepository(),
    ...watchRepository(),
  };
}
export type OperationsRepository = ReturnType<typeof createOperationsRepository>;
