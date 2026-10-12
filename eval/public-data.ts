/** Archive real source responses before assessing candidate or forecasting data. */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  CachedHttpClient,
  createMemoryCache,
  OpenFdaClient,
  type Fetched,
  type NdcProduct,
  type ShortageRecord,
} from '@vitalink/connectors';
import type { ProductCandidate } from '@vitalink/contracts';

import { CandidateDiscovery } from '../apps/api/src/modules/operations/operations.candidates';

import { forecastingSummary } from './public-data-summary';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const COHORTS = [
  ['heparin', 'active_ingredients.name:"HEPARIN SODIUM"'],
  ['amoxicillin', 'active_ingredients.name:"AMOXICILLIN"'],
  ['insulin', 'active_ingredients.name:"INSULIN HUMAN"'],
  [
    'combination',
    'active_ingredients.name:"AMLODIPINE BESYLATE" AND active_ingredients.name:"BENAZEPRIL HYDROCHLORIDE"',
  ],
] as const;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function save(directory: string, name: string, value: unknown): void {
  writeFileSync(join(directory, name), JSON.stringify(value, null, 2) + '\n');
}

function archive(directory: string, name: string, response: Fetched<unknown>): void {
  save(directory, name, {
    provenance: response.provenance,
    sha256: hash(response.rawBody),
    rawBody: response.rawBody,
  });
}

/** Only a complete, stable query is described as complete retrieval. */
async function shortageSnapshot(fda: OpenFdaClient, directory: string) {
  const records: ShortageRecord[] = [];
  const sources: Fetched<unknown>['provenance'][] = [];
  let total: number | null = null;
  let stableTotal = true;
  let exhausted = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fda.searchShortages({
      search: '_exists_:generic_name',
      limit: PAGE_SIZE,
      skip: page * PAGE_SIZE,
      sort: 'initial_posting_date:asc',
    });
    archive(directory, `shortages-page-${String(page)}.json`, result);
    if (page === 0) total = result.total;
    stableTotal &&= result.total === total;
    records.push(...result.data);
    sources.push(result.provenance);
    console.log(`Shortages: ${String(records.length)}/${String(total)} records`);
    if (result.data.length < PAGE_SIZE || (total !== null && records.length >= total)) {
      exhausted = true;
      break;
    }
  }
  return {
    records,
    observedAt:
      sources
        .map((s) => s.fetched_at)
        .sort()
        .at(-1) ?? null,
    sources,
    reportedTotal: total,
    completeRetrieval: exhausted && stableTotal && records.length === total,
  };
}

function attributeCounts(products: ProductCandidate[]): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const product of products) {
    for (const attribute of product.attributes) {
      const counts = result[attribute.attribute] ?? {};
      counts[attribute.verdict] = (counts[attribute.verdict] ?? 0) + 1;
      result[attribute.attribute] = counts;
    }
  }
  return result;
}

async function candidateSnapshot(fda: OpenFdaClient, directory: string) {
  const discovery = new CandidateDiscovery(fda);
  const results: unknown[] = [];
  for (const [name, query] of COHORTS) {
    try {
      const listings = await fda.searchNdc({ search: query, limit: PAGE_SIZE });
      archive(directory, `${name}-listings.json`, listings);
      const baseline = listings.data.find(
        (row: NdcProduct) =>
          row.finished === true &&
          row.generic_name !== undefined &&
          (name === 'combination' || (row.active_ingredients ?? []).length === 1),
      );
      if (baseline === undefined) {
        throw new Error('No finished product with a generic name was retrieved.');
      }
      const { reference, provenance } = await discovery.reference({
        productNdcs: [baseline.product_ndc],
        genericName: baseline.generic_name ?? '',
      });
      const set = await discovery.discover(reference, provenance);
      save(directory, `${name}-candidates.json`, { reference, set });
      results.push({
        name,
        referenceNdc: set.referenceNdc,
        coverage: set.coverage,
        excluded: set.candidates.filter((p) => p.exclusions.length > 0).length,
        byAttribute: attributeCounts(set.candidates),
        limits: set.limits,
      });
      console.log(`${name}: ${String(set.candidates.length)} real candidate listings`);
    } catch (error) {
      results.push({ name, error: error instanceof Error ? error.message : String(error) });
      console.log(`${name}: source request failed; preserved as a failure`);
    }
  }
  return {
    observedAt: new Date().toISOString(),
    results,
    interpretation:
      'Live technical coverage audit. These counts are not matching accuracy or clinical validation.',
  };
}

async function main(): Promise<void> {
  const directory = resolve(
    process.argv[2] ?? `data/evaluation/${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  mkdirSync(directory, { recursive: true });
  if (readdirSync(directory).length > 0) {
    throw new Error('Use an empty audit directory to avoid mixing source freezes.');
  }
  const memory = createMemoryCache();
  const cache = {
    get: (key: string) => memory.get(key),
    set: async (key: string, value: string, ttl: number): Promise<void> => {
      // Preserve all candidate/approval/shortage queries, not just the selected examples.
      save(directory, `source-${hash(key)}.json`, JSON.parse(value) as unknown);
      await memory.set(key, value, ttl);
    },
  };
  const fda = new OpenFdaClient(new CachedHttpClient({ cache }));
  const snapshot = await shortageSnapshot(fda, directory);
  save(directory, 'shortage-snapshot.json', snapshot);
  save(directory, 'forecasting-feasibility.json', forecastingSummary(snapshot));
  save(directory, 'candidate-coverage.json', await candidateSnapshot(fda, directory));
  console.log(`Public-data audit saved to ${directory}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
