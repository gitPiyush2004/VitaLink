/**
 * The `verified_alerts` and `quarantine_records` collections.
 *
 * Two collections rather than one with a `verified` flag, and the reason is that
 * they are read by different people for different reasons. An alert is
 * operational — it drives a cascade. A quarantine record is a review queue: the
 * near-misses, kept so that the rule that rejected them can be audited.
 *
 * A quarantine record is **not** a failure log. "Two independent sources could
 * not be found for this recall" is a finding about the world, and a system that
 * discarded it would be hiding the most interesting thing it knows: how much of
 * what it sees it cannot corroborate.
 */

import { model, Schema } from 'mongoose';

import { DISRUPTION_CATEGORIES, QUARANTINE_REASONS, VERIFICATION_ARMS } from '@vitalink/contracts';

import type { ProvenanceDoc, QuantityDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments, quantitySubSchema } from '@shared/db/quantity.schema';

/** One corroborating hit, with the query that found it. */
const corroborationSubSchema = new Schema(
  {
    source: { type: String, required: true },
    url: { type: String, required: true },
    /** Registrable domain or agency name — the unit of independence. */
    independence_key: { type: String, required: true },
    published_at: { type: String, default: null },
    /** The literal query, so a reader can re-run it. */
    query: { type: String, required: true },
    fetched_at: { type: String, required: true },
  },
  { _id: false },
);

type CorroborationDoc = {
  source: string;
  url: string;
  independence_key: string;
  published_at: string | null;
  query: string;
  fetched_at: string;
};

/** Fields shared by an alert and a quarantine record. */
type ExtractedFields = {
  category: string;
  manufacturer: string | null;
  drug_or_ingredient: string | null;
  location_city: string | null;
  location_country: string | null;
  severity_1_5: number;
  insight: string;
};

export type VerifiedAlertDoc = TimestampDoc &
  ExtractedFields & {
    _id: string;
    org_id: string;
    raw_signal_ids: string[];
    cluster_id: string;

    /** Which graph node this alert was pinned to. Null when unresolved. */
    resolved_node_id: string | null;
    /** How the pin was made, or why it could not be. Rendered on the alert. */
    resolution_basis: string;

    corroborations: CorroborationDoc[];
    independent_source_count: number;
    /** DERIVED. Product of independence, credibility and recency. */
    veracity: QuantityDoc;
    verified: boolean;
    /** How the cluster was formed, so "four signals" can be checked. */
    cluster_basis: string;

    arm: string;
    first_seen_at: Date;
    provenance: ProvenanceDoc;
  };

const extractedFields = {
  category: { type: String, required: true, enum: DISRUPTION_CATEGORIES },
  manufacturer: { type: String, default: null },
  drug_or_ingredient: { type: String, default: null },
  location_city: { type: String, default: null },
  location_country: { type: String, default: null },
  severity_1_5: { type: Number, required: true, min: 1, max: 5 },
  insight: { type: String, required: true },
} as const;

const verifiedAlertSchema = new Schema<VerifiedAlertDoc>(
  {
    _id: { type: String, required: true },
    org_id: { type: String, required: true },
    raw_signal_ids: { type: [String], required: true },
    cluster_id: { type: String, required: true },

    ...extractedFields,

    resolved_node_id: { type: String, default: null },
    resolution_basis: { type: String, required: true },

    corroborations: { type: [corroborationSubSchema], default: [] },
    independent_source_count: { type: Number, required: true, min: 0 },
    veracity: { type: quantitySubSchema, required: true },
    verified: { type: Boolean, required: true },
    cluster_basis: { type: String, required: true },

    arm: { type: String, required: true, enum: VERIFICATION_ARMS },
    first_seen_at: { type: Date, required: true },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'verified_alerts',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// The alert feed is per-org, newest first.
verifiedAlertSchema.index({ org_id: 1, first_seen_at: -1 });
// Re-verifying a cluster upserts rather than duplicating.
verifiedAlertSchema.index({ org_id: 1, cluster_id: 1 }, { unique: true });
// "Which alerts touch this node" is what the control tower asks when an
// operator opens a manufacturer.
verifiedAlertSchema.index({ org_id: 1, resolved_node_id: 1, first_seen_at: -1 });

export const VerifiedAlertModel = model<VerifiedAlertDoc>('VerifiedAlert', verifiedAlertSchema);

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export type QuarantineRecordDoc = TimestampDoc & {
  _id: string;
  org_id: string;
  cluster_id: string;
  raw_signal_ids: string[];
  reason: string;
  /** Human-readable detail. The reason code alone does not settle an appeal. */
  detail: string;
  /** The best-effort extraction, kept so a human can review the near-miss. */
  extraction: (ExtractedFields & { is_pharma_supply_relevant: boolean }) | null;
  independent_source_count: number;
  veracity: QuantityDoc;
  arm: string;
  provenance: ProvenanceDoc;
};

const quarantineSchema = new Schema<QuarantineRecordDoc>(
  {
    _id: { type: String, required: true },
    org_id: { type: String, required: true },
    cluster_id: { type: String, required: true },
    raw_signal_ids: { type: [String], required: true },
    reason: { type: String, required: true, enum: QUARANTINE_REASONS },
    detail: { type: String, required: true },
    extraction: { type: Schema.Types.Mixed, default: null },
    independent_source_count: { type: Number, required: true, min: 0 },
    veracity: { type: quantitySubSchema, required: true },
    arm: { type: String, required: true, enum: VERIFICATION_ARMS },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'quarantine_records',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

quarantineSchema.index({ org_id: 1, created_at: -1 });
quarantineSchema.index({ org_id: 1, cluster_id: 1 }, { unique: true });
// The quarantine view groups by reason, which is the interesting cut: "how much
// of what we see cannot be corroborated" is one query.
quarantineSchema.index({ org_id: 1, reason: 1, created_at: -1 });

export const QuarantineRecordModel = model<QuarantineRecordDoc>(
  'QuarantineRecord',
  quarantineSchema,
);
