/**
 * Storage-section parsing tests.
 *
 * **Every label string in this file is verbatim from a real openFDA
 * `drug/label` response, fetched 8-9 September 2026.** That is not decoration.
 * Two rounds of bugs in this parser were invisible to synthetic test strings and
 * obvious the moment real labels went through it, so the real text is the test
 * data and the drug name is in the test name.
 *
 * This parse feeds a hard constraint: a carrier that cannot hold the parsed
 * range is eliminated from the comparison outright. A wrong parse does not shade
 * a score, it disqualifies the wrong carrier — or, in the cisplatin case,
 * mandates refrigeration the label explicitly forbids.
 */

import { describe, expect, it } from 'vitest';

import {
  impliedSpecialHandling,
  parseExcursion,
  parseLabelStorage,
  parseStorage,
  scopeClauses,
} from '../domain/storage-parsing';

/** Heparin sodium. A plain single-condition label. */
const HEPARIN =
  'Store at 20° to 25°C (68° to 77°F); excursions permitted between 15° and 30°C ' +
  '(59° and 86°F). [See USP Controlled Room Temperature.] Sterile, Nonpyrogenic.';

/** Insulin glargine (BASAGLAR). States the shipping condition as "Not In-Use". */
const INSULIN =
  '16.2 Storage and Handling Dispense in the original sealed carton with the enclosed ' +
  'Instructions for Use. Protect BASAGLAR from heat and light. Do not freeze BASAGLAR. ' +
  'Storage conditions are summarized in the following table: ' +
  'Not In-Use (Unopened) Refrigerated (36°F to 46°F [2°C to 8°C]) ' +
  'In-Use (Opened) Room Temperature, (up to 86°F [30°C])';

/** Cisplatin. The dangerous case: refrigeration is explicitly forbidden. */
const CISPLATIN =
  'Storage Conditions Store at 20° to 25°C (68° to 77°F). [See USP Controlled Room ' +
  'Temperature.] Do not refrigerate. Protect from light. Sterile, Nonpyrogenic, ' +
  'Preservative-free.';

/** Amoxicillin and clavulanate. Refrigeration applies only after reconstitution. */
const AMOXICILLIN =
  'Storage Store dry powder for oral suspension at or below 25°C (77°F). Dispense in ' +
  'original container. Store reconstituted suspension under refrigeration. Discard unused ' +
  'suspension after 10 days.';

/** Methotrexate injection. 2-8 °C applies only after first puncture. */
const METHOTREXATE =
  'Storage and Handling Store at 20°C to 25°C (68°F to 77°F); excursions permitted to 15°C ' +
  'to 30°C (59°F to 86°F) [see USP Controlled Room Temperature]. Protect from light. After ' +
  'first puncture, store multiple-dose vials at 2°C to 8°C, and use within 30 days.';

describe('cisplatin: a forbidden condition is not a requirement', () => {
  it('does not read "Do not refrigerate" as a refrigeration requirement', () => {
    // The most dangerous error the parser could make. It would eliminate every
    // correct carrier AND mandate handling the label explicitly forbids.
    const result = parseLabelStorage([CISPLATIN]);

    expect(result.range).toBe('15-25C');
    expect(result.isColdChain).toBe(false);
  });

  it('records the prohibition, because it is itself a hard constraint', () => {
    // A reefer-only service is the wrong choice for this drug, and the gate can
    // only know that if the prohibition is carried forward.
    const result = parseLabelStorage([CISPLATIN]);

    expect(result.prohibited).toContain('2-8C');
  });

  it('says in its reason that the label forbids refrigeration', () => {
    const result = parseLabelStorage([CISPLATIN]);

    expect(result.reason).toContain('FORBIDS');
  });
});

describe('amoxicillin: a reconstituted-product condition is not a shipping condition', () => {
  it('ships at room temperature, not refrigerated', () => {
    // "Store reconstituted suspension under refrigeration" describes a state
    // the shipment is not in: reconstitution happens at the point of care.
    const result = parseLabelStorage([AMOXICILLIN]);

    expect(result.range).toBe('15-25C');
    expect(result.isColdChain).toBe(false);
  });

  it('records the refrigeration as in-use only, rather than discarding it', () => {
    const result = parseLabelStorage([AMOXICILLIN]);

    expect(result.inUseOnly).toContain('2-8C');
  });

  it('explains why the refrigeration clause was excluded', () => {
    const result = parseLabelStorage([AMOXICILLIN]);

    expect(result.reason).toContain('scoped to in-use or reconstituted');
  });
});

describe('methotrexate: an after-first-puncture condition is not a shipping condition', () => {
  it('ships at room temperature', () => {
    const result = parseLabelStorage([METHOTREXATE]);

    expect(result.range).toBe('15-25C');
  });

  it('records the 2-8C as in-use only', () => {
    const result = parseLabelStorage([METHOTREXATE]);

    expect(result.inUseOnly).toContain('2-8C');
  });

  it('still extracts the excursion allowance from the shipping clause', () => {
    const result = parseLabelStorage([METHOTREXATE]);

    expect(result.excursionUpperC).toBe(30);
  });
});

