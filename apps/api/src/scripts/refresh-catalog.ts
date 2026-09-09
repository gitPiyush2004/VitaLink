/**
 * Populates the catalogue from openFDA, using the queries in
 * `config/seed-drugs.yaml`.
 *
 *   npm run refresh:catalog --workspace @vitalink/api
 *   npm run refresh:catalog --workspace @vitalink/api -- "heparin sodium"
 *
 * Every drug in the catalogue comes from here, which is to say from a live
 * openFDA request with provenance attached. Nothing in this project ships a
 * seeded drug list — the file it reads holds the *queries* that derive the
 * universe, not the universe (spec PART 5).
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createCatalogService } from '@modules/catalog';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

/** `node script.ts a b c` puts the first real argument at index 2. */
const ARGV_OFFSET = 2;
/** Warnings are long by design; the console shows the first line's worth. */
const WARNING_PREVIEW_CHARS = 140;

/**
 * Reads the generic names out of the YAML without a YAML parser.
 *
 * Deliberate: the file has one shape this script cares about — lines reading
 * `- generic_name: <name>` — and adding a dependency to parse eight lines would
 * be worse than a four-line reader with a comment. If the file ever grows a
 * nested structure this script needs, that is the moment to add `yaml`.
 */
function readGenericNames(): string[] {
  const path = join(__dirname, '..', 'config', 'seed-drugs.yaml');
  const text = readFileSync(path, 'utf8');

  return [...text.matchAll(/^\s*-\s*generic_name:\s*(.+)$/gm)]
    .map((match) => (match[1] ?? '').trim())
    .filter((name) => name.length > 0);
}

async function main(): Promise<void> {
  const fromArgv = process.argv.slice(ARGV_OFFSET);
  const names = fromArgv.length > 0 ? fromArgv : readGenericNames();

  await connectMongo();
  await connectRedis();

  const service = createCatalogService();

  console.log(`refreshing ${String(names.length)} generic name(s) from openFDA\n`);
  let succeeded = 0;

  for (const name of names) {
    try {
      const outcome = await service.refreshDrug(name);
      succeeded += 1;
      console.log(`OK  ${name}`);
      console.log(
        `      products ${String(outcome.productsSeen)}, labelers ${String(outcome.labelersSeen)}`,
      );
      console.log(
        `      z_api ${String(outcome.zApi)} (raw labeler count ${String(outcome.rawLabelerCount)})`,
      );
      console.log(`      temperature ${outcome.temperatureRequirement ?? 'UNRESOLVED'}`);
      for (const warning of outcome.warnings) {
        console.log(`      warning: ${warning.slice(0, WARNING_PREVIEW_CHARS)}`);
      }
    } catch (error) {
      // A drug openFDA does not know is a legitimate outcome, reported and
      // skipped. It is never replaced with a placeholder entry.
      console.log(`SKIP ${name}`);
      console.log(`      ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log('');
  }

  console.log(`${String(succeeded)} of ${String(names.length)} refreshed.`);
  console.log(`catalogue now holds ${String(await service.countDrugs())} drug(s).`);

  await disconnectMongo();
  await disconnectRedis();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
