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
import { createArchiveRepository } from './operations.archive.repository';
import { incidentRepository } from './operations.incidents.repository';

const PUBLIC = 'public-regulatory-data';
const LIST_LIMIT = 5000;
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
    ...createArchiveRepository(),
    ...feedRepository(),
    ...organisationRepository(),
    ...watchRepository(),
  };
}
export type OperationsRepository = ReturnType<typeof createOperationsRepository>;
