/**
 * Runs a cascade from the command line, for verification and demos.
 *
 *   npm run cascade --workspace @vitalink/api -- <shock-node-id> <assumed-cover-days>
 *   npm run cascade --workspace @vitalink/api -- ingredient:heparin-sodium 30
 *
 * Prints the ranked exposed drugs with their full propagation paths, because the
 * whole claim of the cascade is that the chain is inspectable rather than the
 * score being taken on trust.
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import { createCascadeService } from '@modules/cascade';
import { createGraphService } from '@modules/graph';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

const ARGV_OFFSET = 2;
const DEFAULT_COVER_DAYS = 30;
const DEFAULT_DURATION_DAYS = 90;
const TOP_N = 6;
const PERCENT = 100;

async function main(): Promise<void> {
  const [shockNodeId, coverArg] = process.argv.slice(ARGV_OFFSET);

  if (shockNodeId === undefined) {
    console.error('usage: cascade <shock-node-id> [assumed-cover-days]');
    console.error('  e.g. cascade ingredient:heparin-sodium 30');
    process.exit(1);
  }

  await connectMongo();
  await connectRedis();

  const graph = createGraphService();
  const node = await graph.getNode(shockNodeId);
  if (node === null) {
    const counts = await graph.counts();
    console.error(`\nno such node: ${shockNodeId}`);
    console.error(
      `the graph holds ${String(counts.nodes)} nodes and ${String(counts.edges)} edges.`,
    );
    console.error('run `npm run rebuild:graph` first, then pick an id from the graph.');
    await disconnectMongo();
    await disconnectRedis();
    process.exit(1);
  }

  console.log(`\nshock: ${node.label}  [${node.type}]  ${node.id}\n`);

  const cascade = await createCascadeService().run({
    orgId: 'cli',
    shockNodeId,
    alertId: null,
    durationDays: DEFAULT_DURATION_DAYS,
    assumedCoverDays: coverArg === undefined ? DEFAULT_COVER_DAYS : Number(coverArg),
  });

  console.log(`cascade ${cascade.id}`);
  console.log(`touched ${String(cascade.touchedNodeIds.length)} nodes`);
  console.log(
    `pruned ${String(cascade.traversalNotes.pathsPrunedByWeight)} paths by weight, ` +
      `${String(cascade.traversalNotes.pathsPrunedByCap)} by cap\n`,
  );

  console.log(`EXPOSED DRUGS (${String(cascade.exposedDrugs.length)}), most exposed first:\n`);
  for (const exposed of cascade.exposedDrugs.slice(0, TOP_N)) printExposed(exposed);

  printProvenance(cascade.exposedDrugs[0]);

  await disconnectMongo();
  await disconnectRedis();
}

type Exposed = Awaited<
  ReturnType<ReturnType<typeof createCascadeService>['run']>
>['exposedDrugs'][number];

function printExposed(exposed: Exposed): void {
  const band = exposed.coverProjection.stockoutDayBand;

  console.log(`  ${exposed.label}`);
  console.log(
    `      exposure ${(exposed.exposureQuantity.value * PERCENT).toFixed(1)}%  ` +
      `[${exposed.exposureQuantity.tag}]  ${String(exposed.propagationPaths.length)} path(s)`,
  );
  console.log(
    `      cover ${exposed.coverBandDays.value.toFixed(1)} days [${exposed.coverBandDays.tag}]  ` +
      `stockout day ${band === null ? 'beyond horizon' : `${String(band.low)}-${String(band.high)}`}`,
  );

  // The chain, which is the whole point of a path-annotated cascade.
  const first = exposed.propagationPaths[0];
  if (first !== undefined) {
    const chain = [first.hops[0]?.fromLabel, ...first.hops.map((hop) => hop.toLabel)];
    console.log(`      path: ${chain.join(' -> ')}`);
  }
  console.log('');
}

function printProvenance(top: Exposed | undefined): void {
  if (top === undefined) return;

  console.log('CALCULATION METHOD on the top result, verbatim from the stored Quantity:\n');
  console.log(`  ${top.exposureQuantity.provenance.calculation_method ?? '(none)'}\n`);
  console.log(`  source: ${top.exposureQuantity.provenance.source_name}`);
  console.log(`  fetched_at: ${top.exposureQuantity.provenance.fetched_at}\n`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
