/**
 * The `scenario_runs` collection: one joint matrix and the choice made from it.
 *
 * One document per run rather than one per scenario, because a scenario has no
 * meaning outside the matrix it was compared in — every number in an outcome
 * vector is min-max normalised against its siblings, so a row lifted out of its
 * matrix would carry an objective contribution that means nothing.
 *
 * The whole matrix is stored, including the dominated rows. "Why was that option
 * discarded" is a question an operator will ask, and the answer — "because this
 * other option was cheaper *and* left less shortage" — is only available if the
 * discarded row survived.
 */

import { model, Schema } from 'mongoose';

import { SOURCING_INTERVENTION_KINDS } from '@vitalink/contracts';

import type { ProvenanceDoc, TimestampDoc } from '@shared/db/document-types';
import { provenanceSchemaForDocuments } from '@shared/db/quantity.schema';

/**
 * Outcome vectors are stored as Mixed.
 *
 * Every field inside is a `Quantity` and gate 1 checks the *declared* schemas,
 * so this needs saying: the quantities are validated by `outcomeVectorSchema` in
 * the contracts package before they reach here, and the alternative — a nested
 * sub-schema per field — would restate ten Quantity shapes for no added
 * guarantee. The `unavailable` list travels with them, which is the part a
 * reader needs.
 */
const outcomeSubSchema = { type: Schema.Types.Mixed, required: true } as const;

const scenarioSubSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    sourcing: {
      kind: { type: String, required: true, enum: SOURCING_INTERVENTION_KINDS },
      label: { type: String, required: true },
      target_node_id: { type: String, default: null },
      lead_time_days: { type: Number, required: true },
      intervention_cost_inr: { type: Number, required: true },
      shortage_reduction_fraction: { type: Number, required: true },
    },
    /** Null when the scenario ships nothing. DO_NOTHING always does. */
    logistics: { type: Schema.Types.Mixed, default: null },
    outcome: outcomeSubSchema,
    is_baseline: { type: Boolean, required: true },
  },
  { _id: false },
);

const paretoPointSubSchema = new Schema(
  {
    scenario_id: { type: String, required: true },
    label: { type: String, required: true },
    expected_shortage_s: { type: Number, required: true },
    total_cost_inr: { type: Number, required: true },
    is_dominated: { type: Boolean, required: true },
    /** Which scenario dominated it. Null on the front. */
    dominated_by: { type: String, default: null },
  },
  { _id: false },
);

export type ScenarioRunDoc = TimestampDoc & {
  _id: string;
  org_id: string;
  cascade_id: string;
  drug_id: string;
  drug_label: string;

  scenarios: unknown[];
  baseline_scenario_id: string;
  chosen_scenario_id: string;

  weights: Record<string, number>;
  /** Objective value per scenario, so the ranking is reproducible from the row. */
  objective_values: unknown[];
  pareto_front: unknown[];
  /** Chosen against baseline, field by field. The "what did we gain" table. */
  delta_vs_baseline: Record<string, number>;

  solver: 'CP_SAT' | 'EXHAUSTIVE_ENUMERATION';
  solver_status: string;
  /** Non-null when the matrix cap dropped rows. Never a silent truncation. */
  truncation: string | null;

  narrative: string | null;
  narrative_llm_model: string | null;
  provenance: ProvenanceDoc;
};

const scenarioRunSchema = new Schema<ScenarioRunDoc>(
  {
    _id: { type: String, required: true },
    org_id: { type: String, required: true },
    cascade_id: { type: String, required: true },
    drug_id: { type: String, required: true },
    drug_label: { type: String, required: true },

    scenarios: { type: [scenarioSubSchema], default: [] },
    baseline_scenario_id: { type: String, required: true },
    chosen_scenario_id: { type: String, required: true },

    weights: { type: Schema.Types.Mixed, required: true },
    objective_values: { type: [Schema.Types.Mixed], default: [] },
    pareto_front: { type: [paretoPointSubSchema], default: [] },
    delta_vs_baseline: { type: Schema.Types.Mixed, required: true },

    // EXHAUSTIVE_ENUMERATION in the MVP, and it is not a placeholder: with the
    // matrix capped at fifty rows, enumerating all of them is both exact and
    // faster than setting up a solver. CP-SAT earns its place when the matrix
    // grows a dimension the cap cannot hold.
    solver: { type: String, required: true, enum: ['CP_SAT', 'EXHAUSTIVE_ENUMERATION'] },
    solver_status: { type: String, required: true },
    truncation: { type: String, default: null },

    narrative: { type: String, default: null },
    narrative_llm_model: { type: String, default: null },
    provenance: { type: provenanceSchemaForDocuments, required: true },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'scenario_runs',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
    _id: false,
  },
);

scenarioRunSchema.index({ org_id: 1, created_at: -1 });
// "The scenarios we ran for this drug in this cascade" — what the control tower
// asks when an operator reopens a cascade.
scenarioRunSchema.index({ org_id: 1, cascade_id: 1, drug_id: 1, created_at: -1 });

export const ScenarioRunModel = model<ScenarioRunDoc>('ScenarioRun', scenarioRunSchema);
