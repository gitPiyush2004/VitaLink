/**
 * Veracity: how much an alert deserves to be believed (spec stage 2).
 *
 * Three inputs, multiplied, each in [0, 1]:
 *
 *     veracity = independence * credibility * recency
 *
 * ## Why a product and not a weighted sum
 *
 * A sum lets one strong term rescue a fatal weakness. An alert from a single
 * source, however authoritative and however recent, would score 0.6 under a
 * weighted sum and clear a 0.5 threshold — while failing the one rule VERIFY
 * exists to enforce. A product cannot do that: any term near zero drags the
 * result to zero, which is the correct behaviour for a *conjunction* of
 * requirements. "Corroborated AND credible AND current" is a conjunction.
 *
 * ## This number is computed, never generated
 *
 * Rule 2. The language model may assign a category and write a sentence; it may
 * not produce this figure or any input to it. Everything below is arithmetic on
 * counts and timestamps, and the resulting `Quantity` is tagged DERIVED with the
 * substituted formula in its `calculation_method`.
 *
 * Pure functions. `now` is passed in, so a veracity figure is reproducible.
 */

import { derived, type Quantity } from '@vitalink/contracts';

import {
  MIN_INDEPENDENT_SOURCES,
  MS_PER_DAY,
  VERACITY_RECENCY_HALF_LIFE_DAYS,
} from '@config/constants';

/**
 * Source credibility, by publisher class.
 *
 * These are the only judgement calls in the file, and they are stated as a table
 * rather than buried in a formula so that disagreeing with one is a one-line
 * edit against a visible number.
 *
 * A regulator publishing an enforcement action is stating a fact it is legally
 * responsible for. A news outlet reporting one is relaying it, sometimes
 * accurately. That difference is real and it is the only thing this table
 * encodes — it is *not* a quality ranking of news organisations, which is not
 * something this project has any standing to assert.
 */
const CREDIBILITY = {
  /** A regulator or statutory body publishing within its own remit. */
  REGULATOR: 1,
  /** A multilateral or government statistical agency. */
  OFFICIAL_STATISTICS: 0.9,
  /** A news outlet with an identifiable publisher. */
  PRESS: 0.6,
  /** An identifiable publisher we know nothing else about. */
  UNKNOWN_PUBLISHER: 0.4,
} as const;

export type CredibilityClass = keyof typeof CREDIBILITY;

/** The decay base for a half-life: one half per half-life elapsed. */
const HALF = 0.5;

/** Agencies whose feeds are first-party statements of fact. */
const REGULATOR_KEYS = new Set([
  'fda.gov',
  'cdsco.gov.in',
  'nppa.gov.in',
  'nlm.nih.gov',
  'usgs.gov',
]);
const OFFICIAL_STATISTICS_KEYS = new Set(['un.org', 'who.int', 'data.gov.in']);

/** Classifies one independence key. Everything unrecognised is press or unknown. */
export function credibilityClass(
  independenceKey: string,
  hasIdentifiablePublisher: boolean,
): CredibilityClass {
  if (REGULATOR_KEYS.has(independenceKey)) return 'REGULATOR';
  if (OFFICIAL_STATISTICS_KEYS.has(independenceKey)) return 'OFFICIAL_STATISTICS';
  return hasIdentifiablePublisher ? 'PRESS' : 'UNKNOWN_PUBLISHER';
}

/**
 * The independence term.
 *
 * Zero below the required count, and that is deliberate: it makes the two-source
 * rule a property of the arithmetic rather than a separate check somewhere that
 * could be forgotten. Above the threshold it grows with diminishing returns — a
 * third source adds real confidence, a tenth adds almost none.
 */
export function independenceTerm(sourceCount: number): number {
  if (sourceCount < MIN_INDEPENDENT_SOURCES) return 0;

  // 1 - 1/n, rescaled so exactly the minimum scores 0.5 and more approaches 1.
  const above = sourceCount - MIN_INDEPENDENT_SOURCES + 1;
  return 1 - 1 / (above + 1);
}

