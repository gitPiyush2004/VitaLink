/**
 * SIMULATE and DECIDE (spec stages 6-7), extended to the joint
 * (sourcing x logistics) matrix from spec 6.11.
 *
 * A scenario is a pair: what we do about supply, and who physically moves it.
 * "Do nothing" is always present and is always the baseline every other option
 * is measured against.
 */

import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';
import { carrierIdSchema, quoteStatusSchema } from './enums';
import { provenanceSchema, quantitySchema } from './provenance';

export const SOURCING_INTERVENTION_KINDS = [
  'DO_NOTHING',
  'ALTERNATE_SUPPLIER',
  'REALLOCATE_FROM_HUB',
  'INCREASE_SAFETY_STOCK',
  'QUALIFY_SECOND_SOURCE',
] as const;
export const sourcingInterventionKindSchema = z.enum(SOURCING_INTERVENTION_KINDS);
export type SourcingInterventionKind = z.infer<typeof sourcingInterventionKindSchema>;

export const sourcingInterventionSchema = z.object({
  kind: sourcingInterventionKindSchema,
  label: z.string(),
  /** The manufacturer or hub node this intervention uses, when it names one. */
  target_node_id: idSchema.nullable(),
  /** Days before the intervention starts delivering. DERIVED where possible. */
  lead_time_days: quantitySchema,
  /** Cost of the intervention itself, excluding freight. */
  intervention_cost_inr: quantitySchema,
  /** Extra units it makes available. MODELLED, so it is a band. */
  units_added: quantitySchema,
  provenance: provenanceSchema,
});
export type SourcingIntervention = z.infer<typeof sourcingInterventionSchema>;

/** The logistics half of the pair. Null means "no shipment in this scenario". */
export const logisticsOptionSchema = z.object({
  quote_id: idSchema,
  carrier_id: carrierIdSchema,
  carrier_display: z.string(),
  service: z.string(),
  quote_status: quoteStatusSchema,
});
export type LogisticsOption = z.infer<typeof logisticsOptionSchema>;

/**
 * The outcome vector. Every scenario produces exactly these fields, so the
 * comparison table is a straight matrix and nothing is incommensurable.
 */
export const outcomeVectorSchema = z.object({
  expected_shortage_s: quantitySchema,
  fragility_index: quantitySchema,
  days_of_cover_band: quantitySchema,
  facilities_at_risk: quantitySchema,
  population_band: quantitySchema,
  loss_inr_band: quantitySchema,
  recovery_days: quantitySchema,
  criticality_weighted_impact: quantitySchema,

  /** Logistics terms. Null when the scenario ships nothing. */
  logistics_cost_inr: quantitySchema.nullable(),
  transit_hours: quantitySchema.nullable(),
  arrival_estimate: isoDateTimeSchema.nullable(),
  deadline_met: z.boolean().nullable(),
  cold_chain_excursion_prob: quantitySchema.nullable(),
  co2_kg: quantitySchema.nullable(),
  /** The weakest quote status in the scenario. Governs how the row is rendered. */
  quote_status_worst: quoteStatusSchema.nullable(),
});
export type OutcomeVector = z.infer<typeof outcomeVectorSchema>;

export const scenarioSchema = z.object({
  id: idSchema,
  cascade_id: idSchema,
  drug_id: idSchema,
  label: z.string(),
  sourcing: sourcingInterventionSchema,
  logistics: logisticsOptionSchema.nullable(),
  outcome: outcomeVectorSchema,
  /** True for the mandatory DO_NOTHING row. */
  is_baseline: z.boolean(),
  provenance: provenanceSchema,
});
export type Scenario = z.infer<typeof scenarioSchema>;

/** Weights on the objective from spec 6.11. Config, not code. */
export const objectiveWeightsSchema = z.object({
  alpha_shortage: z.number().min(0),
  beta_cost: z.number().min(0),
  gamma_recovery: z.number().min(0),
  delta_criticality: z.number().min(0),
  epsilon_co2: z.number().min(0),
});
export type ObjectiveWeights = z.infer<typeof objectiveWeightsSchema>;

export const paretoPointSchema = z.object({
  scenario_id: idSchema,
  label: z.string(),
  /** The two axes the user actually trades off. */
  expected_shortage_s: z.number(),
  total_cost_inr: z.number(),
  is_dominated: z.boolean(),
});
export type ParetoPoint = z.infer<typeof paretoPointSchema>;

export const recommendationSchema = z.object({
  id: idSchema,
  cascade_id: idSchema,
  drug_id: idSchema,

  chosen_scenario_id: idSchema,
  baseline_scenario_id: idSchema,
  objective_weights: objectiveWeightsSchema,
  /** Objective value per scenario, so the ranking is reproducible. */
  objective_values: z.array(z.object({ scenario_id: idSchema, value: z.number() })),
  pareto_front: z.array(paretoPointSchema),

  /** Chosen vs baseline, field by field. This is the "what did we gain" table. */
  delta_vs_baseline: z.record(z.string(), z.number()),

  /** Which solver produced the ranking, and whether it proved optimality. */
  solver: z.enum(['CP_SAT', 'EXHAUSTIVE_ENUMERATION']),
  solver_status: z.string(),

  narrative: z.string().nullable(),
  narrative_llm_model: z.string().nullable(),
  created_at: isoDateTimeSchema,
  provenance: provenanceSchema,
});
export type Recommendation = z.infer<typeof recommendationSchema>;
