/**
 * Reading the shipping temperature requirement out of real drug labels.
 *
 * Spec 6.5 is emphatic that `temperature_requirement` is *"read from the real
 * label, never asked of the user"*. It matters because the requirement is a
 * **hard constraint** in the logistics eligibility gate: a carrier that cannot
 * hold 2-8 °C is eliminated outright, not scored down. A wrong parse does not
 * shade a number, it disqualifies the wrong carrier — or worse, mandates a cold
 * chain for a product whose label forbids one.
 *
 * This file was rewritten three times. Every rewrite was forced by running it
 * against live openFDA labels, and the history is the most useful thing in it.
 *
 * ## Round one: two regex bugs
 *
 * Insulin glargine came out **ambient**. The pattern was
 * `/\b(?:...|refrigerat|...)\b/i`, and in "Refrigerated" the character after
 * `refrigerat` is `e`, so the trailing `\b` never matched. The numeric fallback
 * missed too, because labels write `36°F to 46°F` — the unit letter sits between
 * the number and the word "to".
 *
 * ## Round two: "strictest condition wins" is wrong
 *
 * Three real labels show why:
 *
 *   cisplatin      "Store at 20° to 25°C. **Do not refrigerate.**"
 *   amoxicillin    "Store dry powder at or below 25°C. Store **reconstituted**
 *                   suspension under refrigeration."
 *   methotrexate   "Store at 20°C to 25°C. **After first puncture**, store
 *                   multiple-dose vials at 2°C to 8°C."
 *
 * Strictest-wins reads all three as 2-8 °C, and all three are wrong. The
 * cisplatin case is dangerous in both directions: it eliminates every correct
 * carrier *and* requires refrigeration the label explicitly forbids.
 *
 * The right rule is the one a pharmacist would state: **the shipping condition is
 * the one that applies to unopened, un-reconstituted product.**
 *
 * ## Round three: scope is sticky, and labels must not be merged
 *
 * Two further failures, both only visible on live data.
 *
 * **Merging labels corrupts the parse.** This function used to receive the
 * `storage_and_handling` sections of several labels joined into one string. Those
 * are *different products*. Three live insulin glargine labels gave:
 *
 *   BASAGLAR   "Not In-Use (Unopened) Refrigerated (36°F to 46°F [2°C to 8°C])"
 *   LANGLARA   "... In-use (opened) ... Room temperature only (Do not refrigerate)"
 *
 * Joined, LANGLARA's in-use parenthetical prohibited 2-8 °C and cancelled
 * BASAGLAR's requirement, so the generic came out ambient — the exact failure
 * round one was supposed to have fixed. Labels are now parsed **individually**
 * and combined afterwards, with disagreement between products reported rather
 * than silently resolved.
 *
 * **Scope is sticky.** A negation belongs to the scope its sentence sits in, not
 * to the sentence alone. "Do not refrigerate" under an "In-use (opened)" heading
 * forbids refrigeration *of opened product* and says nothing about shipping. So
 * the parser walks clauses in order carrying a current scope, and a prohibition
 * inherits it. Atropine's "AVOID FREEZING Store PHENOHYTRO ELIXIR at 20°-25°C"
 * falls out of the same mechanism: splitting before `Store` separates the
 * prohibition from the requirement that follows it.
 *
 * The parser stays conservative throughout: it returns `null` rather than
 * guessing, and a null renders as an empty state with a reason. Defaulting an
 * unparseable label to "ambient" would let a carrier with no cold chain win.
 */

import type { TemperatureRange } from '@vitalink/contracts';

/** One product's parse. A generic name usually has several. */
export type LabelStorageParse = {
  /** The shipping requirement for this product. Null when none was found. */
  range: TemperatureRange | null;
  /** Conditions stated for unopened product, strictest first. */
  allMatched: TemperatureRange[];
  /** Conditions forbidden for unopened product, e.g. cisplatin's refrigeration. */
  prohibited: TemperatureRange[];
  /** Conditions scoped to in-use or reconstituted product. Not shipping conditions. */
  inUseOnly: TemperatureRange[];
  isColdChain: boolean;
  matchedPhrase: string | null;
  excursionUpperC: number | null;
  reason: string;
};

