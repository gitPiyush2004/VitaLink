/**
 * QUANTIFY (spec stage 5) — the request/response contract for the Tucker & Daskin
 * series-parallel reliability model, arXiv:2107.09167.
 *
 * The maths lives in apps/brain/app/domain/reliability.py, not here. This file is
 * only the wire format, mirrored as pydantic in apps/brain/app/schemas.py and
 * checked for drift by a contract test.
 */

import { z } from 'zod';

import { idSchema } from './common';
import { provenanceSchema, quantitySchema } from './provenance';

/**
 * Redundancy counts and failure/repair rates for one drug.
 *
 * Naming follows the paper so a reader can hold the code and the paper side by
 * side: z_* are redundancy counts, lam_* are failure rates (per year), mu_* are
 * repair rates (per year).
 */
export const reliabilityInputSchema = z.object({
  drug_id: idSchema,

  /** Caller-supplied API redundancy. FDA labelers cannot establish independent API suppliers. */
  z_api: z.number().int().min(1),
  /** Caller-supplied plant redundancy; the operations workflow uses a labeler-concentration proxy. */
  z_plant: z.number().int().min(1),
  /** Production lines per plant. Not public anywhere; defaults to 1 as a SCENARIO. */
  z_line: z.number().int().min(1),

  lam_api: z.number().positive(),
  mu_api: z.number().positive(),
  lam_plant: z.number().positive(),
  mu_plant: z.number().positive(),
  lam_line: z.number().positive(),
  mu_line: z.number().positive(),
});
export type ReliabilityInput = z.infer<typeof reliabilityInputSchema>;

/** Where each rate came from — a fitted value, or the paper's documented fallback. */
export const rateOriginSchema = z.enum(['FITTED_FROM_HISTORY', 'PAPER_BASELINE_FALLBACK']);
export type RateOrigin = z.infer<typeof rateOriginSchema>;

export const rateProvenanceSchema = z.object({
  lam_api: rateOriginSchema,
  mu_api: rateOriginSchema,
  lam_plant: rateOriginSchema,
  mu_plant: rateOriginSchema,
  lam_line: rateOriginSchema,
  mu_line: rateOriginSchema,
  /** How many historical events each fit was based on. Shown next to the number. */
  event_counts: z.record(z.string(), z.number().int().min(0)),
});
export type RateProvenance = z.infer<typeof rateProvenanceSchema>;

export const drugReliabilitySchema = z.object({
  drug_id: idSchema,

  input: reliabilityInputSchema,
  rate_origins: rateProvenanceSchema,

  /** r_api = 1 - p_api^z_api  (paper eq. 2) */
  r_api: quantitySchema,
  /** r_pl = 1 - [p_p + (1 - p_p) p_l^z_l]^z_p  (paper eq. 3) */
  r_pl: quantitySchema,
  /** r = r_api * r_pl  (paper eq. 4) */
  r: quantitySchema,
  /** s = 1 - r. The expected fraction of time the drug is in shortage. */
  expected_shortage_s: quantitySchema,

  /** Mean uptime in years (paper eq. 5). */
  mean_time_to_failure_years: quantitySchema,
  /** Mean downtime in years (paper eq. 6). */
  mean_time_to_recovery_years: quantitySchema,

  /** The headline 0-100 metric. Literally 100 * s. */
  fragility_index_0_100: quantitySchema,

  computed_at: z.iso.datetime(),
  /** Every assumption that is not in the data, restated on the record itself. */
  assumptions: z.record(z.string(), z.unknown()),
  provenance: provenanceSchema,
});
export type DrugReliability = z.infer<typeof drugReliabilitySchema>;

/**
 * The rupee figure, reported honestly.
 *
 * `unit_price_inr` is REAL from NPPA. Everything else is MODELLED, so the result
 * is a band and the assumptions are attached.
 */
export const lossEstimateSchema = z.object({
  drug_id: idSchema,
  expected_shortage_s: quantitySchema,
  units_at_risk: quantitySchema,
  unit_price_inr: quantitySchema,
  loss_inr: quantitySchema,
  provenance: provenanceSchema,
});
export type LossEstimate = z.infer<typeof lossEstimateSchema>;
