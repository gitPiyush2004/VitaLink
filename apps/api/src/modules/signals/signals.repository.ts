/**
 * The only place this module touches Mongoose.
 *
 * `saveSignals` is a `bulkWrite` of upserts keyed on the derived `_id`, so
 * re-running ingestion over an overlapping window is idempotent. That property
 * is load-bearing rather than convenient: polling one feed twice must not
 * produce two signals that then satisfy the two-source rule between them.
 */

import { fromProvenance, fromQuantity } from '@shared/db/mappers';
import { DatabaseError } from '@shared/errors';

import {
  toAlertRecord,
  toQuarantineEntity,
  toSignalRecord,
  type AlertRecord,
  type QuarantineRecordEntity,
  type SignalRecord,
  type SignalUpsertInput,
} from './models/mappers';
import { RawSignalModel, type RawSignalDoc } from './models/raw-signal.model';
import {
  QuarantineRecordModel,
  VerifiedAlertModel,
  type QuarantineRecordDoc,
  type VerifiedAlertDoc,
} from './models/verified-alert.model';

export type {
  AlertRecord,
  QuarantineRecordEntity,
  SignalRecord,
  SignalUpsertInput,
} from './models/mappers';

/**
 * The stored key for one signal.
 *
 * Org-scoped, because the derived part is the *source's* identifier and is
 * therefore identical across tenants. See the note in `raw-signal.model.ts`.
 */
function storedId(orgId: string, externalId: string): string {
  return `${orgId}:${externalId}`;
}

async function saveSignals(orgId: string, signals: SignalUpsertInput[]): Promise<number> {
  if (signals.length === 0) return 0;

  try {
    const result = await RawSignalModel.bulkWrite(
      signals.map((signal) => ({
        updateOne: {
          filter: { _id: storedId(orgId, signal.id), org_id: orgId },
          update: {
            $set: {
              external_id: signal.id,
              source: signal.source,
              published_at: new Date(signal.publishedAt),
              title: signal.title,
              text: signal.text,
              url: signal.url,
              domain: signal.domain,
              geo_hint: signal.geoHint,
              geo_point: null,
              entity_hint: signal.entityHint,
              content_hash: signal.contentHash,
              category: signal.category,
              manufacturer: signal.manufacturer,
              drug_or_ingredient: signal.drugOrIngredient,
              location_city: signal.locationCity,
              location_country: signal.locationCountry,
              severity_1_5: signal.severity,
              insight: signal.insight,
              is_pharma_supply_relevant: signal.isPharmaSupplyRelevant,
              extraction_method: signal.extractionMethod,
              severity_basis: signal.severityBasis,
              extraction_basis: signal.extractionBasis,
              provenance: fromProvenance(signal.provenance),
            },
            // `cluster_id` is only set on insert, so re-ingesting a signal does
            // not detach it from the cluster it is already part of.
            $setOnInsert: { _id: storedId(orgId, signal.id), org_id: orgId, cluster_id: null },
          },
          upsert: true,
        },
      })),
    );

    return result.upsertedCount + result.modifiedCount;
  } catch (error) {
    throw new DatabaseError('saveRawSignals', error);
  }
}

/** Signals published inside the window, newest first. */
async function findRecentSignals(
  orgId: string,
  sinceIso: string,
  limit: number,
): Promise<SignalRecord[]> {
  try {
    const docs = await RawSignalModel.find({
      org_id: orgId,
      published_at: { $gte: new Date(sinceIso) },
    })
      .sort({ published_at: -1 })
      .limit(limit)
      .lean<RawSignalDoc[]>()
      .exec();

    return docs.map(toSignalRecord);
  } catch (error) {
    throw new DatabaseError('findRecentSignals', error);
  }
}

async function findSignalsByIds(orgId: string, ids: string[]): Promise<SignalRecord[]> {
  if (ids.length === 0) return [];
  try {
    const docs = await RawSignalModel.find({ org_id: orgId, external_id: { $in: ids } })
      .lean<RawSignalDoc[]>()
      .exec();
    return docs.map(toSignalRecord);
  } catch (error) {
    throw new DatabaseError('findSignalsByIds', error);
  }
}

async function assignClusters(
  orgId: string,
  assignments: { signalId: string; clusterId: string }[],
): Promise<void> {
  if (assignments.length === 0) return;

  try {
    await RawSignalModel.bulkWrite(
      assignments.map((assignment) => ({
        updateOne: {
          filter: { _id: storedId(orgId, assignment.signalId), org_id: orgId },
          update: { $set: { cluster_id: assignment.clusterId } },
        },
      })),
    );
  } catch (error) {
    throw new DatabaseError('assignClusters', error);
  }
}

export type SaveAlertInput = Omit<AlertRecord, 'id'> & { id: string };

