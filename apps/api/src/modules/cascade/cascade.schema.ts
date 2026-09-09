/**
 * Request schemas for the cascade routes.
 */

import { z } from 'zod';

import {
  paginationQuerySchema,
  CASCADE_MAX_DEPTH_LIMIT,
  SHOCK_DURATION_MAX_DAYS,
} from '@vitalink/contracts';

/** A year of assumed cover is already implausible; two is a typo. */
const MAX_ASSUMED_COVER_DAYS = 365;

export const runCascadeBodySchema = z.object({
  shock_node_id: z.string().min(1),
  alert_id: z.string().min(1).nullable().default(null),
  duration_days: z.number().int().min(1).max(SHOCK_DURATION_MAX_DAYS),
  decay: z.number().min(0).max(1).optional(),
  max_depth: z.number().int().min(1).max(CASCADE_MAX_DEPTH_LIMIT).optional(),
  /**
   * Required, with no default.
   *
   * Deliberate: a default would make the most consequential assumption in the
   * whole projection invisible. The operator has to state it, because they are
   * the only party who knows it and no public source does.
   */
  assumed_cover_days: z.number().min(0).max(MAX_ASSUMED_COVER_DAYS),
});
export type RunCascadeBody = z.infer<typeof runCascadeBodySchema>;

export const cascadeParamsSchema = z.object({ id: z.string().min(1) });
export type CascadeParams = z.infer<typeof cascadeParamsSchema>;

export const listCascadesQuerySchema = paginationQuerySchema;
export type ListCascadesQuery = z.infer<typeof listCascadesQuerySchema>;
