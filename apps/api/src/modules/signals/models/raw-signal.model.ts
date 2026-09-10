/**
 * The `raw_signals` collection: one item exactly as its source published it.
 *
 * Stored verbatim and never rewritten. That is the point of the collection: when
 * an alert turns out to be wrong, the question is always "what did the source
 * actually say", and an interpreted copy cannot answer it.
 *
 * ## The id, and the multi-tenancy bug it caused
 *
 * `external_id` is derived from the source and the source's own identifier — the
 * recall number, the article URL. That is what makes re-running ingestion an
 * upsert rather than a duplicate, and it is load-bearing: without it, polling
 * one feed twice would produce two signals that then corroborate each other.
 *
 * The first version used that derived value as the `_id` directly, and it broke
 * the moment a second organisation ingested. `openfda_enforcement:D-0785-2026`
 * is the same string for every tenant, so the second org's insert failed on the
 * unique `_id` — and the upsert filter `{_id, org_id}` could never match the
 * first org's document, so it never became an update either. One tenant could
 * ingest and everyone else got a duplicate-key error.
 *
 * `_id` is therefore `<org>:<external id>`: unique per tenant, still derived,
 * still idempotent. The repository composes it, and nothing above the repository
 * ever sees it.
 */

import { model, Schema } from 'mongoose';

import { DISRUPTION_CATEGORIES, SIGNAL_SOURCES } from '@vitalink/contracts';

import type { GeoPointDoc, ProvenanceDoc, TimestampDoc } from '@shared/db/document-types';
import { geoPointSubSchema, provenanceSchemaForDocuments } from '@shared/db/quantity.schema';

export type RawSignalDoc = TimestampDoc & {
  /** `<org>:<external id>`. Composed by the repository; see the file header. */
  _id: string;
  org_id: string;
  /** The source's own identifier, e.g. `openfda_enforcement:D-0785-2026`. */
  external_id: string;
  source: string;
  /** When the SOURCE published it, not when we fetched it. */
  published_at: Date;
  title: string;
  text: string;
  url: string;
  /** The registrable domain. The unit of independence in VERIFY. */
  domain: string | null;
  geo_hint: string | null;
  geo_point: GeoPointDoc | null;
  entity_hint: string | null;
  /** SimHash fingerprint of the shingled text, for the dedupe first pass. */
  content_hash: string;
  cluster_id: string | null;

  /** The extraction, kept on the signal so a cluster can be re-formed from rows. */
  category: string;
  manufacturer: string | null;
  drug_or_ingredient: string | null;
  location_city: string | null;
  location_country: string | null;
  severity_1_5: number;
  insight: string;
  is_pharma_supply_relevant: boolean;
  /** STRUCTURED_FIELD, KEYWORD or LLM. Displayed next to the extracted fields. */
  extraction_method: string;
  /** Which published field the severity came from, or that it was defaulted. */
  severity_basis: string;
  extraction_basis: string;

  provenance: ProvenanceDoc;
};

const rawSignalSchema = new Schema<RawSignalDoc>(
  {
    _id: { type: String, required: true },
    org_id: { type: String, required: true },
    external_id: { type: String, required: true },
    source: { type: String, required: true, enum: SIGNAL_SOURCES },
    published_at: { type: Date, required: true },
    title: { type: String, required: true },
    text: { type: String, default: '' },
    url: { type: String, required: true },
    domain: { type: String, default: null },
    geo_hint: { type: String, default: null },
    geo_point: { type: geoPointSubSchema, default: null },
    entity_hint: { type: String, default: null },
    content_hash: { type: String, required: true },
    cluster_id: { type: String, default: null },

    category: { type: String, required: true, enum: DISRUPTION_CATEGORIES },
    manufacturer: { type: String, default: null },
    drug_or_ingredient: { type: String, default: null },
    location_city: { type: String, default: null },
    location_country: { type: String, default: null },
    // An ordinal LABEL, never multiplied into a risk figure. Spec Rule 2, and
    // the reason this field is in gate 1's structural-count list.
    severity_1_5: { type: Number, required: true, min: 1, max: 5 },
    insight: { type: String, required: true },
    is_pharma_supply_relevant: { type: Boolean, required: true },
    extraction_method: {
      type: String,
      required: true,
      enum: ['STRUCTURED_FIELD', 'KEYWORD', 'LLM'],
    },
    severity_basis: { type: String, required: true },
    extraction_basis: { type: String, required: true },

    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'raw_signals',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// The signals feed is per-org, newest published first.
rawSignalSchema.index({ org_id: 1, published_at: -1 });
// Clustering reads every unclustered signal in a window, so the null case needs
// to be an index hit rather than a collection scan.
rawSignalSchema.index({ org_id: 1, cluster_id: 1, published_at: -1 });
// The dedupe first pass looks signals up by fingerprint.
rawSignalSchema.index({ org_id: 1, content_hash: 1 });
// Alerts reference their signals by external id, so the join needs an index.
rawSignalSchema.index({ org_id: 1, external_id: 1 }, { unique: true });

export const RawSignalModel = model<RawSignalDoc>('RawSignal', rawSignalSchema);