/** The drug-level answer, combined across every product under one generic name. */
export type StorageParse = LabelStorageParse & {
  labelsParsed: number;
  /**
   * True when products under this generic name state different shipping
   * requirements. The operator must then pick a product, because a shipment
   * carries a specific NDC rather than a generic name.
   */
  productsDisagree: boolean;
  /** Every distinct shipping requirement found across products, strictest first. */
  requirementsAcrossProducts: TemperatureRange[];
};

/**
 * Conditions in strictness order, strictest first. "Strictest" means hardest to
 * transport, which is what makes "take the strictest" well defined once the
 * clauses have been scoped.
 */
const CONDITIONS: { range: TemperatureRange; pattern: RegExp; cold: boolean }[] = [
  {
    range: 'cryogenic',
    pattern: /(?:liquid nitrogen|vapor phase|-1[5-9]\d\s*°?\s*C)/i,
    cold: true,
  },
  {
    range: 'frozen',
    pattern: /(?:store (?:in (?:a|the) )?freezer|keep frozen|freez|-2[05]\s*°?\s*C)/i,
    cold: true,
  },
  {
    range: '2-8C',
    pattern:
      /(?:refrigerat|cold chain|2\s*°?\s*C?\s*(?:to|-|–|—|and)\s*8\s*°?\s*C|36\s*°?\s*F?\s*(?:to|-|–|—|and)\s*46\s*°?\s*F)/i,
    cold: true,
  },
  {
    range: '15-25C',
    pattern:
      /(?:1[05]\s*°?\s*C?\s*(?:to|-|–|—|and)\s*2[05]\s*°?\s*C|2[05]\s*°?\s*C?\s*(?:to|-|–|—|and)\s*2[05]\s*°?\s*C|controlled room temperature|(?:at or below|not above|below)\s*2[0-9]\s*°?\s*C|68\s*°?\s*F?\s*(?:to|-|–|—|and)\s*77\s*°?\s*F)/i,
    cold: false,
  },
  {
    // `(?<!controlled )` matters: "[See USP Controlled Room Temperature.]" is one
    // condition, not two, and without it the phrase matches 15-25C and ambient.
    range: 'ambient',
    pattern: /(?:(?<!controlled )room temperature|ambient|store at 25\s*°?\s*C)/i,
    cold: false,
  },
];

/** Phrases that put the following text into the in-use scope. */
const ENTERS_IN_USE =
  /(?:after (?:reconstitution|dilution|first puncture|first use|opening|mixing)|reconstitut|diluted|once opened|(?<!not )in-?use|(?<!un)opened\)|thawed)/i;

/** Phrases that put the following text back into the shipping (unopened) scope. */
const ENTERS_SHIPPING = /(?:not in-?use|unopened|prior to (?:first )?use|before (?:first )?use)/i;

