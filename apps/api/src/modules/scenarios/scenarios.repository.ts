/**
 * The only place this module touches Mongoose.
 *
 * `create` rather than an upsert: a scenario run is an immutable record of one
 * decision at one moment, and re-running with different weights is a second
 * decision rather than a correction of the first. Two runs of the same cascade
 * are two rows, and the newer one does not erase the older.
 */

import { randomUUID } from 'node:crypto';

import { fromProvenance, toProvenance } from '@shared/db/mappers';
import { DatabaseError } from '@shared/errors';

import type { Scenario } from './domain/enumerate';
import type { ParetoPoint, ScoredObjective } from './domain/pareto';
import { ScenarioRunModel, type ScenarioRunDoc } from './models/scenario-run.model';

export type ScenarioRunRecord = {
  id: string;
  cascadeId: string;
  drugId: string;
  drugLabel: string;
  scenarios: Scenario[];
  baselineScenarioId: string;
  chosenScenarioId: string;
  weights: Record<string, number>;
  objectiveValues: ScoredObjective[];
  paretoFront: ParetoPoint[];
  deltaVsBaseline: Record<string, number>;
  solver: 'CP_SAT' | 'EXHAUSTIVE_ENUMERATION';
  solverStatus: string;
  truncation: string | null;
  narrative: string | null;
  narrativeLlmModel: string | null;
  createdAt: string;
  provenance: ReturnType<typeof toProvenance>;
};

export type SaveScenarioRunInput = Omit<ScenarioRunRecord, 'id' | 'createdAt'>;

/**
 * The stored shape of one scenario. Derived from the writer, not declared twice.
 *
 * The first version cast `doc.scenarios as Scenario[]` and `doc.pareto_front as
 * ParetoPoint[]`, which compiled and was wrong: the writer stores the sourcing
 * option and the Pareto axes in snake_case, so every read produced objects whose
 * fields were all `undefined` and whose type said otherwise. The `as` was doing
 * the opposite of its job — asserting a shape instead of checking one. Hence the
 * explicit mappers below, and hence the convention they exist to follow.
 */
type StoredScenario = ReturnType<typeof fromScenario>;
type StoredParetoPoint = ReturnType<typeof fromParetoPoint>;

function toScenario(stored: StoredScenario): Scenario {
  const sourcing = stored.sourcing as Record<string, unknown>;

  return {
    id: stored.id as string,
    label: stored.label as string,
    sourcing: {
      kind: sourcing.kind as Scenario['sourcing']['kind'],
      label: sourcing.label as string,
      targetNodeId: sourcing.target_node_id as string | null,
      leadTimeDays: sourcing.lead_time_days as number,
      interventionCostInr: sourcing.intervention_cost_inr as number,
      shortageReductionFraction: sourcing.shortage_reduction_fraction as number,
    },
    // Stored as-is: `CarrierOption` and `OutcomeVector` are already camelCase,
    // because they are copied off the carrier quote and the domain's own
    // arithmetic rather than being reshaped for storage.
    logistics: stored.logistics as Scenario['logistics'],
    outcome: stored.outcome as Scenario['outcome'],
    isBaseline: stored.is_baseline as boolean,
  };
}

function toParetoPoint(stored: StoredParetoPoint): ParetoPoint {
  return {
    scenarioId: stored.scenario_id,
    label: stored.label,
    expectedShortage: stored.expected_shortage_s,
    totalCostInr: stored.total_cost_inr,
    isDominated: stored.is_dominated,
    dominatedBy: stored.dominated_by,
  };
}

function toRecord(doc: ScenarioRunDoc): ScenarioRunRecord {
  return {
    id: doc._id,
    cascadeId: doc.cascade_id,
    drugId: doc.drug_id,
    drugLabel: doc.drug_label,
    scenarios: (doc.scenarios as StoredScenario[]).map(toScenario),
    baselineScenarioId: doc.baseline_scenario_id,
    chosenScenarioId: doc.chosen_scenario_id,
    weights: doc.weights,
    // Stored in the domain's own shape, so this one needs no mapping — and it
    // is asserted rather than mapped only because the writer put it there
    // verbatim. See `objective_values` in `save`.
    objectiveValues: doc.objective_values as ScoredObjective[],
    paretoFront: (doc.pareto_front as StoredParetoPoint[]).map(toParetoPoint),
    deltaVsBaseline: doc.delta_vs_baseline,
    solver: doc.solver,
    solverStatus: doc.solver_status,
    truncation: doc.truncation,
    narrative: doc.narrative,
    narrativeLlmModel: doc.narrative_llm_model,
    createdAt: doc.created_at.toISOString(),
    provenance: toProvenance(doc.provenance),
  };
}

