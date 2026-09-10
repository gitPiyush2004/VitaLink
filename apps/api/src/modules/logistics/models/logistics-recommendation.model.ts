/**
 * The `logistics_recommendations` collection.
 *
 * ## Why the quotes are embedded rather than a second collection
 *
 * A carrier quote has no life of its own. It is only ever read as part of the
 * recommendation that scored it, it is never updated, and its value is entirely
 * as an audit record: *this* is what DSV said, at *this* instant, and this is the
 * arithmetic that turned it into a rank. Embedding makes reading a recommendation
 * one query, and — more importantly — makes it impossible for the stored
 * comparison table to drift out of step with the stored scores.
 *
 * The cost is that quotes cannot be queried across recommendations ("show me
 * every DSV quote this month"). That is a reporting question the MVP does not
 * have, and splitting the collection later is a migration rather than a redesign.
 *
 * ## Everything is stored, including the failures
 *
 * `eligibility` holds a row per carrier attempted, including the five that cannot
 * quote at all. A recommendation whose stored form contained only the winner
 * would be unauditable, and the coverage note would be unverifiable.
 */

import { model, Schema } from 'mongoose';

import { CARRIER_IDS, INELIGIBILITY_REASONS, SUB_SCORE_KEYS } from '@vitalink/contracts';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

const quoteSubSchema = new Schema(
  {
    id: { type: String, required: true },
    provider: { type: String, required: true, enum: CARRIER_IDS },
    provider_display: { type: String, required: true },
    service: { type: String, required: true },
    service_normalised: { type: String, required: true },
    /** Null, never zero. A zero price would sort to the top of a comparison. */
    price: { type: quantitySubSchema, default: null },
    currency: { type: String, required: true },
    fx: { type: Schema.Types.Mixed, default: null },
    transit_hours: { type: quantitySubSchema, default: null },
    pickup_estimate: { type: String, default: null },
    delivery_estimate: { type: String, default: null },
    temperature_control: { type: Schema.Types.Mixed, required: true },
    temperature_range_supported: { type: [String], default: [] },
    cold_chain: { type: Schema.Types.Mixed, required: true },
    gdp_compliant: { type: Schema.Types.Mixed, required: true },
    tracking_available: { type: Boolean, required: true },
    tracking_granularity: { type: String, required: true },
    quote_status: { type: String, required: true },
    unavailable_reason: { type: String, default: null },
    source: { type: String, required: true },
    /** How a LIVE_QUOTE is provable. The contract refuses one without it. */
    raw_response_ref: { type: String, default: null },
    confidence: { type: Number, required: true },
    retrieved_at: { type: String, required: true },
    provenance: { type: provenanceSchemaForDocuments, required: true },
  },
  { _id: false },
);

const subScoreSubSchema = new Schema(
  {
    key: { type: String, required: true, enum: SUB_SCORE_KEYS },
    value: { type: Number, required: true },
    weight: { type: Number, required: true },
    contribution: { type: Number, required: true },
    /** The inputs that produced it, so the row is reproducible from the record. */
    inputs: { type: Schema.Types.Mixed, default: {} },
    neutral_fallback_reason: { type: String, default: null },
  },
  { _id: false },
);

const scoredCandidateSubSchema = new Schema(
  {
    quote_id: { type: String, required: true },
    carrier_id: { type: String, required: true, enum: CARRIER_IDS },
    carrier_display: { type: String, required: true },
    service: { type: String, required: true },
    sub_scores: { type: [subScoreSubSchema], default: [] },
    weighted_score: { type: Number, required: true },
    preference_bonus: { type: Number, required: true },
    /** Non-null whenever a bonus applied. The UI is required to render it. */
    preference_note: { type: String, default: null },
    final_score: { type: Number, required: true },
  },
  { _id: false },
);

const eligibilitySubSchema = new Schema(
  {
    quote_id: { type: String, required: true },
    carrier_id: { type: String, required: true, enum: CARRIER_IDS },
    is_eligible: { type: Boolean, required: true },
    failures: {
      type: [
        new Schema(
          {
            reason: { type: String, required: true, enum: INELIGIBILITY_REASONS },
            detail: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

export type LogisticsRecommendationDoc = TimestampDoc & {
  _id: string;
  org_id: string;
  shipment_request_id: string;
  /** Null is a legitimate outcome: NO_ELIGIBLE_CARRIER is itself a finding. */
  recommended_quote_id: string | null;
  weight_profile: {
    name: string;
    weights: Record<string, number>;
    selected_because: string;
  };
  quotes: unknown[];
  eligibility: unknown[];
  scored: unknown[];
  counterfactual: {
    runner_up_quote_id: string;
    runner_up_display: string;
    runner_up_score: number;
    price_delta_inr: number;
    transit_delta_hours: number;
    verdict: string;
  } | null;
  coverage_note: string;
  carriers_attempted: number;
  carriers_quoted: number;
  narrative: string | null;
  narrative_llm_model: string | null;
  superseded_by: string | null;
  supersedes: string | null;
  change_log: string[];
  provenance: ProvenanceDoc;
};

const recommendationSchema = new Schema<LogisticsRecommendationDoc>(
  {
    _id: { type: String, required: true },
    org_id: { type: String, required: true },
    shipment_request_id: { type: String, required: true },
    recommended_quote_id: { type: String, default: null },
    weight_profile: {
      name: { type: String, required: true },
      weights: { type: Schema.Types.Mixed, required: true },
      selected_because: { type: String, required: true },
    },
    quotes: { type: [quoteSubSchema], default: [] },
    eligibility: { type: [eligibilitySubSchema], default: [] },
    scored: { type: [scoredCandidateSubSchema], default: [] },
    counterfactual: { type: Schema.Types.Mixed, default: null },
    coverage_note: { type: String, required: true },
    carriers_attempted: { type: Number, required: true },
    carriers_quoted: { type: Number, required: true },
    // Null until a narrative is generated. The model name is stored beside it so
    // a reader always knows whether prose was written by a machine, and which.
    narrative: { type: String, default: null },
    narrative_llm_model: { type: String, default: null },
    superseded_by: { type: String, default: null },
    supersedes: { type: String, default: null },
    change_log: { type: [String], default: [] },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'logistics_recommendations',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

recommendationSchema.index({ org_id: 1, created_at: -1 });
// "The current recommendation for this shipment" — the superseded ones are
// excluded by the query, not by deleting them.
recommendationSchema.index({ org_id: 1, shipment_request_id: 1, created_at: -1 });

export const LogisticsRecommendationModel = model<LogisticsRecommendationDoc>(
  'LogisticsRecommendation',
  recommendationSchema,
);

export type { QuantityDoc };