/**
 * The credibility term: the best source in the set, not the average.
 *
 * Averaging would let a pile of low-credibility repeats dilute a regulator's own
 * statement, which is backwards — a recall is no less true because bloggers also
 * mentioned it. The set's credibility is that of its strongest member.
 */
export function credibilityTerm(classes: CredibilityClass[]): number {
  if (classes.length === 0) return 0;
  return Math.max(...classes.map((one) => CREDIBILITY[one]));
}

/**
 * The recency term: exponential decay on the age of the *newest* observation.
 *
 * Half-life rather than a cliff. A cliff at, say, thirty days would make a
 * 29-day-old alert fully credible and a 31-day-old one worthless, and nobody
 * believes that about the world. The newest observation is used because a story
 * corroborated again yesterday is current regardless of when it broke.
 */
export function recencyTerm(newestPublishedAt: string, now: Date): number {
  const ageMs = now.getTime() - Date.parse(newestPublishedAt);
  if (Number.isNaN(ageMs)) return 0;

  // A future timestamp is a source's clock being wrong, not a fresher story.
  const ageDays = Math.max(0, ageMs / MS_PER_DAY);
  return Math.pow(HALF, ageDays / VERACITY_RECENCY_HALF_LIFE_DAYS);
}

export type VeracityInput = {
  independentSourceCount: number;
  credibilityClasses: CredibilityClass[];
  newestPublishedAt: string;
  /** Names of the independent sources, for the calculation method. */
  independenceKeys: string[];
  now: Date;
};

export type VeracityResult = {
  quantity: Quantity;
  independence: number;
  credibility: number;
  recency: number;
  /** Why it failed, when it did. Null when the alert is publishable. */
  blockedBy: 'insufficient_independent_sources' | null;
};

/**
 * The veracity figure, with every term and the substituted formula on it.
 *
 * DERIVED, not MODELLED: there is no distribution here and no sensitivity range
 * to report, only arithmetic over counts and timestamps. Tagging it MODELLED
 * would oblige a band, and a band on this would be invented.
 */
export function computeVeracity(input: VeracityInput): VeracityResult {
  const independence = independenceTerm(input.independentSourceCount);
  const credibility = credibilityTerm(input.credibilityClasses);
  const recency = recencyTerm(input.newestPublishedAt, input.now);
  const value = independence * credibility * recency;

  const DECIMALS = 3;
  return {
    independence,
    credibility,
    recency,
    blockedBy:
      input.independentSourceCount < MIN_INDEPENDENT_SOURCES
        ? 'insufficient_independent_sources'
        : null,
    quantity: derived({
      value,
      unit: 'score_0_1',
      source: {
        name: 'Vitalink VERIFY',
        url: 'https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/signals/domain/veracity.ts',
        query: null,
        fetchedAt: input.now.toISOString(),
      },
      method:
        'veracity = independence * credibility * recency, each in [0,1]. A product, not a ' +
        'weighted sum: any term near zero must drag the result to zero, because the three are ' +
        `a conjunction. Here: independence ${independence.toFixed(DECIMALS)} from ` +
        `${String(input.independentSourceCount)} independent source(s) ` +
        `(${input.independenceKeys.length === 0 ? 'none identified' : input.independenceKeys.join(', ')}, ` +
        `minimum ${String(MIN_INDEPENDENT_SOURCES)}); credibility ` +
        `${credibility.toFixed(DECIMALS)} from the strongest publisher class present; recency ` +
        `${recency.toFixed(DECIMALS)} from the newest observation at ${input.newestPublishedAt} ` +
        `decayed on a ${String(VERACITY_RECENCY_HALF_LIFE_DAYS)}-day half-life. ` +
        `Product = ${value.toFixed(DECIMALS)}.`,
    }),
  };
}

export { CREDIBILITY };
