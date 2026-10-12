/** Shared, validated snapshots for the operational investigation workspace. */
import { z } from 'zod';

import { graphEdgeSchema, graphNodeSchema } from './graph';
import { provenanceSchema, quantitySchema } from './provenance';
import { drugReliabilitySchema } from './reliability';

export const incidentSchema = z.object({
  id: z.string(),
  kind: z.enum(['RECALL', 'SHORTAGE']),
  title: z.string(),
  product: z.string(),
  company: z.string(),
  status: z.string(),
  classification: z.string().nullable(),
  reason: z.string(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  sourceUrl: z.url(),
  provenance: provenanceSchema,
  productNdcs: z.array(z.string()),
  genericNames: z.array(z.string()),
  substances: z.array(z.string()),
  lots: z.string().nullable(),
  distribution: z.string().nullable(),
  presentation: z.string().nullable(),
  availability: z.string().nullable(),
  location: z
    .object({
      label: z.string(),
      city: z.string(),
      country: z.string(),
      coordinates: z.tuple([z.number(), z.number()]).nullable(),
      precision: z.literal('recalling-firm city'),
      provenance: provenanceSchema.nullable(),
    })
    .nullable(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const feedStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  state: z.enum(['idle', 'running', 'healthy', 'error']),
  attemptedAt: z.string().nullable(),
  succeededAt: z.string().nullable(),
  records: z.number().int(),
  changed: z.number().int(),
  error: z.string().nullable(),
  coverage: z.string(),
});
export type FeedStatus = z.infer<typeof feedStatusSchema>;

export const matchSchema = z.object({
  drugId: z.string(),
  label: z.string(),
  kind: z.enum(['product', 'generic', 'ingredient', 'company']),
  reason: z.string(),
  directlyIdentified: z.boolean(),
});
export type IncidentMatch = z.infer<typeof matchSchema>;

export const analysisSchema = z.object({
  drugId: z.string(),
  drugName: z.string(),
  analysedAt: z.string(),
  match: matchSchema,
  concentration: quantitySchema.nullable(),
  labelerCount: quantitySchema.nullable(),
  storage: z.string().nullable(),
  storageText: z.string().nullable(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  reliability: drugReliabilitySchema.nullable(),
  reliabilityError: z.string().nullable(),
  historyProvenance: provenanceSchema.nullable(),
  assumptions: z.array(z.string()),
});
export type InvestigationAnalysis = z.infer<typeof analysisSchema>;

const MAX_LABEL_LENGTH = 160;
const MAX_EVIDENCE_LENGTH = 1000;
const MIN_BASIS_LENGTH = 8;
const MAX_OPTIONS = 12;
const MAX_WATCH_LENGTH = 120;
const MIN_WATCH_LENGTH = 2;
const MAX_DAYS = 365;
const MAX_COST = 1_000_000_000;
export const responseOptionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
    leadDays: z.number().finite().min(0).max(MAX_DAYS),
    additionalCoverDays: z.number().finite().min(0).max(MAX_DAYS),
    cost: z.number().finite().min(0).max(MAX_COST),
    basis: z.enum(['operator_estimate', 'documented_quote']),
    evidenceUrl: z
      .url()
      .refine((url) => /^https?:\/\//.test(url))
      .nullable(),
    evidenceNote: z.string().trim().min(1).max(MAX_EVIDENCE_LENGTH),
  })
  .superRefine((value, ctx) => {
    if (value.basis === 'documented_quote' && value.evidenceUrl === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'A documented quote requires its evidence URL.',
        path: ['evidenceUrl'],
      });
    }
  });
export const responsePlanInputSchema = z
  .object({
    currentCoverDays: z.number().finite().min(0).max(MAX_DAYS),
    disruptionDays: z.number().finite().positive().max(MAX_DAYS),
    inputBasis: z.string().trim().min(MIN_BASIS_LENGTH).max(MAX_EVIDENCE_LENGTH),
    currency: z.enum(['USD', 'INR', 'EUR', 'GBP']),
    options: z.array(responseOptionSchema).min(1).max(MAX_OPTIONS),
  })
  .superRefine((value, ctx) => {
    const ids = value.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length || ids.includes('baseline')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Option IDs must be unique and cannot be baseline.',
        path: ['options'],
      });
    }
  });
export type ResponsePlanInput = z.infer<typeof responsePlanInputSchema>;
export const responsePlanSchema = z.object({
  createdAt: z.string(),
  input: responsePlanInputSchema,
  rows: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      uncoveredDays: quantitySchema,
      cost: quantitySchema,
      dominated: z.boolean(),
      arrivesBeforeStockout: z.boolean().nullable(),
    }),
  ),
  selectedOptionId: z.string().nullable(),
});
export type ResponsePlan = z.infer<typeof responsePlanSchema>;

export const investigationSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  incidentSnapshot: incidentSchema,
  title: z.string(),
  status: z.enum(['OPEN', 'INVESTIGATING', 'ACTIONED', 'CLOSED']),
  createdAt: z.string(),
  updatedAt: z.string(),
  cascadeId: z.string().nullable().default(null),
  recommendationId: z.string().nullable().default(null),
  analysis: analysisSchema.nullable(),
  plan: responsePlanSchema.nullable(),
  notes: z.array(
    z.object({ id: z.string(), at: z.string(), author: z.string(), text: z.string() }),
  ),
  history: z.array(z.object({ at: z.string(), action: z.string(), author: z.string() })),
});
export type Investigation = z.infer<typeof investigationSchema>;

export const watchSchema = z.object({
  id: z.string(),
  term: z.string().trim().min(MIN_WATCH_LENGTH).max(MAX_WATCH_LENGTH),
  kind: z.enum(['medicine', 'company']),
  createdAt: z.string(),
});
export type Watch = z.infer<typeof watchSchema>;
