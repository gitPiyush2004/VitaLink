/**
 * Request schemas for the scenario routes.
 *
 * The one rule worth stating: the sourcing list must contain **exactly one**
 * DO_NOTHING option. Every other row is reported as a delta against it, so a
 * matrix without a baseline is a list of numbers with nothing to compare them
 * to, and a matrix with two baselines has no single thing to compare against.
 * Both are rejected here rather than deeper down.
 */

import { z } from 'zod';

import { paginationQuerySchema, SOURCING_INTERVENTION_KINDS } from '@vitalink/contracts';

/** A year of lead time is a different kind of decision. */
const MAX_LEAD_TIME_DAYS = 365;
const MAX_INTERVENTION_COST_INR = 1_000_000_000;
/** Half the circumference of the earth, so any real lane fits. */
const MAX_DISTANCE_KM = 20_037;

const sourcingOptionSchema = z.object({
  kind: z.enum(SOURCING_INTERVENTION_KINDS),
  label: z.string().min(1),
  target_node_id: z.string().min(1).nullable().default(null),
  /**
   * The operator's assumptions. No defaults, deliberately: no public source
   * states how long an alternate supplier takes to qualify, what it costs, or
   * how much of a shortfall it closes. A default would be the most
   * consequential invisible number in the system.
   */
  lead_time_days: z.number().min(0).max(MAX_LEAD_TIME_DAYS),
  intervention_cost_inr: z.number().min(0).max(MAX_INTERVENTION_COST_INR),
  shortage_reduction_fraction: z.number().min(0).max(1),
});

export const runScenariosBodySchema = z
  .object({
    cascade_id: z.string().min(1),
    drug_id: z.string().min(1),
    recommendation_id: z.string().min(1),
    sourcing: z.array(sourcingOptionSchema).min(1),
    /** Null when the lane has no known distance. The CO2 term is then absent. */
    distance_km: z.number().min(0).max(MAX_DISTANCE_KM).nullable().default(null),
    /** Overrides the configured objective weights. Displayed with the answer. */
    weights: z.record(z.string(), z.number().min(0)).optional(),
  })
  .superRefine((body, ctx) => {
    const baselines = body.sourcing.filter((one) => one.kind === 'DO_NOTHING');

    if (baselines.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourcing'],
        message:
          'The sourcing list must contain exactly one DO_NOTHING option; it has ' +
          `${String(baselines.length)}. Every other scenario is reported as a delta against ` +
          'the baseline, so a matrix without one is a list of numbers with nothing to compare ' +
          'them to.',
      });
    }

    const baseline = baselines[0];
    if (baseline !== undefined && baseline.shortage_reduction_fraction !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourcing'],
        message:
          'DO_NOTHING must close 0% of the shortage. A baseline that improves the outcome is ' +
          'not a baseline, and every delta measured against it would understate what the ' +
          'interventions actually gain.',
      });
    }
  });
export type RunScenariosBody = z.infer<typeof runScenariosBodySchema>;

export const scenarioParamsSchema = z.object({ id: z.string().min(1) });
export type ScenarioParams = z.infer<typeof scenarioParamsSchema>;

export const listScenariosQuerySchema = paginationQuerySchema;
export type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
