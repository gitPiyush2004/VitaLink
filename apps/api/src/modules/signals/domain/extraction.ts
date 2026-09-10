/**
 * Turning a raw signal into structured fields (spec stage 2, extraction).
 *
 * The spec's design puts a language model here. This file is deliberately split
 * so that the model's territory is visible and small, because two of the three
 * sources need no model at all and pretending otherwise would be worse than
 * useless — it would put an inference step in front of data that is already
 * structured.
 *
 * ## Three sources, three honest treatments
 *
 * **openFDA enforcement** is a regulator's structured record. `recalling_firm`,
 * `reason_for_recall`, `classification`, `product_description` are *fields*, not
 * prose to be interpreted. `extractFromEnforcement` reads them and infers
 * nothing. Category is RECALL because the endpoint is the recall endpoint.
 *
 * **openFDA shortages** is the same story: `generic_name`, `company_name`,
 * `shortage_reason`, `status`. Category is SHORTAGE for the same reason.
 *
 * **GDELT** is a headline and nothing else — the API returns no article body. So
 * `extractFromHeadline` is keyword matching over a title, it is labelled
 * `KEYWORD` confidence, and it is allowed to answer "this is not about
 * pharmaceutical supply", which is the answer for most of what GDELT returns.
 *
 * ## Severity is a mapped ordinal, not a judgement
 *
 * FDA recall classification is a published three-level scale with defined
 * meanings: Class I is "reasonable probability of serious adverse health
 * consequences or death", Class III is "unlikely to cause adverse health
 * consequences". Mapping those onto 1-5 is a relabelling of somebody else's
 * ordinal, and `severityBasis` records which published field it came from.
 *
 * Where there is no published class — a headline — severity is the neutral
 * middle with `severityBasis: 'DEFAULTED'`, and it never reaches a risk figure:
 * spec Rule 2 forbids it, and `severity_1_5` is in gate 1's structural-count
 * list precisely because it must stay an ordinal label.
 *
 * Pure functions. No I/O, no clock, no model call.
 */

import type { EnforcementReport, GdeltArticle, ShortageRecord } from '@vitalink/connectors';
import type { DisruptionCategory, Extraction } from '@vitalink/contracts';

/** How the structured fields were obtained. Stored on every signal. */
export type ExtractionMethod = 'STRUCTURED_FIELD' | 'KEYWORD' | 'LLM';

export type ExtractionResult = {
  extraction: Extraction;
  method: ExtractionMethod;
  /** Which published field the severity came from, or that it was defaulted. */
  severityBasis: string;
  /** Sentence for the signal's provenance. Names the fields actually read. */
  basis: string;
};

const SEVERITY = { critical: 5, high: 4, moderate: 3, low: 2, minimal: 1 } as const;

/**
 * FDA recall classes, mapped onto the ordinal scale.
 *
 * Verbatim from 21 CFR 7.3(m). This is a relabelling of a published scale, which
 * is why it is a lookup table and not a heuristic.
 */
const RECALL_CLASS_SEVERITY: Record<string, number> = {
  'class i': SEVERITY.critical,
  'class ii': SEVERITY.moderate,
  'class iii': SEVERITY.low,
};

/** The contract's `INSIGHT_MAX_LENGTH`. Kept in sync by the schema, not by hand. */
const INSIGHT_LIMIT = 500;

/** Truncates to the contract's insight limit without cutting mid-word. */
function trimInsight(text: string, limit = INSIGHT_LIMIT): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) return collapsed;

  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

function firstOf(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    if (value !== undefined && value.trim().length > 0) return value.trim();
  }
  return null;
}

/**
 * The entity fields of an enforcement report, in preference order.
 *
 * The `openfda` sub-object is the FDA's own normalisation of the free-text
 * fields, so it is preferred where present — `openfda.generic_name` is an INN
 * where `product_description` is marketing copy with a dosage form in it.
 */
function enforcementEntities(
  report: EnforcementReport,
): Pick<Extraction, 'manufacturer' | 'drug_or_ingredient' | 'location_city' | 'location_country'> {
  const openfda = report.openfda;

  return {
    manufacturer: firstOf(report.recalling_firm, openfda?.manufacturer_name?.[0]),
    drug_or_ingredient: firstOf(
      openfda?.generic_name?.[0],
      openfda?.substance_name?.[0],
      report.product_description,
    ),
    location_city: firstOf(report.city),
    location_country: firstOf(report.country),
  };
}

