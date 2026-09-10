/**
 * Request schemas for the logistics routes.
 *
 * The consignment fields are **required with no defaults**, and that is the one
 * design decision in this file. A default weight would be the most consequential
 * invisible assumption in the system: a carrier prices on weight, so a defaulted
 * 100 kg would produce a real-looking price for a shipment nobody described. The
 * operator has to state it, because they are the only party who knows it.
 */

import { z } from 'zod';

import { paginationQuerySchema, URGENCY_LEVELS } from '@vitalink/contracts';

/** Above this the consignment is a full aircraft, which is a different problem. */
const MAX_WEIGHT_KG = 50_000;
const MAX_PACKAGES = 5000;
const MAX_DIMENSION_CM = 1200;
const MAX_BUDGET_INR = 100_000_000;
const MAX_POPULATION = 2_000_000_000;

const ISO_COUNTRY_CODE_LENGTH = 2;
const LONGITUDE_LIMIT = 180;
const LATITUDE_LIMIT = 90;
/**
 * The preference bonus is capped at a tenth of the score range.
 *
 * A bonus large enough to override the arithmetic would make the disclosure
 * meaningless: "preference applied, +40 points" is not a tie-break, it is a
 * decision the scoring had no part in.
 */
const MAX_PREFERENCE_BONUS = 10;

const placeBodySchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  country: z.string().length(ISO_COUNTRY_CODE_LENGTH, 'ISO 3166-1 alpha-2'),
  pincode: z.string().optional(),
  /** [lon, lat], or null when the facility has not been geocoded. */
  point: z
    .tuple([
      z.number().min(-LONGITUDE_LIMIT).max(LONGITUDE_LIMIT),
      z.number().min(-LATITUDE_LIMIT).max(LATITUDE_LIMIT),
    ])
    .nullable(),
});
export type PlaceBody = z.infer<typeof placeBodySchema>;

const consignmentSchema = z.object({
  origin: placeBodySchema,
  destination: placeBodySchema,
  hub_id_destination: z.string().min(1),
  weight_kg: z.number().positive().max(MAX_WEIGHT_KG),
  dimensions_cm: z
    .array(
      z.object({
        l: z.number().positive().max(MAX_DIMENSION_CM),
        w: z.number().positive().max(MAX_DIMENSION_CM),
        h: z.number().positive().max(MAX_DIMENSION_CM),
      }),
    )
    .min(1),
  number_of_packages: z.number().int().min(1).max(MAX_PACKAGES),
  affected_population: z.number().int().min(0).max(MAX_POPULATION).nullable().default(null),
  budget_ceiling_inr: z.number().positive().max(MAX_BUDGET_INR).nullable().default(null),
});

/**
 * The carrier preference, as an explicit map.
 *
 * Accepted from the request rather than read from a config file, so that a demo
 * cannot apply a preference the caller did not ask for. Whatever is passed here
 * appears in `preference_note` on the scored row — a preference you cannot see is
 * a bug, per `domain/score.ts`.
 */
const preferenceSchema = z
  .record(z.string(), z.number().min(-MAX_PREFERENCE_BONUS).max(MAX_PREFERENCE_BONUS))
  .optional();

export const recommendFromCascadeBodySchema = z.object({
  cascade_id: z.string().min(1),
  drug_id: z.string().min(1),
  consignment: consignmentSchema,
  preference: preferenceSchema,
  urgency_override: z.enum(URGENCY_LEVELS).optional(),
});
export type RecommendFromCascadeBody = z.infer<typeof recommendFromCascadeBodySchema>;

export const rerunBodySchema = z.object({
  /** Omit to leave unchanged; pass null to remove an existing ceiling. */
  budget_ceiling_inr: z.number().positive().max(MAX_BUDGET_INR).nullable().optional(),
  urgency_override: z.enum(URGENCY_LEVELS).optional(),
  preference: preferenceSchema,
});
export type RerunBody = z.infer<typeof rerunBodySchema>;

export const shipmentParamsSchema = z.object({ id: z.string().min(1) });
export type ShipmentParams = z.infer<typeof shipmentParamsSchema>;

export const urgencyPreviewQuerySchema = z.object({
  cascade_id: z.string().min(1),
  drug_id: z.string().min(1),
});
export type UrgencyPreviewQuery = z.infer<typeof urgencyPreviewQuerySchema>;

export const listLogisticsQuerySchema = paginationQuerySchema;
export type ListLogisticsQuery = z.infer<typeof listLogisticsQuerySchema>;