async function saveAlert(orgId: string, alert: SaveAlertInput): Promise<AlertRecord> {
  const veracity = fromQuantity(alert.veracity);
  if (veracity === null) throw new Error('an alert cannot be stored without a veracity figure');

  try {
    const doc = await VerifiedAlertModel.findOneAndUpdate(
      { org_id: orgId, cluster_id: alert.clusterId },
      {
        $set: {
          raw_signal_ids: alert.rawSignalIds,
          category: alert.category,
          manufacturer: alert.manufacturer,
          drug_or_ingredient: alert.drugOrIngredient,
          location_city: alert.locationCity,
          location_country: alert.locationCountry,
          severity_1_5: alert.severity,
          insight: alert.insight,
          resolved_node_id: alert.resolvedNodeId,
          resolution_basis: alert.resolutionBasis,
          corroborations: alert.corroborations,
          independent_source_count: alert.independentSourceCount,
          veracity,
          verified: alert.verified,
          cluster_basis: alert.clusterBasis,
          arm: alert.arm,
          first_seen_at: new Date(alert.firstSeenAt),
          provenance: fromProvenance(alert.provenance),
        },
        $setOnInsert: { _id: alert.id, org_id: orgId, cluster_id: alert.clusterId },
      },
      { upsert: true, new: true, runValidators: true },
    )
      .lean<VerifiedAlertDoc>()
      .exec();

    if (doc === null) throw new Error('alert upsert returned no document');
    return toAlertRecord(doc);
  } catch (error) {
    throw new DatabaseError('saveAlert', error);
  }
}

async function listAlerts(orgId: string, limit: number): Promise<AlertRecord[]> {
  try {
    const docs = await VerifiedAlertModel.find({ org_id: orgId })
      .sort({ first_seen_at: -1 })
      .limit(limit)
      .lean<VerifiedAlertDoc[]>()
      .exec();
    return docs.map(toAlertRecord);
  } catch (error) {
    throw new DatabaseError('listAlerts', error);
  }
}

async function findAlert(orgId: string, id: string): Promise<AlertRecord | null> {
  try {
    const doc = await VerifiedAlertModel.findOne({ _id: id, org_id: orgId })
      .lean<VerifiedAlertDoc>()
      .exec();
    return doc === null ? null : toAlertRecord(doc);
  } catch (error) {
    throw new DatabaseError('findAlert', error);
  }
}

export type SaveQuarantineInput = Omit<QuarantineRecordEntity, 'createdAt'>;

async function saveQuarantine(
  orgId: string,
  record: SaveQuarantineInput,
): Promise<QuarantineRecordEntity> {
  const veracity = fromQuantity(record.veracity);
  if (veracity === null) {
    throw new Error('a quarantine record cannot be stored without a veracity figure');
  }

  try {
    const doc = await QuarantineRecordModel.findOneAndUpdate(
      { org_id: orgId, cluster_id: record.clusterId },
      {
        $set: {
          raw_signal_ids: record.rawSignalIds,
          reason: record.reason,
          detail: record.detail,
          extraction: record.extraction,
          independent_source_count: record.independentSourceCount,
          veracity,
          arm: record.arm,
          provenance: fromProvenance(record.veracity.provenance),
        },
        $setOnInsert: { _id: record.id, org_id: orgId, cluster_id: record.clusterId },
      },
      { upsert: true, new: true, runValidators: true },
    )
      .lean<QuarantineRecordDoc>()
      .exec();

    if (doc === null) throw new Error('quarantine upsert returned no document');
    return toQuarantineEntity(doc);
  } catch (error) {
    throw new DatabaseError('saveQuarantine', error);
  }
}

async function listQuarantine(orgId: string, limit: number): Promise<QuarantineRecordEntity[]> {
  try {
    const docs = await QuarantineRecordModel.find({ org_id: orgId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean<QuarantineRecordDoc[]>()
      .exec();
    return docs.map(toQuarantineEntity);
  } catch (error) {
    throw new DatabaseError('listQuarantine', error);
  }
}

/**
 * How many clusters were rejected, by reason.
 *
 * The quarantine view's headline number. "We saw 40 stories and could
 * corroborate 6" is the most honest single statement this system can make about
 * its own coverage, and it needs one aggregation rather than a page of rows.
 */
async function countQuarantineByReason(orgId: string): Promise<Record<string, number>> {
  try {
    const rows = await QuarantineRecordModel.aggregate<{ _id: string; count: number }>([
      { $match: { org_id: orgId } },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
    ]).exec();

    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  } catch (error) {
    throw new DatabaseError('countQuarantineByReason', error);
  }
}

export type SignalsRepository = {
  saveSignals(orgId: string, signals: SignalUpsertInput[]): Promise<number>;
  findRecentSignals(orgId: string, sinceIso: string, limit: number): Promise<SignalRecord[]>;
  findSignalsByIds(orgId: string, ids: string[]): Promise<SignalRecord[]>;
  assignClusters(
    orgId: string,
    assignments: { signalId: string; clusterId: string }[],
  ): Promise<void>;
  saveAlert(orgId: string, alert: SaveAlertInput): Promise<AlertRecord>;
  listAlerts(orgId: string, limit: number): Promise<AlertRecord[]>;
  findAlert(orgId: string, id: string): Promise<AlertRecord | null>;
  saveQuarantine(orgId: string, record: SaveQuarantineInput): Promise<QuarantineRecordEntity>;
  listQuarantine(orgId: string, limit: number): Promise<QuarantineRecordEntity[]>;
  countQuarantineByReason(orgId: string): Promise<Record<string, number>>;
};

export function createSignalsRepository(): SignalsRepository {
  return {
    saveSignals,
    findRecentSignals,
    findSignalsByIds,
    assignClusters,
    saveAlert,
    listAlerts,
    findAlert,
    saveQuarantine,
    listQuarantine,
    countQuarantineByReason,
  };
}
