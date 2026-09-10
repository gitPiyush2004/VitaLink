/**
 * Turns a cascade into a carrier recommendation, from the command line.
 *
 *   npm run recommend --workspace @vitalink/api -- <cascade-id> <drug-id> <weight-kg>
 *
 * This script is the evidence for the phase gate: **a cascade produces a
 * shipment with zero manual input.** Everything it prints under CONSTRAINTS was
 * derived from the drug's own openFDA label and the cascade's cover band — the
 * only things passed on the command line are the cascade, the drug, and the
 * consignment weight, which no public source states.
 *
 * It prints the whole comparison table, including the carriers that returned
 * nothing, because a table showing one price reads as "there is one option" when
 * the truth is "there is one option we can see".
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import { createCascadeService } from '@modules/cascade';
import { createLogisticsService, type RecommendationRecord } from '@modules/logistics';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

import { resolveCliOrg } from './cli-org';

const ARGV_OFFSET = 2;
const DEFAULT_WEIGHT_KG = 120;
const DEFAULT_BOX_CM = { l: 40, w: 30, h: 30 };
const DEFAULT_PACKAGES = 4;

/** Column widths, so the comparison table lines up in a terminal. */
const COLUMN = {
  carrier: 16,
  price: 14,
  status: 14,
  key: 14,
  subScore: 4,
  weight: 3,
  contribution: 6,
};
const PERCENT = 100;

/**
 * A domestic India lane, supplied because the physical layer is not ingested.
 *
 * Stated here rather than defaulted inside the derivation, so that the one place
 * a demo puts its thumb on the scale is visible in the demo script rather than
 * buried in the domain.
 */
const ORIGIN = { name: 'Hyderabad formulation plant', city: 'Hyderabad', country: 'IN' };
const DESTINATION = { name: 'Mumbai regional hub', city: 'Mumbai', country: 'IN' };

async function main(): Promise<void> {
  const [cascadeId, drugId, weightArg] = process.argv.slice(ARGV_OFFSET);

  if (cascadeId === undefined || drugId === undefined) {
    console.error('usage: recommend <cascade-id> <drug-id> [weight-kg]');
    console.error('  run `npm run cascade -- ingredient:heparin-sodium 30` first for an id');
    process.exit(1);
  }

  await connectMongo();
  await connectRedis();

  try {
    await run(cascadeId, drugId, weightArg);
  } finally {
    await disconnectMongo();
    await disconnectRedis();
  }
}

async function run(
  cascadeId: string,
  drugId: string,
  weightArg: string | undefined,
): Promise<void> {
  const org = await resolveCliOrg();
  const cascade = await createCascadeService().get(org, cascadeId);
  if (cascade === null) {
    console.error(`\nno such cascade for org 'cli': ${cascadeId}`);
    process.exit(1);
  }

  const { shipment, recommendation } = await createLogisticsService().recommendFromCascade({
    orgId: org,
    cascadeId,
    drugId,
    consignment: {
      origin: { ...ORIGIN, point: null, provenance: operatorProvenance() },
      destination: { ...DESTINATION, point: null, provenance: operatorProvenance() },
      hubIdDestination: 'hub:mumbai',
      weightKg: weightArg === undefined ? DEFAULT_WEIGHT_KG : Number(weightArg),
      dimensionsCm: [DEFAULT_BOX_CM],
      numberOfPackages: DEFAULT_PACKAGES,
      affectedPopulation: null,
      budgetCeilingInr: null,
    },
  });

  printConstraints(shipment);
  printComparison(recommendation);
  printBreakdown(recommendation);
}

function operatorProvenance() {
  return {
    source_name: 'CLI operator input',
    source_url: 'https://github.com/gitPiyush2004/VitaLink/blob/main/docs/BUILD_LOG.md',
    query: null,
    fetched_at: new Date().toISOString(),
  };
}

type Shipment = Awaited<
  ReturnType<ReturnType<typeof createLogisticsService>['recommendFromCascade']>
>['shipment'];

