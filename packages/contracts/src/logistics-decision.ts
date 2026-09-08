/**
 * The decision half of the logistics recommender (spec 6.6 - 6.14).
 *
 * Split out of `logistics.ts` so that "what a carrier told us" and "what we
 * decided from it" are separate files. The boundary matters: everything here is
 * computed by our own deterministic code, and none of it may ever be produced or
 * adjusted by a language model (Rule 2). The narrative field is the only place
 * prose is allowed, and every number inside that prose came from `scored`.
 */

import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';
import { carrierIdSchema, ineligibilityReasonSchema } from './enums';
import { SUB_SCORE_MAX } from './limits';
import { provenanceSchema, quantitySchema } from './provenance';

// ---------------------------------------------------------------------------
// Eligibility and scoring
// ---------------------------------------------------------------------------

export const eligibilityResultSchema = z.object({
  quote_id: idSchema,
  carrier_id: carrierIdSchema,
  is_eligible: z.boolean(),
  /** All failures, not just the first. A reader wants the whole picture. */
  failures: z.array(
    z.object({
      reason: ineligibilityReasonSchema,
      detail: z.string(),
    }),
  ),
});
export type EligibilityResult = z.infer<typeof eligibilityResultSchema>;

export const SUB_SCORE_KEYS = [
  'cost',
  'transit',
  'reliability',
  'cold_chain',
  'risk',
  'service',
] as const;
export const subScoreKeySchema = z.enum(SUB_SCORE_KEYS);
export type SubScoreKey = z.infer<typeof subScoreKeySchema>;

export const weightProfileSchema = z.object({
  name: z.string(),
  /** Must sum to 1. Enforced where profiles are loaded, and unit-tested. */
  weights: z.record(subScoreKeySchema, z.number().min(0).max(1)),
  /** Why this profile is in force, e.g. "cover_band.low = 2 days -> CRITICAL". */
  selected_because: z.string(),
});
export type WeightProfile = z.infer<typeof weightProfileSchema>;

export const subScoreSchema = z.object({
  key: subScoreKeySchema,
  /** 0..100. Deterministic. Never produced by a language model. */
  value: z.number().min(0).max(SUB_SCORE_MAX),
  weight: z.number().min(0).max(1),
  contribution: z.number(),
  /** The inputs that produced it, so the row is reproducible from the record. */
  inputs: z.record(z.string(), z.unknown()),
  /** Set when the sub-score fell back to a documented neutral value. */
  neutral_fallback_reason: z.string().nullable(),
});
export type SubScore = z.infer<typeof subScoreSchema>;

export const scoredCandidateSchema = z.object({
  quote_id: idSchema,
  carrier_id: carrierIdSchema,
  carrier_display: z.string(),
  service: z.string(),
  sub_scores: z.array(subScoreSchema),
  /** Declared and displayed. An invisible preference would be a bug. See 6.2. */
  preference_bonus: z.number(),
  preference_note: z.string().nullable(),
  final_score: z.number(),
});
export type ScoredCandidate = z.infer<typeof scoredCandidateSchema>;

export const counterfactualSchema = z.object({
  runner_up_quote_id: idSchema,
  runner_up_display: z.string(),
  runner_up_score: z.number(),
  price_delta_inr: z.number(),
  transit_delta_hours: z.number(),
  /** The arithmetic that justifies paying more, when it does. */
  cover_days_delta_band: z.object({ low: z.number(), high: z.number() }).nullable(),
  expected_shortage_delta: z.number().nullable(),
  population_delta: z.number().nullable(),
  avoided_loss_inr_delta_band: z.object({ low: z.number(), high: z.number() }).nullable(),
  verdict: z.string(),
});
export type Counterfactual = z.infer<typeof counterfactualSchema>;

export const logisticsRecommendationSchema = z.object({
  id: idSchema,
  shipment_request_id: idSchema,

  /** Null is a legitimate outcome: NO_ELIGIBLE_CARRIER is itself a finding. */
  recommended_quote_id: idSchema.nullable(),

  weight_profile: weightProfileSchema,
  /** Every carrier, including the ones that failed. Nothing is dropped. */
  eligibility: z.array(eligibilityResultSchema),
  scored: z.array(scoredCandidateSchema),
  counterfactual: counterfactualSchema.nullable(),

  /** "Recommended from 3 of 6 providers. 3 unavailable - see reasons." */
  coverage_note: z.string(),
  carriers_attempted: z.number().int().min(0),
  carriers_quoted: z.number().int().min(0),

  /** Prose only. Every number inside it came from `scored`. Rule 2. */
  narrative: z.string().nullable(),
  narrative_llm_model: z.string().nullable(),

  /** Set when a constraint change produced a newer recommendation. See 6.12. */
  superseded_by: idSchema.nullable(),
  supersedes: idSchema.nullable(),
  change_log: z.array(z.string()),

  created_at: isoDateTimeSchema,
  provenance: provenanceSchema,
});
export type LogisticsRecommendation = z.infer<typeof logisticsRecommendationSchema>;

// ---------------------------------------------------------------------------
// Tracking (schema now, ingestion in the final phase — spec 6.14)
// ---------------------------------------------------------------------------

export const shipmentTrackingEventSchema = z.object({
  id: idSchema,
  shipment_request_id: idSchema,
  carrier_id: carrierIdSchema,
  carrier_reference: z.string(),
  status_code: z.string(),
  status_text: z.string(),
  occurred_at: isoDateTimeSchema,
  location_text: z.string().nullable(),
  /** Revised ETA. When it slips past the deadline, cover is re-projected. */
  eta: isoDateTimeSchema.nullable(),
  temperature_c: quantitySchema.nullable(),
  received_via: z.enum(['poll', 'webhook']),
  provenance: provenanceSchema,
});
export type ShipmentTrackingEvent = z.infer<typeof shipmentTrackingEventSchema>;