/** A clause opening with one of these forbids the condition it names. */
const NEGATION =
  /^.{0,20}?(?:do(?:es)? not|don't|must not(?: be)?|should not(?: be)?|never|avoid)/i;

/**
 * Boundaries that start a new clause where punctuation does not.
 *
 * Labels present unopened and in-use conditions as unpunctuated table rows, and
 * write "AVOID FREEZING Store X at 20°-25°C" with no separator at all. Splitting
 * before `Store` and before each scope or negation marker separates them.
 *
 * The `(?<!not )` on the bare `in-?use` alternative is load-bearing: `String.split`
 * tests a zero-width assertion at every position, so without it the engine splits
 * both before "Not" and before "In-Use", leaving a clause of the single word "Not"
 * and detaching the condition from its scope.
 */
const CLAUSE_BOUNDARIES =
  /(?=\b(?:not in-?use|(?<!not )in-?use|after (?:reconstitution|dilution|first puncture|first use|opening|mixing)|once opened|reconstituted|prior to (?:first )?use|store|do(?:es)? not|don't|must not|should not|never|avoid)\b)/i;

/** "excursions permitted between 15°C and 30°C" -> 30. */
const EXCURSION_PATTERN =
  /excursions?\s+(?:permitted|allowed)[^.]*?(\d{1,2})\s*°?\s*C?\s*(?:and|to|-|–)\s*(\d{1,2})\s*°?\s*C/i;

type Scope = 'shipping' | 'in_use';

export type ScopedClause = { text: string; scope: Scope; isProhibition: boolean };

/**
 * Splits one label's storage text into clauses and assigns each a scope.
 *
 * The scope is **sticky**: set by a scope marker and carried forward until
 * another marker changes it. That is what makes "Do not refrigerate" under an
 * "In-use (opened)" heading a statement about opened product rather than about
 * shipping. Exported because this is where the parse is won or lost.
 */
export function scopeClauses(text: string): ScopedClause[] {
  const raw = text
    .split(/(?<=[.;])\s+/)
    .flatMap((sentence) => sentence.split(CLAUSE_BOUNDARIES))
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);

  let scope: Scope = 'shipping';
  const scoped: ScopedClause[] = [];

  for (const clause of raw) {
    // Shipping is tested first, because "Not In-Use (Unopened)" matches both
    // patterns and is a shipping heading.
    if (ENTERS_SHIPPING.test(clause)) {
      scope = 'shipping';
    } else if (ENTERS_IN_USE.test(clause)) {
      scope = 'in_use';
    }

    scoped.push({ text: clause, scope, isProhibition: NEGATION.test(clause) });
  }

  return scoped;
}

type Matched = { range: TemperatureRange; phrase: string; cold: boolean };

function conditionsIn(clauses: ScopedClause[]): Matched[] {
  const text = clauses.map((clause) => clause.text).join(' ');
  if (text.length === 0) return [];

  return CONDITIONS.flatMap((condition) => {
    const match = condition.pattern.exec(text);
    return match === null
      ? []
      : [{ range: condition.range, phrase: match[0], cold: condition.cold }];
  });
}

/**
 * Parses **one** label's storage section.
 *
 * @param sections one label's `storage_and_handling` array.
 */
export function parseLabelStorage(sections: readonly string[]): LabelStorageParse {
  const text = sections.join(' ').trim();

  if (text.length === 0) {
    return emptyLabelParse(
      'This label has no storage_and_handling section, so no temperature requirement ' +
        'could be read from it.',
    );
  }

  const clauses = scopeClauses(text);
  const excursionUpperC = parseExcursion(text);

  const shipping = conditionsIn(
    clauses.filter((clause) => clause.scope === 'shipping' && !clause.isProhibition),
  );
  const prohibited = conditionsIn(
    clauses.filter((clause) => clause.scope === 'shipping' && clause.isProhibition),
  ).map((one) => one.range);
  const inUseOnly = conditionsIn(clauses.filter((clause) => clause.scope === 'in_use')).map(
    (one) => one.range,
  );

  const usable = shipping.filter((one) => !prohibited.includes(one.range));
  const strictest = usable[0];

  if (strictest === undefined) {
    return {
      ...emptyLabelParse(
        'No storage condition applies to unopened product on this label. ' +
          (inUseOnly.length > 0
            ? `It states ${inUseOnly.join(', ')} but only for in-use or reconstituted product. `
            : '') +
          (prohibited.length > 0 ? `It forbids ${prohibited.join(', ')}. ` : '') +
          'Returning null rather than defaulting to ambient, because defaulting would let a ' +
          'carrier with no cold chain pass the eligibility gate.',
      ),
      prohibited,
      inUseOnly,
      excursionUpperC,
    };
  }

  const allMatched = usable.map((one) => one.range);

  return {
    range: strictest.range,
    allMatched,
    prohibited,
    inUseOnly,
    isColdChain: strictest.cold,
    matchedPhrase: strictest.phrase,
    excursionUpperC,
    reason: buildReason(strictest, allMatched, prohibited, inUseOnly),
  };
}

/**
 * Parses every label for one generic name and combines them.
 *
 * @param labels one entry per product, each holding that label's
 *   `storage_and_handling` sections. **Do not pre-join them** — they are
 *   different products, and merging lets one product's prohibition cancel
 *   another's requirement.
 */
export function parseStorage(labels: readonly (readonly string[])[]): StorageParse {
  const parses = labels.map((sections) => parseLabelStorage(sections));
  const resolved = parses.filter((parse) => parse.range !== null);

  if (resolved.length === 0) {
    return {
      ...(parses[0] ??
        emptyLabelParse(
          'No labels with a storage_and_handling section were found for this generic name.',
        )),
      labelsParsed: labels.length,
      productsDisagree: false,
      requirementsAcrossProducts: [],
    };
  }

  const found = new Set(resolved.map((parse) => parse.range));
  // Ordered by strictness, so the first entry is the safest drug-level default.
  const byStrictness = CONDITIONS.map((condition) => condition.range).filter((range) =>
    found.has(range),
  );

  const strictestRange = byStrictness[0];
  const strictestParse = resolved.find((parse) => parse.range === strictestRange);

  if (strictestParse === undefined || strictestRange === undefined) {
    throw new Error('unreachable: resolved was non-empty');
  }

  const productsDisagree = byStrictness.length > 1;

  return {
    ...strictestParse,
    // Unioned across products, so a caveat on any one product stays visible.
    inUseOnly: [...new Set(resolved.flatMap((parse) => parse.inUseOnly))],
    prohibited: [...new Set(resolved.flatMap((parse) => parse.prohibited))],
    excursionUpperC:
      resolved.map((parse) => parse.excursionUpperC).find((value) => value !== null) ?? null,
    labelsParsed: labels.length,
    productsDisagree,
    requirementsAcrossProducts: byStrictness,
    reason: productsDisagree
      ? `Products under this generic name state different shipping requirements ` +
        `(${byStrictness.join(', ')}) across ${String(resolved.length)} labels. Took the ` +
        `strictest, ${strictestRange}, as the drug-level default — but a shipment carries a ` +
        'specific product, so the operator must confirm which.'
      : `${strictestParse.reason} Agreed across ${String(resolved.length)} label(s).`,
  };
}

function buildReason(
  strictest: Matched,
  allMatched: TemperatureRange[],
  prohibited: TemperatureRange[],
  inUseOnly: TemperatureRange[],
): string {
  const parts = [`Matched "${strictest.phrase}" for unopened product -> ${strictest.range}.`];

  if (allMatched.length > 1) {
    parts.push(
      `The label states ${allMatched.join(', ')} for unopened product; took the strictest.`,
    );
  }
  if (inUseOnly.length > 0) {
    parts.push(
      `${inUseOnly.join(', ')} appears but is scoped to in-use or reconstituted product, ` +
        'which a shipment is not, so it was excluded.',
    );
  }
  if (prohibited.length > 0) {
    parts.push(`The label FORBIDS ${prohibited.join(', ')}, which is itself a hard constraint.`);
  }

  return parts.join(' ');
}

function emptyLabelParse(reason: string): LabelStorageParse {
  return {
    range: null,
    allMatched: [],
    prohibited: [],
    inUseOnly: [],
    isColdChain: false,
    matchedPhrase: null,
    excursionUpperC: null,
    reason,
  };
}

/**
 * Extracts the upper bound of a stated excursion allowance.
 *
 * Used by the logistics risk sub-score: a lane whose forecast ambient exceeds
 * the label's own ceiling is a modelled excursion probability, not an opinion.
 */
export function parseExcursion(text: string): number | null {
  const match = EXCURSION_PATTERN.exec(text);
  if (match === null) return null;

  const upper = Number(match[2]);
  return Number.isFinite(upper) ? upper : null;
}

/**
 * The special-handling requirements implied by a parsed storage section.
 * Derived from the label, because these become hard constraints in the gate.
 */
export function impliedSpecialHandling(
  parse: LabelStorageParse,
): ('cold_chain' | 'temperature_monitoring')[] {
  if (!parse.isColdChain) return [];
  // A cold-chain shipment nobody can prove stayed in range is, for a
  // pharmaceutical, the same as a failed one. So monitoring comes with it.
  return ['cold_chain', 'temperature_monitoring'];
}