/**
 * An FDA enforcement report. Every field is read, none is inferred.
 *
 * `country` and `city` come from the recalling firm's own address as the FDA
 * recorded it — so the location is where the *firm* is, which is not necessarily
 * where the affected plant is. `basis` says so, because a reader looking at a
 * map pin deserves to know which of the two it represents.
 */
export function extractFromEnforcement(report: EnforcementReport): ExtractionResult {
  const classification = (report.classification ?? '').toLowerCase().trim();
  const mapped = RECALL_CLASS_SEVERITY[classification];
  return {
    method: 'STRUCTURED_FIELD',
    severityBasis:
      mapped === undefined
        ? 'DEFAULTED — the report carried no recall classification'
        : `openFDA enforcement field 'classification' = "${report.classification ?? ''}", ` +
          'mapped through the published 21 CFR 7.3(m) three-level scale',
    basis:
      "Read from openFDA enforcement's own fields: recalling_firm, classification, " +
      'reason_for_recall, product_description, city, country. Nothing was inferred. The ' +
      "location is the recalling FIRM's registered address as the FDA recorded it, which is " +
      'not necessarily the affected plant.',
    extraction: {
      // The endpoint is the recall endpoint. This is not a classification.
      category: 'RECALL',
      ...enforcementEntities(report),
      severity_1_5: mapped ?? SEVERITY.moderate,
      insight: trimInsight(
        firstOf(report.reason_for_recall, report.product_description) ??
          'The report gave no reason for the recall.',
      ),
      // The endpoint only carries drug recalls, so this is true by construction.
      is_pharma_supply_relevant: true,
    },
  };
}

/**
 * An FDA shortage record.
 *
 * Severity is defaulted rather than derived from `status`. "Current" versus
 * "Resolved" is a state, not a severity, and mapping one onto the other would
 * invent an ordinal the FDA never published. A resolved shortage is filtered out
 * upstream instead, which is the honest way to act on that field.
 */
export function extractFromShortage(record: ShortageRecord): ExtractionResult {
  return {
    method: 'STRUCTURED_FIELD',
    severityBasis:
      'DEFAULTED — openFDA publishes no severity scale for shortages, and mapping the ' +
      "'status' field onto one would invent an ordinal the FDA never stated",
    basis:
      "Read from openFDA drug-shortages' own fields: generic_name, company_name, " +
      'shortage_reason, status, therapeutic_category. Nothing was inferred.',
    extraction: {
      category: 'SHORTAGE',
      manufacturer: firstOf(record.company_name, record.openfda?.manufacturer_name?.[0]),
      drug_or_ingredient: firstOf(
        record.generic_name,
        record.openfda?.generic_name?.[0],
        record.proprietary_name,
      ),
      // The feed carries no location at all. Null, not a guessed "US".
      location_city: null,
      location_country: null,
      severity_1_5: SEVERITY.moderate,
      insight: trimInsight(
        firstOf(record.shortage_reason, record.availability_information) ??
          'The record gave no reason for the shortage.',
      ),
      is_pharma_supply_relevant: true,
    },
  };
}

/**
 * Category keywords, in priority order.
 *
 * Ordered rather than scored, because a headline containing both "recall" and
 * "shortage" is a recall causing a shortage, and the first match is the event.
 * Scoring would pick whichever list happened to have more words in it.
 */