describe('insulin glargine: "Not In-Use" is the shipping condition', () => {
  it('reads it as 2-8C, not ambient', () => {
    // The round-one bug. Returning "ambient" here would let a carrier with no
    // cold chain pass the gate for an insulin shipment.
    const result = parseLabelStorage([INSULIN]);

    expect(result.range).toBe('2-8C');
    expect(result.isColdChain).toBe(true);
  });

  it('is not confused by "Not In-Use" containing the string "In-Use"', () => {
    // A naive in-use marker strips exactly the clause that matters, which is why
    // the marker carries a `(?<!not )` lookbehind.
    const result = parseLabelStorage([INSULIN]);

    expect(result.allMatched).toContain('2-8C');
  });

  it('does not read "Do not freeze" as a freezing instruction', () => {
    // It appears on almost every refrigerated label.
    const result = parseLabelStorage([INSULIN]);

    expect(result.range).not.toBe('frozen');
    expect(result.prohibited).toContain('frozen');
  });

  it('requires cold-chain handling and monitoring', () => {
    const result = parseLabelStorage([INSULIN]);

    expect(impliedSpecialHandling(result)).toEqual(['cold_chain', 'temperature_monitoring']);
  });
});

describe('heparin sodium: a plain single-condition label', () => {
  it('reads controlled room temperature as 15-25C', () => {
    const result = parseLabelStorage([HEPARIN]);

    expect(result.range).toBe('15-25C');
    expect(result.isColdChain).toBe(false);
  });

  it('is not fooled by "20° to 25°C" looking like "2 to 8"', () => {
    const result = parseLabelStorage([HEPARIN]);

    expect(result.range).not.toBe('2-8C');
  });

  it('extracts the stated excursion ceiling', () => {
    const result = parseLabelStorage([HEPARIN]);

    expect(result.excursionUpperC).toBe(30);
  });

  it('reports one condition, not two, from "Controlled Room Temperature"', () => {
    // Without the `(?<!controlled )` lookbehind on the ambient pattern, this one
    // phrase matches two conditions and the multiple-conditions signal becomes
    // noise on a label that stated a single requirement.
    const result = parseLabelStorage([HEPARIN]);

    expect(result.allMatched).toEqual(['15-25C']);
  });
});

describe('parseStorage, across the several products under one generic name', () => {
  it("does not let one product's prohibition cancel another's requirement", () => {
    // The round-three bug, and the worst of the three. Joined into one string,
    // LANGLARA's in-use "Room temperature only (Do not refrigerate)" prohibited
    // 2-8C and cancelled BASAGLAR's refrigeration requirement, so insulin
    // glargine came out ambient.
    const langlaraInUseOnly = [
      'Store unused LANGLARA in a refrigerator between 36\u00b0F and 46\u00b0F (2\u00b0C and 8\u00b0C). ' +
        'Do not freeze. In-use (opened) Room temperature only (Do not refrigerate).',
    ];

    const merged = parseLabelStorage([...langlaraInUseOnly, ...[INSULIN]].join(' ').split('|||'));
    const perLabel = parseStorage([langlaraInUseOnly, [INSULIN]]);

    // Whatever the merged parse does, the per-label parse must be 2-8C.
    expect(perLabel.range).toBe('2-8C');
    expect(perLabel.isColdChain).toBe(true);
    expect(merged.range).not.toBeUndefined();
  });

  it('reports how many labels it parsed', () => {
    const result = parseStorage([[HEPARIN], [CISPLATIN]]);

    expect(result.labelsParsed).toBe(2);
  });

  it('takes the strictest requirement as the drug-level default', () => {
    const result = parseStorage([[HEPARIN], [INSULIN]]);

    expect(result.range).toBe('2-8C');
  });

  it('flags disagreement between products rather than resolving it silently', () => {
    // A shipment carries a specific NDC, not a generic name. If products differ,
    // the operator has to say which one — so the disagreement is the finding.
    const result = parseStorage([[HEPARIN], [INSULIN]]);

    expect(result.productsDisagree).toBe(true);
    expect(result.requirementsAcrossProducts).toEqual(['2-8C', '15-25C']);
    expect(result.reason).toContain('must confirm which');
  });

  it('does not flag disagreement when every product agrees', () => {
    const result = parseStorage([[HEPARIN], [CISPLATIN]]);

    expect(result.productsDisagree).toBe(false);
    expect(result.range).toBe('15-25C');
  });

  it('returns null when no product resolved a shipping requirement', () => {
    const result = parseStorage([['Keep out of reach of children.'], []]);

    expect(result.range).toBeNull();
    expect(result.productsDisagree).toBe(false);
  });

  it('returns null for a generic name with no labels at all', () => {
    const result = parseStorage([]);

    expect(result.range).toBeNull();
    expect(result.labelsParsed).toBe(0);
  });
});

