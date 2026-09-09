/**
 * Re-derives the supply graph from the catalogue.
 *
 *   npm run rebuild:graph --workspace @vitalink/api
 *
 * Prints the relations that could not be built and why, because an absent
 * relation is a finding rather than an omission: no country-dependency edges
 * means a cascade cannot start from a country, and the operator needs to know
 * that rather than wonder why the map is empty.
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import { createGraphService } from '@modules/graph';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

async function main(): Promise<void> {
  await connectMongo();
  await connectRedis();

  const outcome = await createGraphService().rebuild();

  console.log(`\nnodes upserted: ${String(outcome.nodesUpserted)}`);
  console.log(`edges upserted: ${String(outcome.edgesUpserted)}`);
  console.log(
    `graph now holds ${String(outcome.nodeCount)} nodes and ${String(outcome.edgeCount)} edges\n`,
  );

  if (outcome.absentRelations.length > 0) {
    console.log('relations that could NOT be built from public data:');
    for (const absent of outcome.absentRelations) {
      console.log(`  ${absent.rel}`);
      console.log(`      ${absent.reason}`);
    }
    console.log('');
  }

  await disconnectMongo();
  await disconnectRedis();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
