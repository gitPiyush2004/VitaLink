/**
 * Runs the joint scenario matrix from the command line.
 *
 *   npm run decide --workspace @vitalink/api -- <cascade-id> <drug-id> <recommendation-id>
 *
 * Prints the matrix, the Pareto front, and the chosen row's objective
 * breakdown. The interesting part is the `unavailable` list on every row: it is
 * the set of outcome fields this system declines to compute, each with the
 * reason. A scenario engine can produce any number you like, and the part that
 * makes one trustworthy is the part where it says no.
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import {
  createScenariosService,
  explainObjective,
  type ScenarioRunRecord,
} from '@modules/scenarios';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

import { resolveCliOrg } from './cli-org';

const ARGV_OFFSET = 2;
const COLUMN = { label: 44, shortage: 10, cost: 14, field: 24 };
/** Leave a space between the label column and the next one. */
const LABEL_TRUNCATE = COLUMN.label - 1;
const DECIMALS = { shortage: 4, days: 1 };

/**
 * Three sourcing options, described the way an operator would.
 *
 * Every figure here is the operator's assumption — lead time, cost, and how
 * much of the shortfall the intervention closes. No public source states any of
 * them, which is why the schema requires all three with no default, and why a
 * demo has to put them somewhere visible rather than inside the engine.
 */
const SOURCING = [
  {
    kind: 'DO_NOTHING' as const,
    label: 'Do nothing',
    target_node_id: null,
    lead_time_days: 0,
    intervention_cost_inr: 0,
    shortage_reduction_fraction: 0,
  },
  {
    kind: 'REALLOCATE_FROM_HUB' as const,
    label: 'Reallocate from the Chennai hub',
    target_node_id: null,
    lead_time_days: 3,
    intervention_cost_inr: 15_000,
    shortage_reduction_fraction: 0.4,
  },
  {
    kind: 'ALTERNATE_SUPPLIER' as const,
    label: 'Buy from an already-qualified alternate supplier',
    target_node_id: null,
    lead_time_days: 12,
    intervention_cost_inr: 90_000,
    shortage_reduction_fraction: 0.85,
  },
];

async function main(): Promise<void> {
  const [cascadeId, drugId, recommendationId] = process.argv.slice(ARGV_OFFSET);

  if (cascadeId === undefined || drugId === undefined || recommendationId === undefined) {
    console.error('usage: decide <cascade-id> <drug-id> <recommendation-id>');
    console.error('  run `npm run recommend` first — the matrix needs real carrier quotes');
    process.exit(1);
  }

  await connectMongo();
  await connectRedis();

  try {
    const org = await resolveCliOrg();
    const run = await createScenariosService().run({
      orgId: org,
      cascadeId,
      drugId,
      recommendationId,
      sourcing: SOURCING.map((one) => ({
        kind: one.kind,
        label: one.label,
        targetNodeId: one.target_node_id,
        leadTimeDays: one.lead_time_days,
        interventionCostInr: one.intervention_cost_inr,
        shortageReductionFraction: one.shortage_reduction_fraction,
      })),
      // Hyderabad to Mumbai, great-circle. Supplied because the physical layer
      // is not ingested, so no lane has a routed distance.
      distanceKm: 620,
    });

    printMatrix(run);
    printFront(run);
    printChoice(run);
    printGaps(run);
  } finally {
    await disconnectMongo();
    await disconnectRedis();
  }
}

function printMatrix(run: ScenarioRunRecord): void {
  console.log(`\nSCENARIO MATRIX for ${run.drugLabel}  (${String(run.scenarios.length)} rows)\n`);
  console.log(
    `  ${'scenario'.padEnd(COLUMN.label)}${'shortage'.padStart(COLUMN.shortage)}` +
      `${'total cost'.padStart(COLUMN.cost)}   cover (days)`,
  );

  for (const scenario of run.scenarios) {
    const cover = scenario.outcome.daysOfCoverBand;
    console.log(
      `  ${scenario.label.slice(0, LABEL_TRUNCATE).padEnd(COLUMN.label)}` +
        `${scenario.outcome.expectedShortage.value.toFixed(DECIMALS.shortage).padStart(COLUMN.shortage)}` +
        `${scenario.outcome.totalCostInr.toLocaleString('en-IN').padStart(COLUMN.cost)}   ` +
        `${(cover.band?.low ?? 0).toFixed(DECIMALS.days)}-${(cover.band?.high ?? 0).toFixed(DECIMALS.days)}` +
        ` [${cover.tag}]` +
        (scenario.isBaseline ? '  <- baseline' : ''),
    );
  }

  if (run.truncation !== null) console.log(`\n  ${run.truncation}`);
  console.log('');
}

function printFront(run: ScenarioRunRecord): void {
  console.log(
    `PARETO FRONT (${String(run.paretoFront.length)} of ${String(run.scenarios.length)} rows` +
      ' — no weights, no opinion):\n',
  );

  for (const point of run.paretoFront) {
    console.log(
      `  ${point.label.slice(0, LABEL_TRUNCATE).padEnd(COLUMN.label)}` +
        `${point.expectedShortage.toFixed(DECIMALS.shortage).padStart(COLUMN.shortage)}` +
        `${point.totalCostInr.toLocaleString('en-IN').padStart(COLUMN.cost)}`,
    );
  }

  const dominated = run.scenarios.length - run.paretoFront.length;
  console.log(
    `\n  ${String(dominated)} row(s) were dominated: another option was no worse on either ` +
      'axis and better on one, so no preferences make them worth choosing.\n',
  );
}

function printChoice(run: ScenarioRunRecord): void {
  const chosen = run.scenarios.find((one) => one.id === run.chosenScenarioId);
  const scored = run.objectiveValues.find((one) => one.scenarioId === run.chosenScenarioId);
  if (chosen === undefined || scored === undefined) return;

  console.log(`CHOSEN: ${chosen.label}\n`);
  console.log(explainObjective(scored, chosen.label).join('\n'));
  console.log(`\n  solver: ${run.solverStatus}\n`);

  console.log('AGAINST THE BASELINE:\n');
  for (const [field, delta] of Object.entries(run.deltaVsBaseline)) {
    const sign = delta > 0 ? '+' : '';
    console.log(`  ${field.padEnd(COLUMN.field)}${sign}${delta.toLocaleString('en-IN')}`);
  }
  console.log('');
}

/** The fields this engine declines to compute. The most important output. */
function printGaps(run: ScenarioRunRecord): void {
  const chosen = run.scenarios.find((one) => one.id === run.chosenScenarioId);
  if (chosen === undefined) return;

  console.log('NOT COMPUTED, and why:\n');
  for (const gap of chosen.outcome.unavailable) {
    console.log(`  ${gap.field}`);
    console.log(`      ${gap.reason}\n`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
