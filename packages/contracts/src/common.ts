/**
 * Shapes that every endpoint shares: the response envelope, cursor pagination,
 * geo points, and the error body.
 *
 * These are defined once so no endpoint invents its own convention. PART 3A.6.
 */

import { z } from 'zod';

import {
  COUNTRY_CODE_LENGTH,
  ID_MAX_LENGTH,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
} from './limits';
import { provenanceSchema } from './provenance';

/** Mongo ObjectId as a hex string, or a deterministic slug id we mint ourselves. */
export const idSchema = z.string().min(1).max(ID_MAX_LENGTH);

export const isoDateTimeSchema = z.iso.datetime();

/** GeoJSON Point, so a `2dsphere` index can be used directly. */
export const geoPointSchema = z.object({
  type: z.literal('Point'),
  /** GeoJSON order is [longitude, latitude]. Getting this backwards is the classic bug. */
  coordinates: z.tuple([
    z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX),
    z.number().min(LATITUDE_MIN).max(LATITUDE_MAX),
  ]),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const placeSchema = z.object({
  name: z.string(),
  city: z.string(),
  country: z.string().length(COUNTRY_CODE_LENGTH, 'ISO 3166-1 alpha-2'),
  pincode: z.string().optional(),
  point: geoPointSchema.nullable(),
  provenance: provenanceSchema,
});
export type Place = z.infer<typeof placeSchema>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Cursor pagination, not offset pagination. Offsets skip and duplicate rows when
 * the underlying collection is being written to, which ours always is.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageMetaSchema = z.object({
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  count: z.number().int().min(0),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

// ---------------------------------------------------------------------------
// Response envelope (PART 7)
// ---------------------------------------------------------------------------

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  request_id: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function successEnvelope<T extends z.ZodTypeAny>(
  dataSchema: T,
): z.ZodObject<{ success: z.ZodLiteral<true>; data: T; meta: z.ZodOptional<z.ZodUnknown> }> {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.unknown().optional(),
  });
}

export const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
});

export type Success<T> = { success: true; data: T; meta?: unknown };
export type Failure = z.infer<typeof failureEnvelopeSchema>;
export type ApiResponse<T> = Success<T> | Failure;

/**
 * Every error the API can return. One enum so the frontend can switch on it and
 * so no endpoint invents an ad-hoc string. PART 7.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SUPPLIER_NOT_FOUND',
  'DRUG_NOT_FOUND',
  'INVALID_DISRUPTION',
  'INVALID_DURATION',
  'INSUFFICIENT_DATA',
  'MALFORMED_EVENT',
  'CARRIER_NOT_CONFIGURED',
  'CARRIER_TIMEOUT',
  'CARRIER_AUTH_FAILED',
  'NO_ELIGIBLE_CARRIER',
  'DEADLINE_UNSATISFIABLE',
  'SERVICE_UNAVAILABLE',
  'DB_FAILURE',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
