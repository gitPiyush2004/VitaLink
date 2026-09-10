/**
 * Document -> domain mapping for the signals module.
 *
 * Split out of the repository so that file is queries and nothing else. Mapping
 * is one-directional here: the write paths build their `$set` objects inline,
 * because a signal upsert and an alert upsert set genuinely different fields and
 * a shared writer would be a union type with two dead halves.
 */

import type { Quantity } from '@vitalink/contracts';

import { toProvenance, toQuantity } from '@shared/db/mappers';

import type { ExtractionMethod } from '../domain/extraction';

import type { RawSignalDoc } from './raw-signal.model';
import type { QuarantineRecordDoc, VerifiedAlertDoc } from './verified-alert.model';

export type SignalRecord = {
  id: string;
  source: string;
  publishedAt: string;
  title: string;
  text: string;
  url: string;
  domain: string | null;
  geoHint: string | null;
  entityHint: string | null;
  contentHash: string;
  clusterId: string | null;
  category: string;
  manufacturer: string | null;
  drugOrIngredient: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  severity: number;
  insight: string;
  isPharmaSupplyRelevant: boolean;
  extractionMethod: ExtractionMethod;
  severityBasis: string;
  extractionBasis: string;
  provenance: Quantity['provenance'];
};

export type AlertRecord = {
  id: string;
  rawSignalIds: string[];
  clusterId: string;
  category: string;
  manufacturer: string | null;
  drugOrIngredient: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  severity: number;
  insight: string;
  resolvedNodeId: string | null;
  resolutionBasis: string;
  corroborations: VerifiedAlertDoc['corroborations'];
  independentSourceCount: number;
  veracity: Quantity;
  verified: boolean;
  clusterBasis: string;
  arm: string;
  firstSeenAt: string;
  provenance: Quantity['provenance'];
};

export type QuarantineRecordEntity = {
  id: string;
  clusterId: string;
  rawSignalIds: string[];
  reason: string;
  detail: string;
  extraction: QuarantineRecordDoc['extraction'];
  independentSourceCount: number;
  veracity: Quantity;
  arm: string;
  createdAt: string;
};

/** What ingestion produces for one signal, before it is clustered. */
export type SignalUpsertInput = Omit<SignalRecord, 'clusterId'>;

export function toSignalRecord(doc: RawSignalDoc): SignalRecord {
  return {
    // The external id, not the stored `_id`. Nothing above the repository has
    // any use for the org prefix — see the note in `raw-signal.model.ts`.
    id: doc.external_id,
    source: doc.source,
    publishedAt: doc.published_at.toISOString(),
    title: doc.title,
    text: doc.text,
    url: doc.url,
    domain: doc.domain,
    geoHint: doc.geo_hint,
    entityHint: doc.entity_hint,
    contentHash: doc.content_hash,
    clusterId: doc.cluster_id,
    category: doc.category,
    manufacturer: doc.manufacturer,
    drugOrIngredient: doc.drug_or_ingredient,
    locationCity: doc.location_city,
    locationCountry: doc.location_country,
    severity: doc.severity_1_5,
    insight: doc.insight,
    isPharmaSupplyRelevant: doc.is_pharma_supply_relevant,
    extractionMethod: doc.extraction_method as ExtractionMethod,
    severityBasis: doc.severity_basis,
    extractionBasis: doc.extraction_basis,
    provenance: toProvenance(doc.provenance),
  };
}

export function toAlertRecord(doc: VerifiedAlertDoc): AlertRecord {
  const veracity = toQuantity(doc.veracity);
  if (veracity === null) throw new Error(`alert ${doc._id} has no veracity`);

  return {
    id: doc._id,
    rawSignalIds: doc.raw_signal_ids,
    clusterId: doc.cluster_id,
    category: doc.category,
    manufacturer: doc.manufacturer,
    drugOrIngredient: doc.drug_or_ingredient,
    locationCity: doc.location_city,
    locationCountry: doc.location_country,
    severity: doc.severity_1_5,
    insight: doc.insight,
    resolvedNodeId: doc.resolved_node_id,
    resolutionBasis: doc.resolution_basis,
    corroborations: doc.corroborations,
    independentSourceCount: doc.independent_source_count,
    veracity,
    verified: doc.verified,
    clusterBasis: doc.cluster_basis,
    arm: doc.arm,
    firstSeenAt: doc.first_seen_at.toISOString(),
    provenance: toProvenance(doc.provenance),
  };
}

export function toQuarantineEntity(doc: QuarantineRecordDoc): QuarantineRecordEntity {
  const veracity = toQuantity(doc.veracity);
  if (veracity === null) throw new Error(`quarantine record ${doc._id} has no veracity`);

  return {
    id: doc._id,
    clusterId: doc.cluster_id,
    rawSignalIds: doc.raw_signal_ids,
    reason: doc.reason,
    detail: doc.detail,
    extraction: doc.extraction,
    independentSourceCount: doc.independent_source_count,
    veracity,
    arm: doc.arm,
    createdAt: doc.created_at.toISOString(),
  };
}
