/** Replay source-backed attribute checks; never imports runtime fixtures. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import { ndcProductSchema, shortageSchema, type NdcProduct } from '@vitalink/connectors';
import { candidateSetSchema } from '@vitalink/contracts';

import { candidateReference } from '../apps/api/src/modules/operations/domain/candidate-reference';
import { buildCandidate } from '../apps/api/src/modules/operations/domain/candidates';

import { forecastingSummary } from './public-data-summary';

const reviewSchema = z.object({
  reviewer: z.string(),
  limitations: z.string(),
  sourceFiles: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).optional(),
  cases: z.array(
    z.object({
      cohort: z.string(),
      productNdc: z.string(),
      sourceFileSha256: z.string(),
      expected: z.record(
        z.enum(['ingredients', 'strength', 'dosageForm', 'route', 'marketingCategory']),
        z.enum(['match', 'differs', 'unknown']),
      ),
      exclusions: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
});
const archivedSchema = z.object({ rawBody: z.string(), sha256: z.string() });
const cachedSchema = z.object({
  body: z.string(),
  provenance: z.object({ source_url: z.string() }),
});
function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
function read(directory: string, file: string): unknown {
  return JSON.parse(readFileSync(join(directory, file), 'utf8')) as unknown;
}
function sourceProduct(directory: string, url: string, ndc: string): NdcProduct {
  const products: NdcProduct[] = [];
  for (const file of readdirSync(directory).filter((f) => f.startsWith('source-'))) {
    const cached = cachedSchema.parse(read(directory, file));
    if (cached.provenance.source_url !== url) continue;
    const envelope = z.object({ results: z.array(z.unknown()) }).parse(JSON.parse(cached.body));
    for (const row of envelope.results) {
      const product = ndcProductSchema.safeParse(row);
      if (product.success && product.data.product_ndc === ndc) products.push(product.data);
    }
  }
  const unique = [
    ...new Map(products.map((product) => [JSON.stringify(source(product)), product])).values(),
  ];
  const product = unique[0];
  if (unique.length !== 1 || !product) {
    throw new Error(`Missing or ambiguous raw listing ${ndc} in its exact retrieval query`);
  }
  return product;
}
function ingredients(product: NdcProduct) {
  return (product.active_ingredients ?? []).map((i) => ({
    name: i.name,
    strength: i.strength ?? null,
  }));
}
function source(product: NdcProduct) {
  return {
    productNdc: product.product_ndc,
    genericName: product.generic_name ?? product.product_ndc,
    brandName: product.brand_name ?? null,
    labeler: product.labeler_name ?? null,
    ingredients: ingredients(product),
    dosageForm: product.dosage_form ?? null,
    routes: product.route ?? [],
    marketingCategory: product.marketing_category ?? null,
    marketingStartDate: product.marketing_start_date ?? null,
    listingExpiryDate: product.listing_expiration_date ?? null,
    finished: product.finished ?? null,
  };
}
function shortageReplay(directory: string) {
  const records = readdirSync(directory)
    .filter((f) => f.startsWith('shortages-page-'))
    .flatMap((file) => {
      const archive = archivedSchema.parse(read(directory, file));
      if (hash(archive.rawBody) !== archive.sha256) throw new Error(`Invalid source hash: ${file}`);
      return z.object({ results: z.array(shortageSchema) }).parse(JSON.parse(archive.rawBody))
        .results;
    });
  const meta = z
    .object({
      reportedTotal: z.number().nullable(),
      completeRetrieval: z.boolean(),
      sources: z.array(z.object({ fetched_at: z.string() })),
    })
    .parse(read(directory, 'shortage-snapshot.json'));
  return forecastingSummary({
    ...meta,
    records,
    observedAt:
      meta.sources
        .map((s) => s.fetched_at)
        .sort()
        .at(-1) ?? null,
  });
}
function replayCase(directory: string, test: z.infer<typeof reviewSchema>['cases'][number]) {
  const file = `${test.cohort}-candidates.json`;
  if (hash(readFileSync(join(directory, file), 'utf8')) !== test.sourceFileSha256) {
    throw new Error(`Review belongs to a different source freeze: ${file}`);
  }
  const set = z.object({ set: candidateSetSchema }).parse(read(directory, file)).set;
  const baseline = sourceProduct(
    directory,
    set.sources[0]?.source_url ?? '',
    set.referenceNdc ?? '',
  );
  const product = sourceProduct(directory, set.sources[1]?.source_url ?? '', test.productNdc);
  const saved = set.candidates.find((c) => c.productNdc === test.productNdc);
  if (saved === undefined) {
    throw new Error(`Missing raw FDA listing for ${test.productNdc}`);
  }
  const candidate = buildCandidate({
    reference: candidateReference([baseline], baseline.generic_name ?? ''),
    source: source(product),
    equivalence: saved.equivalence,
    reportedShortage: saved.reportedShortage,
    asOf: new Date(set.createdAt),
  });
  const actual = Object.fromEntries(candidate.attributes.map((a) => [a.attribute, a.verdict]));
  const disagreements = Object.entries(test.expected).filter(
    ([attribute, expected]) => actual[attribute] !== expected,
  );
  const exclusionsAgree = JSON.stringify(candidate.exclusions) === JSON.stringify(test.exclusions);
  return {
    ...test,
    actual,
    actualExclusions: candidate.exclusions,
    disagreements,
    exclusionsAgree,
  };
}
function main(): void {
  const directory = resolve(process.argv[2] ?? 'data/evaluation/2026-10-12-final-audit');
  const review = reviewSchema.parse(read(directory, 'candidate-review.json'));
  for (const [file, digest] of Object.entries(review.sourceFiles ?? {})) {
    if (
      !/^source-[a-f0-9]+\.json$/.test(file) ||
      hash(readFileSync(join(directory, file), 'utf8')) !== digest
    ) {
      throw new Error(`Review raw-source freeze mismatch: ${file}`);
    }
  }
  const cases = review.cases.map((test) => replayCase(directory, test));
  const result = {
    reviewer: review.reviewer,
    limitations: review.limitations,
    rawSourceFilesVerified: Object.keys(review.sourceFiles ?? {}).length,
    reviewedCases: cases.length,
    disagreements: cases.filter((c) => c.disagreements.length > 0 || !c.exclusionsAgree).length,
    cases,
  };
  writeFileSync(
    join(directory, 'candidate-review-result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  writeFileSync(
    join(directory, 'forecasting-feasibility.json'),
    JSON.stringify(shortageReplay(directory), null, 2) + '\n',
  );
  console.log(
    `Replayed ${String(cases.length)} purposive technical cases; ${String(result.disagreements)} disagreements.`,
  );
  if (result.disagreements > 0) process.exitCode = 1;
}
main();