/** What was derived, and from what. The phase gate is readable in this block. */
function printConstraints(shipment: Shipment): void {
  const { request } = shipment;

  console.log(`\nSHIPMENT ${request.id}`);
  console.log(`  ${request.product.name}  ${request.origin.city} -> ${request.destination.city}\n`);
  console.log('CONSTRAINTS, all derived — none of these was asked of the operator:\n');
  console.log(`  temperature      ${request.temperature_requirement}`);
  console.log(
    `  forbidden        ${shipment.prohibitedRanges.length === 0 ? '(none stated on the label)' : shipment.prohibitedRanges.join(', ')}`,
  );
  console.log(`  handling         ${request.special_handling.join(', ')}`);
  console.log(`  deadline         ${request.required_delivery_deadline}`);
  console.log(`  urgency          ${request.urgency}`);
  console.log(`  customs          ${String(request.customs_required)}\n`);
  console.log('DERIVATION, in order:\n');
  for (const line of shipment.derivation) console.log(`  - ${line}`);
  console.log('');
}

/** One comparison row: the carrier, its price, its status, and its verdict. */
function comparisonRow(
  display: string,
  price: number | null,
  status: string,
  verdict: string,
): string {
  const money = price === null ? 'no price' : `INR ${price.toLocaleString('en-IN')}`;
  return (
    `  ${display.padEnd(COLUMN.carrier)}${money.padStart(COLUMN.price)}  ` +
    `${status.padEnd(COLUMN.status)}${verdict}`
  );
}

type EligibilityRow = RecommendationRecord['recommendation']['eligibility'][number];
type ScoredRow = RecommendationRecord['recommendation']['scored'][number];

/** One carrier's row, plus its failure reasons underneath. */
function printRow(
  row: EligibilityRow,
  recommendation: RecommendationRecord,
  scoredByQuote: Map<string, ScoredRow>,
): void {
  const quote = recommendation.quotes.find((one) => one.id === row.quoteId);
  const scored = scoredByQuote.get(row.quoteId);
  const score = scored === undefined ? 0 : scored.finalScore;
  const price = quote === undefined || quote.price === null ? null : quote.price.value;

  console.log(
    comparisonRow(
      quote === undefined ? row.carrierId : quote.provider_display,
      price,
      quote === undefined ? '?' : quote.quote_status,
      row.result.isEligible ? `score ${score.toFixed(1)}` : 'NOT ELIGIBLE',
    ),
  );

  for (const failure of row.result.failures) {
    console.log(`      x ${failure.reason}: ${failure.detail}`);
  }
}

/** Every carrier attempted, eligible or not. Nothing is dropped. */
function printComparison(recommendation: RecommendationRecord): void {
  console.log(`COMPARISON  (${recommendation.coverageNote})\n`);

  const scoredByQuote = new Map(
    recommendation.recommendation.scored.map((one) => [one.quoteId, one]),
  );

  for (const row of recommendation.recommendation.eligibility) {
    printRow(row, recommendation, scoredByQuote);
  }

  const winner = recommendation.recommendedQuoteId;
  console.log(
    `\n  RECOMMENDED: ${winner === null ? 'NO ELIGIBLE CARRIER — see the reasons above' : winner}\n`,
  );
}

/** The winning row's arithmetic, so the score is checkable rather than trusted. */
function printBreakdown(recommendation: RecommendationRecord): void {
  const [winner] = recommendation.recommendation.scored;
  if (winner === undefined) return;

  console.log('SCORE BREAKDOWN on the recommendation:\n');
  for (const subScore of winner.subScores) {
    console.log(
      `  ${subScore.key.padEnd(COLUMN.key)}${subScore.value.toFixed(0).padStart(COLUMN.subScore)}  ` +
        `x ${(subScore.weight * PERCENT).toFixed(0).padStart(COLUMN.weight)}%  = ` +
        `${subScore.contribution.toFixed(1).padStart(COLUMN.contribution)}` +
        (subScore.neutralFallbackReason === null ? '' : '   (neutral fallback)'),
    );
  }
  console.log(
    `  ${'FINAL'.padEnd(COLUMN.key)}${winner.finalScore.toFixed(1).padStart(COLUMN.subScore)}`,
  );
  console.log(`  profile ${recommendation.weightProfile.name}`);
  console.log(`    weighting:  ${recommendation.recommendation.profile.rationale}`);
  console.log(`    in force:   ${recommendation.weightProfile.selectedBecause}\n`);

  if (winner.preferenceNote !== null) console.log(`  ${winner.preferenceNote}\n`);

  const counterfactual = recommendation.recommendation.counterfactual;
  if (counterfactual !== null) console.log(`COUNTERFACTUAL:\n\n  ${counterfactual.verdict}\n`);

  for (const subScore of winner.subScores) {
    if (subScore.neutralFallbackReason === null) continue;
    console.log(`  NEUTRAL FALLBACK on ${subScore.key}: ${subScore.neutralFallbackReason}\n`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
