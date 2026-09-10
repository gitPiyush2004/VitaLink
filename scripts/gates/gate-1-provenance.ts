/**
 * CI GATE 1 — provenance.
 *
 * The rule (spec Rule 1): every persisted numeric field carries provenance. In
 * practice that means every Mongoose schema field whose type is `Number` must
 * either be wrapped in a `Quantity` sub-document or be one of a small, explicitly
 * listed set of structural counts that are not measurements.
 *
 * Why a static gate as well as the zod `superRefine`: the schema check fires when
 * a value is parsed, which only helps if the code path runs. This gate fires on
 * every commit and catches a model field that nothing has exercised yet.
 */

import { join } from 'node:path';

import { collectFiles, report, violationAt, REPO_ROOT, type Violation } from './gate-lib';

const RULE =
  'Every persisted numeric field must be a Quantity (value + unit + tag + provenance), ' +
  'not a bare Number. If the field is a structural count rather than a measurement, ' +
  'add it to STRUCTURAL_COUNTS below with a comment saying why.';

/**
 * Numeric fields that are structure, not measurement, and therefore carry no
 * provenance. Each one needs a reason, and the list is meant to stay short.
 */
const STRUCTURAL_COUNTS = new Set([
  // Redundancy counts fed to the reliability model. Their provenance lives on
  // the DrugReliability document's `rate_origins`, not on each integer.
  'z_api',
  'z_plant',
  'z_line',
  // Rates passed straight through to the model; same reasoning.
  'lam_api',
  'mu_api',
  'lam_plant',
  'mu_plant',
  'lam_line',
  'mu_line',
  // Ordinal label assigned by the LLM, never multiplied into a risk figure.
  'severity_1_5',
  // Counts of things we stored ourselves, so the provenance is "we counted them".
  'independent_source_count',
  'number_of_packages',
  'carriers_attempted',
  'carriers_quoted',
  'node_count',
  'edge_count',
  // ---- Scenario runs -----------------------------------------------------
  // The sourcing intervention's three parameters. These are SCENARIO inputs —
  // the operator chose them, and the schema requires each one with no default —
  // and the run document's own `provenance` records who ran it and when. A
  // per-parameter envelope would repeat the same source three times, and the
  // outcome vector each one feeds *is* a set of Quantities.
  'lead_time_days',
  'intervention_cost_inr',
  'shortage_reduction_fraction',

  // The two Pareto axes. Both are copied off Quantities that live on the
  // scenario's own outcome vector — `expected_shortage` and the sum of
  // `intervention_cost_inr` and `logistics_cost_inr` — so wrapping them here
  // would attach a second, redundant provenance to a number that already
  // carries one. The plot needs plain numbers to place a point.
  'expected_shortage_s',
  'total_cost_inr',

  // Deterministic scoring internals; the whole computation is stored alongside.
  'value',
  'weight',
  'contribution',
  'weighted_score',
  'final_score',
  'preference_bonus',
  'confidence',
  'objective_value',
  // Package geometry as supplied in the request body.
  'l',
  'w',
  'h',
  // Curve samples; the band and the assumptions are on the parent document.
  'days',
  'cover_units_low',
  'cover_units_high',
  'low',
  'high',

  // ---- Cascade records ---------------------------------------------------
  // Path geometry. `path_weight` is the product of edge weights, each of which
  // is itself a Quantity with its own provenance, and `length` is a hop count.
  // Wrapping either would attach a second, redundant provenance to a number
  // derived entirely from numbers that already carry one.
  'path_weight',
  'length',

  // The cascade REQUEST's parameters. These are SCENARIO inputs — the operator
  // chose them — and the cascade document's own top-level `provenance` records
  // who ran it and when. A per-parameter envelope would say the same thing four
  // times.
  'duration_days',
  'decay',
  'max_depth',
  'assumed_cover_days',

  // Traversal diagnostics. We counted these ourselves during the run, so the
  // provenance is "this cascade, at this timestamp" — which the parent document
  // already states. They exist so pruning is visible rather than silent.
  'paths_pruned_by_weight',
  'paths_pruned_by_cap',
  'dropped_edges',
]);

/**
 * Matches a Mongoose field declaration whose type is Number, e.g.
 *   population: { type: Number, required: true }
 *   beds: Number
 */
const NUMBER_FIELD = /(\w+)\s*:\s*(?:\{\s*type\s*:\s*Number\b|Number\s*[,}])/g;

function checkModelFiles(): Violation[] {
  const violations: Violation[] = [];
  const modelFiles = collectFiles(join(REPO_ROOT, 'apps'), '.model.ts'.split(','));

  for (const file of modelFiles) {
    for (const match of file.text.matchAll(NUMBER_FIELD)) {
      const fieldName = match[1];
      if (fieldName === undefined || STRUCTURAL_COUNTS.has(fieldName)) continue;

      violations.push(
        violationAt(file, match.index, `field "${fieldName}" is a bare Number with no provenance`),
      );
    }
  }

  return violations;
}

/**
 * A `Quantity` sub-schema must not make `provenance` optional, because an
 * optional provenance is the same as no provenance.
 */
function checkQuantitySubSchemas(): Violation[] {
  const violations: Violation[] = [];
  const files = collectFiles(join(REPO_ROOT, 'apps'), ['.model.ts']);

  for (const file of files) {
    const pattern = /provenance\s*:\s*\{[^}]*required\s*:\s*false/g;
    for (const match of file.text.matchAll(pattern)) {
      violations.push(violationAt(file, match.index, 'provenance is declared optional'));
    }
  }

  return violations;
}

report('gate 1 — provenance', RULE, [...checkModelFiles(), ...checkQuantitySubSchemas()]);
