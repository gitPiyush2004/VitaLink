import { z } from 'zod';

import {
  investigationSchema,
  investigationDecisionInputSchema,
  responsePlanInputSchema,
  watchSchema,
} from '@vitalink/contracts';

const MAX_ID_LENGTH = 200;
const MIN_GENERIC_LENGTH = 2;
const MAX_NOTE_LENGTH = 4000;
const MAX_DAYS = 365;
export const traceBody = z.object({
  shockNodeId: z.string().min(1).max(MAX_ID_LENGTH),
  coverDays: z.number().min(0).max(MAX_DAYS),
  durationDays: z.number().int().min(1).max(MAX_DAYS),
});
export const linkBody = z.object({ recommendationId: z.string().min(1).max(MAX_ID_LENGTH) });
export const idParams = z.object({ id: z.string().min(1).max(MAX_ID_LENGTH) });
export const createBody = z.object({ incidentId: z.string().min(1).max(MAX_ID_LENGTH) });
export const analyseBody = z.object({
  generic: z.string().trim().min(MIN_GENERIC_LENGTH).max(MAX_ID_LENGTH),
});
export const planBody = responsePlanInputSchema;
export const watchBody = watchSchema.pick({ term: true, kind: true });
export const updateBody = z
  .object({
    note: z.string().trim().min(1).max(MAX_NOTE_LENGTH).optional(),
    status: investigationSchema.shape.status.optional(),
    selectedOptionId: z.string().min(1).max(MAX_ID_LENGTH).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Supply a note, status or response selection.');

export const decisionBody = investigationDecisionInputSchema;
