/**
 * Request and response schemas for the catalogue routes.
 */

import { z } from 'zod';

import { paginationQuerySchema } from '@vitalink/contracts';

/** Coerced from query strings, so `?nlem_critical=true` works as expected. */
export const listDrugsQuerySchema = paginationQuerySchema.extend({
  nlem_critical: z.coerce.boolean().default(false),
  single_source: z.coerce.boolean().default(false),
});
export type ListDrugsQuery = z.infer<typeof listDrugsQuerySchema>;

/** Long enough for the longest openFDA generic name, short enough to bound the query. */
const MIN_GENERIC_NAME_LENGTH = 2;
const MAX_GENERIC_NAME_LENGTH = 200;

export const drugParamsSchema = z.object({
  id: z.string().min(1),
});
export type DrugParams = z.infer<typeof drugParamsSchema>;

/**
 * A refresh takes a *generic name*, not a drug id.
 *
 * That is the spec's PART 5 rule made concrete: the seed config stores the query
 * that derives the drug list, not the list itself, so the universe refreshes
 * when the registry does.
 */
export const refreshDrugBodySchema = z.object({
  generic_name: z.string().min(MIN_GENERIC_NAME_LENGTH).max(MAX_GENERIC_NAME_LENGTH),
});
export type RefreshDrugBody = z.infer<typeof refreshDrugBodySchema>;
