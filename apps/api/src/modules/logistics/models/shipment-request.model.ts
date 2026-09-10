/**
 * The `shipment_requests` collection.
 *
 * Stored rather than recomputed because it is the record of what was asked. If
 * an operator raises the budget ceiling and re-runs, spec 6.12 requires the new
 * recommendation to *supersede* the old one with a change log — and that is only
 * possible if the earlier request still exists to be diffed against.
 *
 * The whole request is stored, including the derived constraints, for the same
 * reason: "why was DSV eliminated in March" is answerable from the record alone,
 * without re-reading a label that may since have changed.
 */

import { model, Schema } from 'mongoose';

import { TEMPERATURE_RANGES } from '@vitalink/contracts';

import type {
  GeoPointDoc,
  ProvenanceDoc,
  QuantityDoc,
  TimestampDoc,
} from '@shared/db/document-types';
import {
  geoPointSubSchema,
  provenanceSchemaForDocuments,
  quantitySubSchema,
} from '@shared/db/quantity.schema';

const placeSubSchema = new Schema(
  {
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    pincode: { type: String },
    point: { type: geoPointSubSchema, default: null },
    provenance: { type: provenanceSchemaForDocuments, required: true },
  },
  { _id: false },
);

type PlaceDoc = {
  name: string;
  city: string;
  country: string;
  pincode?: string;
  point: GeoPointDoc | null;
  provenance: ProvenanceDoc;
};

export type ShipmentRequestDoc = TimestampDoc & {
  _id: string;
  org_id: string;
  context: {
    disruption_id: string | null;
    cascade_id: string | null;
    drug_id: string;
    hub_id_destination: string;
    triggered_by: 'cascade' | 'manual' | 'scenario';
  } | null;
  origin: PlaceDoc;
  destination: PlaceDoc;
  product: { drug_id: string; name: string; category: string; nlem_critical: boolean };
  weight_kg: QuantityDoc;
  dimensions_cm: { l: number; w: number; h: number }[];
  volume_m3: QuantityDoc;
  number_of_packages: number;
  temperature_requirement: string;
  /** Ranges the label forbids. Carried so the gate can be re-run from the record. */
  prohibited_temperature_ranges: string[];
  required_delivery_deadline: Date;
  shipping_mode_preference: string[] | 'any';
  special_handling: string[];
  hazardous_material: boolean;
  customs_required: boolean;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  /** Every step of the derivation, so the constraints panel needs no recompute. */
  derivation: string[];
  budget_ceiling_inr: QuantityDoc | null;
  provenance: ProvenanceDoc;
};

const shipmentRequestSchema = new Schema<ShipmentRequestDoc>(
  {
    _id: { type: String, required: true },
    org_id: { type: String, required: true },
    context: {
      type: new Schema(
        {
          disruption_id: { type: String, default: null },
          cascade_id: { type: String, default: null },
          drug_id: { type: String, required: true },
          hub_id_destination: { type: String, required: true },
          triggered_by: { type: String, required: true, enum: ['cascade', 'manual', 'scenario'] },
        },
        { _id: false },
      ),
      default: null,
    },
    origin: { type: placeSubSchema, required: true },
    destination: { type: placeSubSchema, required: true },
    product: {
      drug_id: { type: String, required: true },
      name: { type: String, required: true },
      category: { type: String, required: true },
      nlem_critical: { type: Boolean, required: true },
    },
    weight_kg: { type: quantitySubSchema, required: true },
    dimensions_cm: {
      type: [
        new Schema(
          { l: { type: Number }, w: { type: Number }, h: { type: Number } },
          { _id: false },
        ),
      ],
      default: [],
    },
    volume_m3: { type: quantitySubSchema, required: true },
    number_of_packages: { type: Number, required: true },
    temperature_requirement: { type: String, required: true, enum: TEMPERATURE_RANGES },
    prohibited_temperature_ranges: { type: [String], enum: TEMPERATURE_RANGES, default: [] },
    // A Date, not a string: the gate compares instants, and a string column
    // would sort lexicographically the moment anyone wrote a query against it.
    required_delivery_deadline: { type: Date, required: true },
    shipping_mode_preference: { type: Schema.Types.Mixed, required: true },
    special_handling: { type: [String], default: [] },
    hazardous_material: { type: Boolean, required: true },
    customs_required: { type: Boolean, required: true },
    urgency: { type: String, required: true, enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] },
    derivation: { type: [String], default: [] },
    budget_ceiling_inr: { type: quantitySubSchema, default: null },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'shipment_requests',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

// The shipment list is per-org, newest first: equality field before sort field.
shipmentRequestSchema.index({ org_id: 1, created_at: -1 });
// "Which shipments came out of this cascade" is the question the control tower
// asks when an operator opens a cascade.
shipmentRequestSchema.index({ org_id: 1, 'context.cascade_id': 1 });

export const ShipmentRequestModel = model<ShipmentRequestDoc>(
  'ShipmentRequest',
  shipmentRequestSchema,
);
