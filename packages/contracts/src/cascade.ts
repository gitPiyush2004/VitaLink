/**
 * TRACE (spec stage 4).
 *
 * The rule this file exists to enforce: a cascade result is never "this drug is
 * at risk". It is the literal chain of hops that produced that conclusion, so
 * every claim can be walked back to the query that supports it.
 */

import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';
import { propagationPathSchema } from './graph';
import { CASCADE_MAX_DEPTH_LIMIT, SHOCK_DURATION_MAX_DAYS } from './limits';
import { provenanceSchema, quantitySchema } from './provenance';

/** A projected days-of-cover curve for one drug at one destination. */
export const coverProjectionSchema = z.object({
  /** cover(t) = inventory(t0) + incoming(t) - cumulative_demand(t) */
  days: z.array(z.number().int().min(0)),
  cover_units_low: z.array(z.number()),
  cover_units_high: z.array(z.number()),
  /** min{ t : cover(t) < safety_threshold }, as a band. Null if never breached. */
  stockout_day_band: z.object({ low: z.number(), high: z.number() }).nullable(),
  safety_threshold_units: quantitySchema,
  assumptions: z.record(z.string(), z.unknown()),
});
export type CoverProjection = z.infer<typeof coverProjectionSchema>;

export const exposedFacilitySchema = z.object({
  healthcare_facility_id: idSchema,
  label: z.string(),
  district_id: idSchema.nullable(),
  /** Share of the drug's flow through this facility, from bed count where available. */
  catchment_share: quantitySchema,
  population_served: quantitySchema,
});
export type ExposedFacility = z.infer<typeof exposedFacilitySchema>;

export const exposedDrugSchema = z.object({
  drug_id: idSchema,
  label: z.string(),
  shock_node_id: idSchema,

  /** Every path from the shock to this drug, not just the strongest one. */
  propagation_paths: z.array(propagationPathSchema).min(1),

  /**
   * exposure = sum over paths of  prod(edge weights) * decay^len
   *            * concentration_penalty(HHI) * 1/redundancy(unaffected makers)
   * Clamped to 0..1. The full expansion is on `provenance.calculation_method`.
   */
  exposure_score_0_1: quantitySchema,

  /** Days of cover at the moment of the shock, as a band. */
  cover_band_days: quantitySchema,
  cover_projection: coverProjectionSchema.nullable(),

  facilities: z.array(exposedFacilitySchema),
  population_band: quantitySchema,

  provenance: provenanceSchema,
});
export type ExposedDrug = z.infer<typeof exposedDrugSchema>;

export const cascadeStatusSchema = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']);
export type CascadeStatus = z.infer<typeof cascadeStatusSchema>;

export const cascadeRequestSchema = z.object({
  /** The graph node the shock is pinned to: a country, ingredient, facility, ... */
  shock_node_id: idSchema,
  /** Where the shock came from. Manual runs are allowed but recorded as such. */
  alert_id: idSchema.nullable(),
  /** How long the shock is assumed to last. A SCENARIO input. */
  duration_days: z.number().int().min(1).max(SHOCK_DURATION_MAX_DAYS),
  /** Per-hop attenuation. Defaults to the configured constant; overridable per run. */
  decay: z.number().min(0).max(1).optional(),
  /** Stop expanding beyond this many hops. Bounds the traversal. */
  max_depth: z.number().int().min(1).max(CASCADE_MAX_DEPTH_LIMIT).optional(),
});
export type CascadeRequest = z.infer<typeof cascadeRequestSchema>;

export const cascadeSchema = z.object({
  id: idSchema,
  status: cascadeStatusSchema,
  request: cascadeRequestSchema,
  /** Hash of the request, so an identical re-run is a cache hit, not new work. */
  input_hash: z.string(),

  exposed_drugs: z.array(exposedDrugSchema),
  /** Nodes the shock reached, in traversal order. Drives the map animation. */
  touched_node_ids: z.array(idSchema),

  started_at: isoDateTimeSchema,
  completed_at: isoDateTimeSchema.nullable(),
  error: z.string().nullable(),
  provenance: provenanceSchema,
});
export type Cascade = z.infer<typeof cascadeSchema>;
