/**
 * Deriving redundancy counts from openFDA, and being honest about which echelon
 * openFDA can actually see.
 *
 * This file was rewritten twice, both times because running it against real data
 * showed the previous version was wrong. The history is the most useful thing in
 * it, so it is written down.
 *
 * ## Attempt 1: raw labeler count
 *
 * `z_api` is the count of independent API suppliers in the reliability model.
 * The obvious openFDA derivation is a `count` aggregation over `labeler_name`.
 * Heparin sodium returns **47**. Feeding 47 into `r_api = 1 - p_api^z_api` gives
 * a reliability of 0.99999 and a Fragility Index of essentially zero — for a drug
 * that has been in recorded shortage more than once.
 *
 * ## Attempt 2: numbers-equivalent, saturated
 *
 * Replacing the raw count with `1 / HHI` — the standard industrial-organisation
 * conversion from a share distribution to "the equivalent number of equal-sized
 * firms" — discounts the long tail of one-listing relabelers arithmetically
 * rather than through a hand-maintained exclusion list. Heparin then gives 19.6
 * instead of 47. Still enough for near-zero fragility, so the value was saturated
 * at 4.
 *
 * Running that across the whole seed set showed why it was still wrong: **every
 * single drug came out at exactly 4.** Amoxicillin has 57 labelers, metformin
 * over 100, insulin glargine 11, atropine 71. Saturating them all to the same
 * number means the derivation carries no discriminating information at all — a
 * metric that gives every input the same answer is not a metric.
 *
 * ## What is actually wrong, and attempt 3
 *
 * The mistake was not the arithmetic. It was the **echelon**.
 *
 * openFDA's `labeler_name` describes who puts their name on the finished carton.
 * That is a proxy for the **finished-dose plant** tier — the paper's `z_plant` —
 * and a reasonable one. It is not, and never was, a proxy for the API-supplier
 * tier. Dozens of finished-dose labelers routinely buy from a handful of upstream
 * API producers, and openFDA does not publish who those are.
 *
 * So this file now derives what the data measures:
 *
 * - **`z_plant`** — the numbers-equivalent of HHI over observed labeler shares.
 *   `DERIVED` from real data, varies across drugs, and genuinely informative.
 * - **`z_api`** — from trade concentration when trade data is available, and
 *   otherwise **1, tagged `SCENARIO`**, with `apiTierVisibility: NOT_OBSERVED`.
 *   Not a confident number dressed up from labeler counts.
 *
 * Assuming a single API source when we cannot see the API tier overstates
 * fragility. That is the deliberate direction to be wrong in for a resilience
 * tool, and it is labelled on every number rather than hidden. The finished-dose
 * index is displayed right beside it so a reader can see both.
 *
 * Because the echelons are in series, a `z_api` of 1 dominates the result — which
 * is the correct conclusion to reach: *these drugs are all exposed at a tier we
 * cannot observe.* Variation between drugs then comes from the per-drug fitted
 * failure and repair rates, which openFDA genuinely does publish.
 */

import { herfindahl, toShares } from '@vitalink/graph';

import { Z_API_TAIL_SHARE_THRESHOLD } from '@config/constants';

/** Decimal places used when quoting HHI in a calculation method. */
const HHI_DECIMALS = 5;
/** Decimal places used when quoting a numbers-equivalent. */
const EQUIVALENT_DECIMALS = 2;
const PERCENT = 100;

/** One labeler and how many of the drug's observed product listings it holds. */
export type LabelerObservation = {
  name: string;
  productCount: number;
};

/**
 * Whether the API tier's concentration was actually observed.
 * `NOT_OBSERVED` is the honest default.
 */
export const API_TIER_VISIBILITY = ['OBSERVED_FROM_TRADE_DATA', 'NOT_OBSERVED'] as const;
export type ApiTierVisibility = (typeof API_TIER_VISIBILITY)[number];

/** Country import shares for the drug's ingredients, when trade data exists. */
export type TradeConcentration = {
  /** Shares summing to 1, one per partner country. */
  countryShares: number[];
  sourceDescription: string;
};

export type RedundancyDerivation = {
  /**
   * API-supplier redundancy for the reliability model.
   * 1 whenever `apiTierVisibility` is `NOT_OBSERVED`.
   */
  zApi: number;
  /** Whether `zApi` is a real derivation or the single-source assumption. */
  zApiIsAssumed: boolean;
  apiTierVisibility: ApiTierVisibility;
  /** The formula behind `zApi`, or the statement that it is an assumption. */
  zApiMethod: string;

  /** Finished-dose plant redundancy. DERIVED from openFDA, and informative. */
  zPlant: number;
  zPlantMethod: string;

  /** Raw distinct labeler count observed. See `wasCountTruncated`. */
  rawLabelerCount: number;
  /**
   * True when openFDA returned its maximum number of `count` buckets, so the
   * labeler count is a **floor** rather than the true total. Reported, because a
   * truncated count silently presented as complete would be a quiet lie.
   */
  wasCountTruncated: boolean;
  /** `1 / HHI` over labeler shares, before flooring to an integer. */
  numbersEquivalent: number;
  hhi: number;
  longTailCount: number;
  isSingleSource: boolean;

  /** Shown next to `zApi` whenever the API tier was not observed. */
  caveat: string | null;
};

const API_TIER_CAVEAT =
  'API-tier concentration was not observed for this drug, so z_api is assumed to be 1 — ' +
  'the most fragile configuration. openFDA describes the finished-dose market only: ' +
  'dozens of labelers routinely buy from a handful of upstream API producers, and openFDA ' +
  'does not publish which. This assumption OVERSTATES fragility, which is the safer ' +
  'direction for a resilience tool, and the finished-dose redundancy is shown alongside it. ' +
  'Resolving it requires the UN Comtrade country-dependency layer.';