/** One Pareto point, in the stored shape. */
function fromParetoPoint(point: ParetoPoint): {
  scenario_id: string;
  label: string;
  expected_shortage_s: number;
  total_cost_inr: number;
  is_dominated: boolean;
  dominated_by: string | null;
} {
  return {
    scenario_id: point.scenarioId,
    label: point.label,
    expected_shortage_s: point.expectedShortage,
    total_cost_inr: point.totalCostInr,
    is_dominated: point.isDominated,
    dominated_by: point.dominatedBy,
  };
}

/** One scenario, in the stored shape. Named so the mapper is type-checked. */
function fromScenario(scenario: Scenario): Record<string, unknown> {
  return {
    id: scenario.id,
    label: scenario.label,
    sourcing: {
      kind: scenario.sourcing.kind,
      label: scenario.sourcing.label,
      target_node_id: scenario.sourcing.targetNodeId,
      lead_time_days: scenario.sourcing.leadTimeDays,
      intervention_cost_inr: scenario.sourcing.interventionCostInr,
      shortage_reduction_fraction: scenario.sourcing.shortageReductionFraction,
    },
    logistics: scenario.logistics,
    outcome: scenario.outcome,
    is_baseline: scenario.isBaseline,
  };
}

async function save(orgId: string, input: SaveScenarioRunInput): Promise<ScenarioRunRecord> {
  const id = `scenariorun-${randomUUID()}`;

  try {
    const created = await ScenarioRunModel.create({
      _id: id,
      org_id: orgId,
      cascade_id: input.cascadeId,
      drug_id: input.drugId,
      drug_label: input.drugLabel,
      scenarios: input.scenarios.map(fromScenario),
      baseline_scenario_id: input.baselineScenarioId,
      chosen_scenario_id: input.chosenScenarioId,
      weights: input.weights,
      objective_values: input.objectiveValues,
      pareto_front: input.paretoFront.map(fromParetoPoint),
      delta_vs_baseline: input.deltaVsBaseline,
      solver: input.solver,
      solver_status: input.solverStatus,
      truncation: input.truncation,
      narrative: null,
      narrative_llm_model: null,
      provenance: fromProvenance(input.provenance),
    });

    return toRecord(created.toObject<ScenarioRunDoc>());
  } catch (error) {
    throw new DatabaseError('saveScenarioRun', error);
  }
}

async function findById(orgId: string, id: string): Promise<ScenarioRunRecord | null> {
  try {
    // Scoped by org: an id from another tenant reads as "not found" rather than
    // as a permission error, which would confirm that it exists.
    const doc = await ScenarioRunModel.findOne({ _id: id, org_id: orgId })
      .lean<ScenarioRunDoc>()
      .exec();
    return doc === null ? null : toRecord(doc);
  } catch (error) {
    throw new DatabaseError('findScenarioRun', error);
  }
}

async function listRecent(orgId: string, limit: number): Promise<ScenarioRunRecord[]> {
  try {
    const docs = await ScenarioRunModel.find({ org_id: orgId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean<ScenarioRunDoc[]>()
      .exec();
    return docs.map(toRecord);
  } catch (error) {
    throw new DatabaseError('listScenarioRuns', error);
  }
}

export type ScenariosRepository = {
  save(orgId: string, input: SaveScenarioRunInput): Promise<ScenarioRunRecord>;
  findById(orgId: string, id: string): Promise<ScenarioRunRecord | null>;
  listRecent(orgId: string, limit: number): Promise<ScenarioRunRecord[]>;
};

export function createScenariosRepository(): ScenariosRepository {
  return { save, findById, listRecent };
}
