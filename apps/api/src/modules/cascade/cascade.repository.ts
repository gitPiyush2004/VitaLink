/**
 * The only place this module touches Mongoose.
 *
 * The interesting method is `save`. A cascade id is derived from the request
 * hash rather than generated, and the `{org_id, input_hash}` index is unique, so
 * saving the same analysis twice is an upsert rather than a duplicate. That is
 * what makes `run` idempotent without a transaction.
 */

import { randomUUID } from 'node:crypto';

import type { Quantity } from '@vitalink/contracts';
import type { Path } from '@vitalink/graph';

import { fromProvenance, fromQuantity, toProvenance, toQuantity } from '@shared/db/mappers';
import { DatabaseError } from '@shared/errors';

import type { CoverProjection } from './domain/cover-projection';
import type { ExposureBreakdown } from './domain/exposure';
import { CascadeModel, type CascadeDoc } from './models/cascade.model';

/** One exposed drug, as the service builds it and the API returns it. */
export type ExposedDrugRecord = {
  drugId: string;
  label: string;
  shockNodeId: string;
  propagationPaths: Path[];
  exposure: ExposureBreakdown;
  exposureQuantity: Quantity;
  coverBandDays: Quantity;
  coverProjection: CoverProjection;
};

export type CascadeRequestRecord = {
  shockNodeId: string;
  alertId: string | null;
  durationDays: number;
  decay: number;
  maxDepth: number;
  assumedCoverDays: number;
};

export type CascadeRecord = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  orgId: string;
  request: CascadeRequestRecord;
  inputHash: string;
  exposedDrugs: ExposedDrugRecord[];
  touchedNodeIds: string[];
  absentRelations: { rel: string; reason: string }[];
  traversalNotes: {
    pathsPrunedByWeight: number;
    pathsPrunedByCap: number;
    graphWasTruncated: boolean;
    droppedEdges: number;
  };
  startedAt: string;
  completedAt: string | null;
  error: string | null;
};

/**
 * What `save` needs. `error` is omitted as well as `id` and `status`: this
 * function only ever writes a COMPLETED cascade, and a failed run is reported to
 * the caller rather than persisted as a half-record nothing reads.
 */
export type SaveCascadeInput = Omit<
  CascadeRecord,
  'id' | 'status' | 'startedAt' | 'completedAt' | 'error'
> & {
  startedAt: Date;
  completedAt: Date;
};

/** The stored shape of one exposed drug. Declared, for the same reason as elsewhere. */
type ExposedDrugDoc = {
  drug_id: string;
  label: string;
  shock_node_id: string;
  propagation_paths: {
    hops: {
      from_node_id: string;
      to_node_id: string;
      rel: string;
      weight: number;
      from_label: string;
      to_label: string;
    }[];
    path_weight: number;
    length: number;
  }[];
  exposure_score_0_1: NonNullable<ReturnType<typeof fromQuantity>>;
  cover_band_days: NonNullable<ReturnType<typeof fromQuantity>>;
  cover_projection: {
    days: number[];
    cover_units_low: number[];
    cover_units_high: number[];
    stockout_day_band: { low: number; high: number } | null;
    assumptions: Record<string, unknown>;
  };
  facilities: unknown[];
  population_band: null;
};

/**
 * Narrows a nullable mapper result.
 *
 * `fromQuantity` is nullable because most Quantity fields are optional. These two
 * are not, and narrowing at the boundary means a missing value fails loudly here
 * instead of writing a document a reader would later see as zero.
 */
function requireQuantity(
  quantity: Quantity,
  drugId: string,
  field: string,
): NonNullable<ReturnType<typeof fromQuantity>> {
  const mapped = fromQuantity(quantity);
  if (mapped === null) throw new Error(`exposed drug ${drugId} has no ${field}`);
  return mapped;
}