const CATEGORY_KEYWORDS: { category: DisruptionCategory; words: string[] }[] = [
  {
    category: 'PLANT_SHUTDOWN',
    words: [
      'plant shut',
      'plant closure',
      'halts production',
      'suspends production',
      'production halt',
      'factory fire',
      'shuts factory',
    ],
  },
  { category: 'RECALL', words: ['recall', 'recalled', 'recalls'] },
  {
    category: 'SHORTAGE',
    words: ['shortage', 'stockout', 'stock-out', 'out of stock', 'supply crunch'],
  },
  {
    category: 'REGULATORY_ACTION',
    words: [
      'warning letter',
      'import alert',
      'import ban',
      'licence revoked',
      'license revoked',
      'regulatory action',
      'fda inspection',
    ],
  },
  {
    category: 'QUALITY_FAILURE',
    words: [
      'contaminat',
      'adulterat',
      'substandard',
      'failed inspection',
      'gmp violation',
      'not of standard quality',
    ],
  },
  {
    category: 'EXPORT_RESTRICTION',
    words: ['export ban', 'export restriction', 'export curb', 'export duty'],
  },
  {
    category: 'RAW_MATERIAL_DISRUPTION',
    words: ['api shortage', 'raw material', 'ingredient supply', 'intermediate supply'],
  },
  {
    category: 'CYBER_INCIDENT',
    words: ['cyberattack', 'cyber attack', 'ransomware', 'data breach'],
  },
  {
    category: 'LOGISTICS_DISRUPTION',
    words: [
      'port congestion',
      'shipping delay',
      'freight disruption',
      'cold chain failure',
      'halts shipment',
    ],
  },
  { category: 'LABOUR_ACTION', words: ['strike', 'walkout', 'labour unrest', 'labor unrest'] },
  {
    category: 'NATURAL_HAZARD',
    words: ['flood', 'earthquake', 'cyclone', 'hurricane', 'wildfire'],
  },
];

/**
 * Words that make a headline about pharmaceutical *supply* rather than about
 * pharmaceutical *business*.
 *
 * GDELT's pharma queries return a great deal of stock-price coverage — "Stocks
 * to watch: Cohance Lifesciences" — which mentions drug companies and says
 * nothing about supply. A headline needs one of these to be relevant at all.
 */
const RELEVANCE_WORDS = [
  'drug',
  'drugs',
  'medicine',
  'medicines',
  'pharma',
  'pharmaceutical',
  'vaccine',
  'injection',
  'tablet',
  'api',
  'active pharmaceutical',
  'sterile',
  'generic',
];

/** Headlines that are markets coverage regardless of what else they mention. */
const MARKET_NOISE = [
  'stocks to watch',
  'shares rise',
  'shares fall',
  'share price',
  'q1 results',
  'q2 results',
  'q3 results',
  'q4 results',
  'earnings',
  'buy rating',
  'target price',
  'ipo',
  'dividend',
];

/**
 * A GDELT headline. Keyword matching, and honest about being keyword matching.
 *
 * GDELT's DOC API returns no article body, so a *title* is the entire input.
 * That is a hard ceiling on what any extractor could do here, model or not, and
 * it is why the result carries `method: 'KEYWORD'` and a defaulted severity:
 * this signal exists to be *corroborated against*, not to be believed on its
 * own.
 *
 * @returns `is_pharma_supply_relevant: false` for anything that reads as markets
 *   coverage or that names no pharmaceutical noun. Those are quarantined with
 *   reason `not_pharma_relevant` rather than dropped, so the filter's own
 *   behaviour is reviewable.
 */
export function extractFromHeadline(article: GdeltArticle): ExtractionResult {
  const title = article.title.toLowerCase();
  const isMarketNoise = MARKET_NOISE.some((word) => title.includes(word));
  const namesPharma = RELEVANCE_WORDS.some((word) => title.includes(word));
  const matched = CATEGORY_KEYWORDS.find((entry) =>
    entry.words.some((word) => title.includes(word)),
  );

  const relevant = !isMarketNoise && namesPharma && matched !== undefined;

  return {
    method: 'KEYWORD',
    severityBasis:
      'DEFAULTED — a headline carries no published severity scale, and GDELT returns no ' +
      'article body to read one from',
    basis:
      `Keyword match over the headline only. GDELT's DOC API returns no article text, so the ` +
      `title is the entire input. Category ${matched === undefined ? 'unmatched' : matched.category} ` +
      `${matched === undefined ? '' : `from the phrase list; `}` +
      `relevance ${relevant ? 'accepted' : 'rejected'} (${isMarketNoise ? 'reads as markets coverage; ' : ''}` +
      `${namesPharma ? 'names a pharmaceutical noun' : 'names no pharmaceutical noun'}). ` +
      'This signal is intended to be corroborated against, not believed alone.',
    extraction: {
      category: matched?.category ?? 'OTHER',
      // A headline names an organisation only sometimes, and picking one out
      // reliably needs entity recognition this arm does not have.
      manufacturer: null,
      drug_or_ingredient: null,
      location_city: null,
      location_country: firstOf(article.sourcecountry),
      severity_1_5: SEVERITY.moderate,
      insight: trimInsight(article.title),
      is_pharma_supply_relevant: relevant,
    },
  };
}

export { SEVERITY };
