/**
 * The only place this module touches Mongoose.
 *
 * Mapping lives in `models/mappers.ts`; this file is queries and nothing else.
 *
 * One thing here is not a query detail. Superseding is a two-document write —
 * store the new recommendation, then flag the old one — and it is *not* wrapped
 * in a transaction. That is a deliberate MVP limitation with a chosen failure
 * mode: the writes are ordered so a crash between them leaves the new
 * recommendation stored and the old one merely un-flagged. The reverse order
 * would leave a shipment with no current recommendation at all, which is the
 * worse of the two states. Recorded in the module README.
 */

import { randomUUID } from 'node:crypto';

import type { CarrierQuote, Urgency } from '@vitalink/contracts';

import { fromProvenance, fromQuantity } from '@shared/db/mappers';
import { DatabaseError } from '@shared/errors';

import type { Recommendation } from './domain/recommend';
import {
  LogisticsRecommendationModel,
  type LogisticsRecommendationDoc,
} from './models/logistics-recommendation.model';
import {
  fromCounterfactual,
  fromPlace,
  fromQuote,
  requireQuantity,
  toRecommendationRecord,
  toShipmentRecord,
  type RecommendationRecord,
  type ShipmentRecord,
} from './models/mappers';
import { ShipmentRequestModel, type ShipmentRequestDoc } from './models/shipment-request.model';

export type { RecommendationRecord, ShipmentRecord } from './models/mappers';

async function saveShipment(orgId: string, record: ShipmentRecord): Promise<ShipmentRecord> {
  const { request } = record;

  try {
    const doc = await ShipmentRequestModel.findOneAndUpdate(
      { _id: request.id, org_id: orgId },
      {
        $set: {
          context: request.context,
          origin: fromPlace(request.origin),
          destination: fromPlace(request.destination),
          product: {
            drug_id: request.product.drug_id,
            name: request.product.name,
            category: request.product.category,
            nlem_critical: request.product.nlem_critical,
          },
          weight_kg: requireQuantity(fromQuantity(request.weight_kg), 'a weight'),
          dimensions_cm: request.dimensions_cm,
          volume_m3: requireQuantity(fromQuantity(request.volume_m3), 'a volume'),
          number_of_packages: request.number_of_packages,
          temperature_requirement: request.temperature_requirement,
          prohibited_temperature_ranges: record.prohibitedRanges,
          required_delivery_deadline: new Date(request.required_delivery_deadline),
          shipping_mode_preference: request.shipping_mode_preference,
          special_handling: request.special_handling,
          hazardous_material: request.hazardous_material,
          customs_required: request.customs_required,
          urgency: request.urgency satisfies Urgency,
          derivation: record.derivation,
          budget_ceiling_inr: fromQuantity(request.budget_ceiling_inr),
          provenance: fromProvenance(request.provenance),
        },
        $setOnInsert: { _id: request.id, org_id: orgId },
      },
      { upsert: true, new: true, runValidators: true },
    )
      .lean<ShipmentRequestDoc>()
      .exec();

    if (doc === null) throw new Error('shipment upsert returned no document');
    return toShipmentRecord(doc);
  } catch (error) {
    throw new DatabaseError('saveShipmentRequest', error);
  }
}

async function findShipment(orgId: string, shipmentId: string): Promise<ShipmentRecord | null> {
  try {
    // Scoped by org: an id from another tenant reads as "not found" rather than
    // as a permission error, which would confirm that it exists.
    const doc = await ShipmentRequestModel.findOne({ _id: shipmentId, org_id: orgId })
      .lean<ShipmentRequestDoc>()
      .exec();
    return doc === null ? null : toShipmentRecord(doc);
  } catch (error) {
    throw new DatabaseError('findShipmentRequest', error);
  }
}