/** The hops of one path, in the stored shape. Split out to keep the mappers flat. */
function toPaths(docPaths: ExposedDrugDoc['propagation_paths']): Path[] {
  return docPaths.map((path) => ({
    hops: path.hops.map((hop) => ({
      fromNodeId: hop.from_node_id,
      toNodeId: hop.to_node_id,
      rel: hop.rel as Path['hops'][number]['rel'],
      weight: hop.weight,
      fromLabel: hop.from_label,
      toLabel: hop.to_label,
    })),
    pathWeight: path.path_weight,
    length: path.length,
  }));
}

function fromExposed(exposed: ExposedDrugRecord): ExposedDrugDoc {
  const exposure = requireQuantity(exposed.exposureQuantity, exposed.drugId, 'exposure score');

  return {
    drug_id: exposed.drugId,
    label: exposed.label,
    shock_node_id: exposed.shockNodeId,
    propagation_paths: exposed.propagationPaths.map((path) => ({
      hops: path.hops.map((hop) => ({
        from_node_id: hop.fromNodeId,
        to_node_id: hop.toNodeId,
        rel: hop.rel,
        weight: hop.weight,
        from_label: hop.fromLabel,
        to_label: hop.toLabel,
      })),
      path_weight: path.pathWeight,
      length: path.length,
    })),
    exposure_score_0_1: exposure,
    cover_band_days: requireQuantity(exposed.coverBandDays, exposed.drugId, 'cover band'),
    cover_projection: {
      days: exposed.coverProjection.days,
      cover_units_low: exposed.coverProjection.coverLow,
      cover_units_high: exposed.coverProjection.coverHigh,
      stockout_day_band: exposed.coverProjection.stockoutDayBand,
      assumptions: exposed.coverProjection.assumptions,
    },
    // Both empty in the MVP: the physical layer is not ingested, and the cascade
    // record's `absent_relations` says so rather than leaving a reader to guess.
    facilities: [],
    population_band: null,
  };
}

function toExposed(doc: ExposedDrugDoc): ExposedDrugRecord {
  const exposureQuantity = toQuantity(doc.exposure_score_0_1);
  const coverBandDays = toQuantity(doc.cover_band_days);
  if (exposureQuantity === null || coverBandDays === null) {
    throw new Error(`stored drug ${doc.drug_id} is missing a required quantity`);
  }

  return {
    drugId: doc.drug_id,
    label: doc.label,
    shockNodeId: doc.shock_node_id,
    propagationPaths: toPaths(doc.propagation_paths),
    // The structured breakdown is a build-time artefact and is not stored: the
    // score and its full calculation_method are both on the Quantity, which is
    // everything a reader or a reviewer needs. The zeroed intermediate terms
    // below say "not persisted" rather than "computed as zero".
    exposure: {
      score: exposureQuantity.value,
      pathSum: 0,
      concentrationMultiplier: 0,
      redundancyDivisor: 0,
      pathCount: doc.propagation_paths.length,
      wasClamped: false,
      calculationMethod: exposureQuantity.provenance.calculation_method ?? '',
    },
    exposureQuantity,
    coverBandDays,
    coverProjection: {
      days: doc.cover_projection.days,
      coverLow: doc.cover_projection.cover_units_low,
      coverHigh: doc.cover_projection.cover_units_high,
      stockoutDayBand: doc.cover_projection.stockout_day_band,
      effectiveCoverDays: coverBandDays.value,
      assumptions: doc.cover_projection.assumptions,
      calculationMethod: coverBandDays.provenance.calculation_method ?? '',
    },
  };
}

function toRecord(doc: CascadeDoc): CascadeRecord {
  return {
    id: doc._id,
    status: doc.status,
    orgId: doc.org_id,
    request: {
      shockNodeId: doc.request.shock_node_id,
      alertId: doc.request.alert_id,
      durationDays: doc.request.duration_days,
      decay: doc.request.decay,
      maxDepth: doc.request.max_depth,
      assumedCoverDays: doc.request.assumed_cover_days,
    },
    inputHash: doc.input_hash,
    exposedDrugs: (doc.exposed_drugs as ExposedDrugDoc[]).map(toExposed),
    touchedNodeIds: doc.touched_node_ids,
    absentRelations: doc.absent_relations,
    traversalNotes: {
      pathsPrunedByWeight: doc.traversal_notes.paths_pruned_by_weight,
      pathsPrunedByCap: doc.traversal_notes.paths_pruned_by_cap,
      graphWasTruncated: doc.traversal_notes.graph_was_truncated,
      droppedEdges: doc.traversal_notes.dropped_edges,
    },
    startedAt: doc.started_at.toISOString(),
    completedAt: doc.completed_at?.toISOString() ?? null,
    error: doc.error,
  };
}