describe('scopeClauses', () => {
  it('marks a negated clause as a prohibition', () => {
    const clauses = scopeClauses('Store at 20°C. Do not refrigerate.');

    expect(clauses.find((clause) => /refrigerat/i.test(clause.text))?.isProhibition).toBe(true);
    expect(clauses.find((clause) => /20/.test(clause.text))?.scope).toBe('shipping');
  });

  it('splits before a negation even when the full stop sits inside a bracket', () => {
    // Cisplatin's real label: "[See USP Controlled Room Temperature.] Do not
    // refrigerate." Sentence splitting cannot separate these, and without a
    // split the prohibition took the room-temperature requirement with it.
    const clauses = scopeClauses('[See USP Controlled Room Temperature.] Do not refrigerate.');

    expect(clauses.find((clause) => /controlled/i.test(clause.text))?.scope).toBe('shipping');
    expect(clauses.find((clause) => /^do not/i.test(clause.text))?.isProhibition).toBe(true);
  });

  it('marks a reconstitution clause as in-use', () => {
    const clauses = scopeClauses(
      'Store dry powder below 25°C. Store reconstituted suspension under refrigeration.',
    );

    // Asserted by which clause carries the condition rather than by exact
    // clause count: scope splitting can legitimately produce a fragment either
    // side of the marker, and the count is not what the parse depends on.
    const refrigeration = clauses.find((clause) => /refrigerat/i.test(clause.text));
    const dryPowder = clauses.find((clause) => /dry powder/i.test(clause.text));
    expect(refrigeration?.scope).toBe('in_use');
    expect(dryPowder?.scope).toBe('shipping');
  });

  it('marks an after-first-puncture clause as in-use', () => {
    const clauses = scopeClauses(
      'Store at 20°C to 25°C. After first puncture, store vials at 2°C to 8°C.',
    );

    expect(clauses[1]?.scope).toBe('in_use');
  });

  it('splits on semicolons as well as full stops', () => {
    const clauses = scopeClauses('Store at 20°C; do not freeze.');

    expect(clauses).toHaveLength(2);
    expect(clauses[1]?.isProhibition).toBe(true);
  });
});

describe('other cold-chain phrasings', () => {
  it('matches "Refrigerated" despite the trailing letters', () => {
    expect(parseLabelStorage(['Store Refrigerated.']).range).toBe('2-8C');
  });

  it('matches a Fahrenheit range with the unit between the numbers', () => {
    expect(parseLabelStorage(['Store at 36°F to 46°F.']).range).toBe('2-8C');
  });

  it('reads an explicit freezer instruction as frozen', () => {
    const result = parseLabelStorage(['Store in a freezer at -25°C to -15°C.']);

    expect(result.range).toBe('frozen');
    expect(result.isColdChain).toBe(true);
  });

  it('reads liquid-nitrogen storage as cryogenic', () => {
    const result = parseLabelStorage(['Store in the vapor phase of liquid nitrogen.']);

    expect(result.range).toBe('cryogenic');
  });

  it('reads "at or below 25°C" as room temperature', () => {
    expect(parseLabelStorage(['Store at or below 25°C.']).range).toBe('15-25C');
  });
});

describe('refusing to guess', () => {
  it('returns null for a label with no storage section', () => {
    const result = parseLabelStorage([]);

    expect(result.range).toBeNull();
    expect(result.reason).toContain('no storage_and_handling section');
  });

  it('returns null for a storage section it cannot interpret', () => {
    const result = parseLabelStorage(['Keep out of reach of children.']);

    expect(result.range).toBeNull();
    expect(result.allMatched).toEqual([]);
  });

  it('returns null when the only condition stated is scoped to in-use product', () => {
    // A shipment has no shipping condition here. Falling back to ambient would
    // be a guess, and the operator must supply a SCENARIO value instead.
    const result = parseLabelStorage(['After reconstitution, refrigerate at 2°C to 8°C.']);

    expect(result.range).toBeNull();
    expect(result.inUseOnly).toContain('2-8C');
    expect(result.reason).toContain('only for in-use or reconstituted');
  });

  it('says explicitly why it did not default to ambient', () => {
    const result = parseLabelStorage(['Storage: see carton.']);

    expect(result.reason).toContain('rather than defaulting to ambient');
  });

  it('still extracts an excursion allowance from otherwise unparseable text', () => {
    const result = parseLabelStorage([
      'Storage: see carton. Excursions permitted between 10° and 32°C.',
    ]);

    expect(result.range).toBeNull();
    expect(result.excursionUpperC).toBe(32);
  });
});

describe('parseExcursion', () => {
  it('returns the upper bound of a stated allowance', () => {
    expect(parseExcursion('excursions permitted between 15° and 30°C')).toBe(30);
  });

  it('returns null when the label states no allowance', () => {
    expect(parseExcursion('Store at 2-8°C.')).toBeNull();
  });

  it('does not run past a sentence boundary', () => {
    expect(parseExcursion('Excursions permitted. Store between 15 and 30°C.')).toBeNull();
  });
});

describe('impliedSpecialHandling', () => {
  it('requires nothing extra for a room-temperature drug', () => {
    expect(impliedSpecialHandling(parseLabelStorage([HEPARIN]))).toEqual([]);
  });

  it('requires nothing extra when the range could not be parsed', () => {
    expect(impliedSpecialHandling(parseLabelStorage(['Storage: see carton.']))).toEqual([]);
  });
});
