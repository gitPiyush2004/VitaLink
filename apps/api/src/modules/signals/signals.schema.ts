/**
 * Request schemas for the signals routes.
 */

import { z } from 'zod';

import { paginationQuerySchema } from '@vitalink/contracts';

export const signalParamsSchema = z.object({ id: z.string().min(1) });
export type SignalParams = z.infer<typeof signalParamsSchema>;

export const listSignalsQuerySchema = paginationQuerySchema;
export type ListSignalsQuery = z.infer<typeof listSignalsQuerySchema>;
