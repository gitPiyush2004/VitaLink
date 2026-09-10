/**
 * Runs SENSE and VERIFY from the command line, against the live feeds.
 *
 *   npm run sense --workspace @vitalink/api
 *
 * Prints what each source returned, what was skipped and why, then the
 * corroboration outcome per cluster. The interesting output is the quarantine
 * breakdown: an FDA recall that only the FDA reported cannot become a verified
 * alert, and that is the system stating a fact about corroboration rather than
 * failing.
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import { createSignalsService } from '@modules/signals';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

import { resolveCliOrg } from './cli-org';

const TOP_N = 8;
const SKIP_SAMPLE = 3;
/** Column widths, so the per-source table lines up in a terminal. */
const COLUMN = { source: 22, count: 4, reason: 36 };

async function main(): Promise<void> {
  await connectMongo();
  await connectRedis();

  try {
    await run(await resolveCliOrg());
  } finally {
    await disconnectMongo();
    await disconnectRedis();
  }
}

async function run(org: string): Promise<void> {
  const service = createSignalsService();

  console.log('\nSENSE — pulling every source\n');
  const ingest = await service.ingest(org);

  for (const source of ingest.perSource) {
    console.log(
      `  ${source.source.padEnd(COLUMN.source)}${String(source.fetched).padStart(COLUMN.count)} fetched  ` +
        `${String(source.stored).padStart(COLUMN.count)} became signals  ` +
        `${String(source.skipped.length).padStart(COLUMN.count)} skipped`,
    );
    // A sample rather than all of them: the reasons repeat, and the point is
    // that skipping is never silent.
    for (const reason of source.skipped.slice(0, SKIP_SAMPLE)) {
      console.log(`      - ${reason}`);
    }
  }

  for (const failure of ingest.sourceFailures) {
    console.log(`  ${failure.source.padEnd(COLUMN.source)}UNREACHABLE: ${failure.error}`);
  }

  console.log(`\n  ${String(ingest.signalsStored)} signal(s) written or updated\n`);

  console.log('VERIFY — cluster, corroborate, score\n');
  const verify = await service.verify(org);

  console.log(`  clusters considered  ${String(verify.clustersConsidered)}`);
  console.log(`  alerts published     ${String(verify.alertsPublished)}`);
  console.log(`  quarantined          ${String(verify.quarantined)}\n`);

  for (const [reason, count] of Object.entries(verify.byQuarantineReason)) {
    console.log(`      ${reason.padEnd(COLUMN.reason)}${String(count)}`);
  }

  console.log(
    `  corroboration queries  ${String(verify.corroborationBudget.used)} of ` +
      `${String(verify.corroborationBudget.limit)} budget\n`,
  );
  console.log(`  ${verify.corroborationRate}`);
  console.log(`  ${verify.corroborationBudget.note}\n`);

  await printAlerts(service, org);
  await printQuarantine(service, org);
}

async function printAlerts(
  service: ReturnType<typeof createSignalsService>,
  org: string,
): Promise<void> {
  const alerts = await service.listAlerts(org, TOP_N);
  if (alerts.length === 0) {
    console.log('VERIFIED ALERTS: none this run.\n');
    return;
  }

  console.log(`VERIFIED ALERTS (${String(alerts.length)}):\n`);
  const DECIMALS = 3;

  for (const alert of alerts) {
    console.log(`  [${alert.category}] sev ${String(alert.severity)}  ${alert.insight}`);
    console.log(
      `      veracity ${alert.veracity.value.toFixed(DECIMALS)} [${alert.veracity.tag}]  ` +
        `${String(alert.independentSourceCount)} independent source(s)`,
    );
    console.log(`      node: ${alert.resolvedNodeId ?? 'unresolved'}`);
    console.log(`      ${alert.resolutionBasis}`);
    console.log(`      ${alert.clusterBasis}\n`);
  }

  const first = alerts[0];
  if (first !== undefined) {
    console.log('VERACITY CALCULATION on the first alert, verbatim from the stored Quantity:\n');
    console.log(`  ${first.veracity.provenance.calculation_method ?? '(none)'}\n`);
  }
}

async function printQuarantine(
  service: ReturnType<typeof createSignalsService>,
  org: string,
): Promise<void> {
  const records = await service.listQuarantine(org, TOP_N);
  if (records.length === 0) return;

  console.log(`QUARANTINE (showing ${String(records.length)}):\n`);
  for (const record of records) {
    console.log(`  [${record.reason}] ${record.extraction?.insight ?? '(no extraction)'}`);
    console.log(`      ${record.detail}\n`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
