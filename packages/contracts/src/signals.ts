/**
 * SENSE and VERIFY (spec stages 1-2).
 *
 * A `RawSignal` is one item as the source published it. A `VerifiedAlert` is a
 * cluster of raw signals that survived corroboration. The link between them is
 * kept explicitly (`raw_signal_ids`) because "which two independent sources?" is
 * the first question anyone asks about an alert.
 */

import { z } from 'zod';

import { geoPointSchema, idSchema, isoDateTimeSchema } from './common';
import {
  disruptionCategorySchema,
  quarantineReasonSchema,
  signalSourceSchema,
  verificationArmSchema,
} from './enums';
import { INSIGHT_MAX_LENGTH, SEVERITY_MAX, SEVERITY_MIN } from './limits';
import { provenanceSchema, quantitySchema } from './provenance';

export const rawSignalSchema = z.object({
  id: idSchema,
  source: signalSourceSchema,
  /** When the *source* published it, not when we fetched it. */
  published_at: isoDateTimeSchema,
  title: z.string(),
  text: z.string(),
  url: z.url(),
  /** The registrable domain, used to count independent sources. */
  domain: z.string().nullable(),
  geo_hint: z.string().nullable(),
  geo_point: geoPointSchema.nullable(),
  entity_hint: z.string().nullable(),
  /** SimHash of the shingled text, for the first-pass dedupe. */
  content_hash: z.string(),
  /** Cluster this signal was assigned to by the dedupe stage. Null until clustered. */
  cluster_id: idSchema.nullable(),
  provenance: provenanceSchema,
});
export type RawSignal = z.infer<typeof rawSignalSchema>;

/**
 * What the LLM is allowed to return. Categorical and textual fields only.
 *
 * Note `severity_1_5`: it is an ordinal *label*, not a computed score, and it is
 * never multiplied into a risk figure. The numbers in this system come from
 * `reliability` and `cascade`, never from here. Rule 2.
 */
export const extractionSchema = z.object({
  category: disruptionCategorySchema,
  manufacturer: z.string().nullable(),
  drug_or_ingredient: z.string().nullable(),
  location_city: z.string().nullable(),
  location_country: z.string().nullable(),
  severity_1_5: z.number().int().min(SEVERITY_MIN).max(SEVERITY_MAX),
  insight: z.string().max(INSIGHT_MAX_LENGTH),
  /** The model's own statement of whether the text is about pharma supply at all. */
  is_pharma_supply_relevant: z.boolean(),
});
export type Extraction = z.infer<typeof extractionSchema>;

/** One corroborating hit found by the agent's follow-up queries. */
export const corroborationSchema = z.object({
  source: signalSourceSchema,
  url: z.url(),
  /** Registrable domain or agency name — the unit of "independence". */
  independence_key: z.string(),
  published_at: isoDateTimeSchema.nullable(),
  query: z.string(),
  fetched_at: isoDateTimeSchema,
});
export type Corroboration = z.infer<typeof corroborationSchema>;

export const verifiedAlertSchema = z.object({
  id: idSchema,
  raw_signal_ids: z.array(idSchema).min(1),
  cluster_id: idSchema,

  category: disruptionCategorySchema,
  manufacturer: z.string().nullable(),
  drug_or_ingredient: z.string().nullable(),
  location_city: z.string().nullable(),
  location_country: z.string().nullable(),
  severity_1_5: z.number().int().min(SEVERITY_MIN).max(SEVERITY_MAX),
  insight: z.string(),

  /** Which node in the supply graph this alert was pinned to. Null if unresolved. */
  resolved_node_id: idSchema.nullable(),

  corroborations: z.array(corroborationSchema),
  independent_source_count: z.number().int().min(0),
  /** Computed in deterministic code from independence, credibility and recency. */
  veracity: quantitySchema,
  verified: z.boolean(),

  /** Which VERIFY implementation produced this. The PART 11 ablation needs it. */
  arm: verificationArmSchema,

  first_seen_at: isoDateTimeSchema,
  provenance: provenanceSchema,
});
export type VerifiedAlert = z.infer<typeof verifiedAlertSchema>;

export const quarantineRecordSchema = z.object({
  id: idSchema,
  cluster_id: idSchema,
  raw_signal_ids: z.array(idSchema).min(1),
  reason: quarantineReasonSchema,
  /** Best-effort extraction, kept so a human can review the near-miss. */
  extraction: extractionSchema.nullable(),
  independent_source_count: z.number().int().min(0),
  veracity: quantitySchema,
  arm: verificationArmSchema,
  created_at: isoDateTimeSchema,
  provenance: provenanceSchema,
});
export type QuarantineRecord = z.infer<typeof quarantineRecordSchema>;