async function save(input: SaveCascadeInput): Promise<CascadeRecord> {
  const id = `cascade-${randomUUID()}`;
  const provenance = input.exposedDrugs[0]?.exposureQuantity.provenance;

  if (provenance === undefined) {
    throw new Error('a cascade with no exposed drugs has no provenance to inherit');
  }

  try {
    const doc = await CascadeModel.findOneAndUpdate(
      { org_id: input.orgId, input_hash: input.inputHash },
      {
        $set: {
          status: 'COMPLETED' as const,
          request: {
            shock_node_id: input.request.shockNodeId,
            alert_id: input.request.alertId,
            duration_days: input.request.durationDays,
            decay: input.request.decay,
            max_depth: input.request.maxDepth,
            assumed_cover_days: input.request.assumedCoverDays,
          },
          exposed_drugs: input.exposedDrugs.map(fromExposed),
          touched_node_ids: input.touchedNodeIds,
          absent_relations: input.absentRelations,
          traversal_notes: {
            paths_pruned_by_weight: input.traversalNotes.pathsPrunedByWeight,
            paths_pruned_by_cap: input.traversalNotes.pathsPrunedByCap,
            graph_was_truncated: input.traversalNotes.graphWasTruncated,
            dropped_edges: input.traversalNotes.droppedEdges,
          },
          started_at: input.startedAt,
          completed_at: input.completedAt,
          error: null,
          provenance: fromProvenance(provenance),
        },
        $setOnInsert: { _id: id, org_id: input.orgId, input_hash: input.inputHash },
      },
      { upsert: true, new: true, runValidators: true },
    )
      .lean<CascadeDoc>()
      .exec();

    if (doc === null) throw new Error('cascade upsert returned no document');
    return toRecord(doc);
  } catch (error) {
    throw new DatabaseError('saveCascade', error);
  }
}

async function findByHash(orgId: string, inputHash: string): Promise<CascadeRecord | null> {
  try {
    const doc = await CascadeModel.findOne({ org_id: orgId, input_hash: inputHash })
      .lean<CascadeDoc>()
      .exec();
    return doc === null ? null : toRecord(doc);
  } catch (error) {
    throw new DatabaseError('findCascadeByHash', error);
  }
}

async function findById(orgId: string, cascadeId: string): Promise<CascadeRecord | null> {
  try {
    // Scoped by org, not just by id: an id from another tenant must read as
    // "not found" rather than as a permission error, which would confirm it exists.
    const doc = await CascadeModel.findOne({ _id: cascadeId, org_id: orgId })
      .lean<CascadeDoc>()
      .exec();
    return doc === null ? null : toRecord(doc);
  } catch (error) {
    throw new DatabaseError('findCascadeById', error);
  }
}

async function listRecent(orgId: string, limit: number): Promise<CascadeRecord[]> {
  try {
    const docs = await CascadeModel.find({ org_id: orgId })
      .sort({ started_at: -1 })
      .limit(limit)
      .lean<CascadeDoc[]>()
      .exec();
    return docs.map(toRecord);
  } catch (error) {
    throw new DatabaseError('listRecentCascades', error);
  }
}

export type CascadeRepository = {
  save(input: SaveCascadeInput): Promise<CascadeRecord>;
  findByHash(orgId: string, inputHash: string): Promise<CascadeRecord | null>;
  findById(orgId: string, cascadeId: string): Promise<CascadeRecord | null>;
  listRecent(orgId: string, limit: number): Promise<CascadeRecord[]>;
};

export function createCascadeRepository(): CascadeRepository {
  return { save, findByHash, findById, listRecent };
}

export { toProvenance };