async function listShipments(orgId: string, limit: number): Promise<ShipmentRecord[]> {
  try {
    const docs = await ShipmentRequestModel.find({ org_id: orgId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean<ShipmentRequestDoc[]>()
      .exec();
    return docs.map(toShipmentRecord);
  } catch (error) {
    throw new DatabaseError('listShipmentRequests', error);
  }
}

export type SaveRecommendationInput = {
  orgId: string;
  shipmentRequestId: string;
  recommendation: Recommendation;
  quotes: CarrierQuote[];
  /** Why this profile is in force. From the urgency derivation, not invented. */
  selectedBecause: string;
  supersedes: string | null;
  changeLog: string[];
  /** Injected rather than read from the clock here, so a save is reproducible. */
  at: string;
};

/**
 * One scored row, with its sub-scores and their inputs.
 *
 * The `inputs` map is stored verbatim so the breakdown is reproducible from the
 * record alone — a reviewer can re-do the arithmetic without re-running the
 * quote, which is the whole point of keeping it.
 */
function fromScoredCandidate(candidate: Recommendation['scored'][number]): Record<string, unknown> {
  return {
    quote_id: candidate.quoteId,
    carrier_id: candidate.carrierId,
    carrier_display: candidate.carrierDisplay,
    service: candidate.service,
    sub_scores: candidate.subScores.map((subScore) => ({
      key: subScore.key,
      value: subScore.value,
      weight: subScore.weight,
      contribution: subScore.contribution,
      inputs: subScore.inputs,
      neutral_fallback_reason: subScore.neutralFallbackReason,
    })),
    weighted_score: candidate.weightedScore,
    preference_bonus: candidate.preferenceBonus,
    preference_note: candidate.preferenceNote,
    final_score: candidate.finalScore,
  };
}

/**
 * The recommendation document, ready to insert.
 *
 * Separate from the insert so the mapping is readable and the query is short.
 * `create` rather than an upsert: a recommendation is an immutable record of one
 * run, and two runs of the same shipment are two rows joined by `supersedes`.
 */
function buildRecommendationDoc(
  id: string,
  input: SaveRecommendationInput,
): Record<string, unknown> {
  const { recommendation } = input;

  return {
    _id: id,
    org_id: input.orgId,
    shipment_request_id: input.shipmentRequestId,
    recommended_quote_id: recommendation.recommendedQuoteId,
    weight_profile: {
      name: recommendation.profile.name,
      weights: recommendation.profile.weights,
      selected_because: input.selectedBecause,
    },
    quotes: input.quotes.map(fromQuote),
    eligibility: recommendation.eligibility.map((one) => ({
      quote_id: one.quoteId,
      carrier_id: one.carrierId,
      is_eligible: one.result.isEligible,
      failures: one.result.failures,
    })),
    scored: recommendation.scored.map(fromScoredCandidate),
    counterfactual: fromCounterfactual(recommendation.counterfactual),
    coverage_note: recommendation.coverageNote,
    carriers_attempted: recommendation.carriersAttempted,
    carriers_quoted: recommendation.carriersQuoted,
    // Null until a narrative is generated. The model name is stored beside it so
    // a reader always knows whether prose was written by a machine, and which.
    narrative: null,
    narrative_llm_model: null,
    superseded_by: null,
    supersedes: input.supersedes,
    change_log: input.changeLog,
    provenance: fromProvenance({
      source_name: 'Vitalink logistics recommender',
      source_url: `/api/v1/logistics/recommendations/${id}`,
      query: null,
      fetched_at: input.at,
      calculation_method:
        `Weighted sum of six sub-scores under the ${recommendation.profile.name} profile, ` +
        'after the nine-rule eligibility gate. Every sub-score carries its own inputs.',
    }),
  };
}

async function saveRecommendation(input: SaveRecommendationInput): Promise<RecommendationRecord> {
  const id = `logrec-${randomUUID()}`;

  try {
    const created = await LogisticsRecommendationModel.create(buildRecommendationDoc(id, input));
    return toRecommendationRecord(created.toObject<LogisticsRecommendationDoc>());
  } catch (error) {
    throw new DatabaseError('saveRecommendation', error);
  }
}

/**
 * Flags the previous recommendation as superseded.
 *
 * Called *after* the new one is stored — see the note at the top of this file
 * about the deliberately-chosen failure mode.
 */
async function markSuperseded(orgId: string, oldId: string, newId: string): Promise<void> {
  try {
    await LogisticsRecommendationModel.updateOne(
      { _id: oldId, org_id: orgId },
      { $set: { superseded_by: newId } },
    ).exec();
  } catch (error) {
    throw new DatabaseError('markRecommendationSuperseded', error);
  }
}

async function findRecommendation(orgId: string, id: string): Promise<RecommendationRecord | null> {
  try {
    const doc = await LogisticsRecommendationModel.findOne({ _id: id, org_id: orgId })
      .lean<LogisticsRecommendationDoc>()
      .exec();
    return doc === null ? null : toRecommendationRecord(doc);
  } catch (error) {
    throw new DatabaseError('findRecommendation', error);
  }
}

/** The newest recommendation for a shipment, superseded or not. */
async function findLatestForShipment(
  orgId: string,
  shipmentRequestId: string,
): Promise<RecommendationRecord | null> {
  try {
    const doc = await LogisticsRecommendationModel.findOne({
      org_id: orgId,
      shipment_request_id: shipmentRequestId,
    })
      .sort({ created_at: -1 })
      .lean<LogisticsRecommendationDoc>()
      .exec();
    return doc === null ? null : toRecommendationRecord(doc);
  } catch (error) {
    throw new DatabaseError('findLatestRecommendation', error);
  }
}

async function listRecommendations(orgId: string, limit: number): Promise<RecommendationRecord[]> {
  try {
    const docs = await LogisticsRecommendationModel.find({ org_id: orgId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean<LogisticsRecommendationDoc[]>()
      .exec();
    return docs.map(toRecommendationRecord);
  } catch (error) {
    throw new DatabaseError('listRecommendations', error);
  }
}

export type LogisticsRepository = {
  saveShipment(orgId: string, record: ShipmentRecord): Promise<ShipmentRecord>;
  findShipment(orgId: string, shipmentId: string): Promise<ShipmentRecord | null>;
  listShipments(orgId: string, limit: number): Promise<ShipmentRecord[]>;
  saveRecommendation(input: SaveRecommendationInput): Promise<RecommendationRecord>;
  markSuperseded(orgId: string, oldId: string, newId: string): Promise<void>;
  findRecommendation(orgId: string, id: string): Promise<RecommendationRecord | null>;
  findLatestForShipment(
    orgId: string,
    shipmentRequestId: string,
  ): Promise<RecommendationRecord | null>;
  listRecommendations(orgId: string, limit: number): Promise<RecommendationRecord[]>;
};

export function createLogisticsRepository(): LogisticsRepository {
  return {
    saveShipment,
    findShipment,
    listShipments,
    saveRecommendation,
    markSuperseded,
    findRecommendation,
    findLatestForShipment,
    listRecommendations,
  };
}