const NO_LABELER_METHOD =
  'No labeler observed in openFDA for this generic name, so redundancy defaults to 1 at ' +
  'both echelons — the most fragile configuration — rather than to a favourable guess.';

/**
 * Derives the redundancy inputs for one drug.
 *
 * @param labelers one entry per distinct labeler with its product-listing count,
 *   from an openFDA `count=labeler_name.exact` aggregation.
 * @param options `wasCountTruncated` when openFDA returned its bucket maximum;
 *   `trade` when country import shares are available for this drug's ingredients.
 */
export function deriveRedundancy(
  labelers: LabelerObservation[],
  options: { wasCountTruncated?: boolean; trade?: TradeConcentration | undefined } = {},
): RedundancyDerivation {
  const wasCountTruncated = options.wasCountTruncated ?? false;
  const rawLabelerCount = labelers.length;

  if (rawLabelerCount === 0) {
    return {
      zApi: 1,
      zApiIsAssumed: true,
      apiTierVisibility: 'NOT_OBSERVED',
      zApiMethod: NO_LABELER_METHOD,
      zPlant: 1,
      zPlantMethod: NO_LABELER_METHOD,
      rawLabelerCount: 0,
      wasCountTruncated,
      numbersEquivalent: 1,
      hhi: 0,
      longTailCount: 0,
      isSingleSource: true,
      caveat: 'No openFDA labeler could be resolved for this drug.',
    };
  }

  const shares = toShares(labelers.map((labeler) => labeler.productCount));
  const hhi = herfindahl(shares);
  const longTailCount = shares.filter((share) => share < Z_API_TAIL_SHARE_THRESHOLD).length;

  // HHI is zero only when every count is zero, which `toShares` turns into an
  // empty list; guarded so this cannot produce Infinity.
  const numbersEquivalent = hhi > 0 ? 1 / hhi : 1;
  const zPlant = Math.max(1, Math.floor(numbersEquivalent));

  const api = deriveApiRedundancy(options.trade);

  return {
    ...api,
    zPlant,
    zPlantMethod: buildPlantMethod({
      rawLabelerCount,
      hhi,
      numbersEquivalent,
      zPlant,
      longTailCount,
      wasCountTruncated,
    }),
    rawLabelerCount,
    wasCountTruncated,
    numbersEquivalent,
    hhi,
    longTailCount,
    isSingleSource: rawLabelerCount <= 1,
  };
}

/**
 * `z_api` from trade concentration, or the single-source assumption.
 *
 * When trade data exists, the numbers-equivalent of HHI over **country** import
 * shares is a genuine API-tier signal: if one country supplies 68% of a drug's
 * ingredient imports, effective upstream redundancy is low no matter how many
 * firms label the finished product.
 */
function deriveApiRedundancy(trade: TradeConcentration | undefined): {
  zApi: number;
  zApiIsAssumed: boolean;
  apiTierVisibility: ApiTierVisibility;
  zApiMethod: string;
  caveat: string | null;
} {
  if (trade === undefined || trade.countryShares.length === 0) {
    return {
      zApi: 1,
      zApiIsAssumed: true,
      apiTierVisibility: 'NOT_OBSERVED',
      zApiMethod:
        'z_api = 1, ASSUMED. The API tier was not observed, so the most fragile ' +
        'configuration is assumed rather than inferred from finished-dose labeler counts, ' +
        'which measure a different echelon.',
      caveat: API_TIER_CAVEAT,
    };
  }

  const countryHhi = herfindahl(trade.countryShares);
  const equivalent = countryHhi > 0 ? 1 / countryHhi : 1;
  const zApi = Math.max(1, Math.floor(equivalent));

  return {
    zApi,
    zApiIsAssumed: false,
    apiTierVisibility: 'OBSERVED_FROM_TRADE_DATA',
    zApiMethod:
      `z_api = floor(1 / HHI) = ${String(zApi)}, where HHI = ${countryHhi.toFixed(HHI_DECIMALS)} over ` +
      `country import shares (numbers-equivalent ${equivalent.toFixed(EQUIVALENT_DECIMALS)}) from ` +
      `${trade.sourceDescription}. A country-dependency proxy for API-tier redundancy, ` +
      'not a count of API plants.',
    caveat: null,
  };
}

/** The `z_plant` formula, written out for the Sources drawer. */
function buildPlantMethod(parts: {
  rawLabelerCount: number;
  hhi: number;
  numbersEquivalent: number;
  zPlant: number;
  longTailCount: number;
  wasCountTruncated: boolean;
}): string {
  const truncationNote = parts.wasCountTruncated
    ? ' openFDA returned its maximum number of count buckets, so the labeler count is a ' +
      'FLOOR rather than the true total and the HHI is computed over a truncated tail.'
    : '';

  return [
    `z_plant = max(1, floor(1 / HHI)) = ${String(parts.zPlant)}.`,
    `HHI = ${parts.hhi.toFixed(HHI_DECIMALS)} over openFDA product-listing shares for`,
    `${String(parts.rawLabelerCount)} distinct labelers, a numbers-equivalent of`,
    `${parts.numbersEquivalent.toFixed(EQUIVALENT_DECIMALS)}.`,
    `${String(parts.longTailCount)} labelers hold under`,
    `${String(Z_API_TAIL_SHARE_THRESHOLD * PERCENT)}% each and are discounted by HHI rather than`,
    'excluded by a hand-maintained repackager list.',
    'This is FINISHED-DOSE plant redundancy, which is what openFDA labeler data measures.',
    truncationNote,
  ]
    .join(' ')
    .trim();
}
