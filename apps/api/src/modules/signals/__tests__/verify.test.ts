/**
 * VERIFY's four judgements, each tested against the case it exists to catch.
 *
 * Dedupe exists to stop twenty copies of one wire story counting as twenty
 * sources. Independence exists to stop two endpoints of one agency counting as
 * two. Veracity exists to stop one authoritative source clearing a threshold
 * that requires two. Resolution exists to stop a cascade being run from the
 * wrong firm. Each of those is the first test in its block.
 */

import { describe, expect, it } from 'vitest';

import {
  DEDUPE_SHINGLE_SIZE,
  MIN_INDEPENDENT_SOURCES,
  MS_PER_DAY,
  VERACITY_RECENCY_HALF_LIFE_DAYS,
} from '@config/constants';

import { clusterSignals, namesDifferentEntities, normaliseEntity } from '../domain/cluster';
import {
  countIndependentSources,
  independenceKey,
  registrableDomain,
} from '../domain/independence';
import { resolveToNode, type NodeCandidate } from '../domain/resolve';
import {
  areNearDuplicates,
  hammingDistance,
  jaccardSimilarity,
  shingleSizeFor,
  simhash,
} from '../domain/simhash';
import {
  computeVeracity,
  credibilityClass,
  credibilityTerm,
  independenceTerm,
  recencyTerm,
} from '../domain/veracity';

const NOW = new Date('2026-09-09T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

describe('dedupe, and what it can and cannot do on a headline', () => {
  const original =
    'Fresenius Kabi recalls injection vials after particulate matter found during inspection';
  const rewrite =
    'Fresenius Kabi recalls injection vials following particulate matter found during inspection';
  const differentFirm =
    'B Braun Medical recalls injection vials after particulate matter found during inspection';

  it('cannot separate a rewrite from a different firm on text alone', () => {
    // The measurement that shaped the whole design, pinned here so it cannot
    // quietly change. A different firm's identically-worded recall scores as
    // similar as a genuine rewrite of the same story. There is no threshold
    // between 0.615 and 0.667 that is not an accident of this example, which is
    // why the entity constraint in `cluster.ts` does the real work.
    const rewriteScore = jaccardSimilarity(original, rewrite);
    const otherFirmScore = jaccardSimilarity(original, differentFirm);

    expect(rewriteScore).toBeCloseTo(0.667, 2);
    expect(otherFirmScore).toBeCloseTo(0.615, 2);
    expect(rewriteScore - otherFirmScore).toBeLessThan(0.1);
  });

  it('under-merges rather than over-merges at the configured threshold', () => {
    // 0.667 is below the 0.7 threshold, so a one-word rewrite does NOT merge.
    // Deliberate: under-merging costs a duplicate alert and an under-counted
    // independence score, where over-merging loses a disruption and does so
    // invisibly. The safe direction is the one that stays visible.
    expect(areNearDuplicates(original, rewrite).areDuplicates).toBe(false);
  });

  it('merges text that is genuinely the same', () => {
    expect(areNearDuplicates(original, original).areDuplicates).toBe(true);
    expect(hammingDistance(simhash(original), simhash(original))).toBe(0);
  });

  it('adapts the shingle size to document length', () => {
    // Five-word shingles on an 11-word headline leave seven features, and one
    // changed word destroys five of them — scoring a rewrite at 0.167, which is
    // indistinguishable from unrelated text.
    expect(shingleSizeFor(11)).toBe(2);
    expect(shingleSizeFor(400)).toBe(DEDUPE_SHINGLE_SIZE);
    expect(jaccardSimilarity(original, rewrite, DEDUPE_SHINGLE_SIZE)).toBeCloseTo(0.167, 2);
  });

  it('skips the SimHash prefilter when there are too few features to compare', () => {
    // The prefilter was rejecting genuine rewrites before Jaccard ever saw
    // them, because at seven features its Hamming distance is noise.
    const verdict = areNearDuplicates(original, rewrite);
    expect(verdict.decidedBy).not.toBe('hamming_far');
  });

  it('still rejects unrelated text outright', () => {
    const verdict = areNearDuplicates(
      original,
      'earthquake damages road network in northern Japan overnight',
    );

    expect(verdict.areDuplicates).toBe(false);
    expect(verdict.jaccard).toBe(0);
  });

  it('does not make every short document identical', () => {
    // A document shorter than one shingle yields one shingle of the whole text
    // rather than an empty set — an empty set would make every short document
    // match every other, which is the opposite of what dedupe is for.
    expect(areNearDuplicates('recall', 'shortage').areDuplicates).toBe(false);
  });
});

describe('clustering will not merge two firms', () => {
  const signals = [
    {
      id: 'a',
      title: 'Fresenius Kabi recalls injection vials over particulate matter',
      text: 'particulate matter found during routine inspection of the filling line',
      manufacturer: 'Fresenius Kabi USA, LLC',
      publishedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'b',
      title: 'B Braun Medical recalls injection vials over particulate matter',
      text: 'particulate matter found during routine inspection of the filling line',
      manufacturer: 'B BRAUN MEDICAL INC',
      publishedAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'c',
      title: 'Fresenius Kabi recalls injection vials following particulate matter',
      text: 'particulate matter found during routine inspection of the filling line',
      manufacturer: null,
      publishedAt: '2026-09-03T00:00:00.000Z',
    },
  ];

  it('splits two firms whose recall texts are nearly identical', () => {
    const clusters = clusterSignals(signals);
    const withA = clusters.find((cluster) => cluster.members.some((one) => one.id === 'a'));

    expect(withA?.members.map((one) => one.id)).not.toContain('b');
  });

  it('does not treat an unknown manufacturer as a different one', () => {
    // "Unknown" is not "different". An unattributed headline is the ordinary
    // GDELT case, and treating it as incompatible with everything would make
    // corroboration impossible. Whether it *joins* then depends on the text,
    // which under-merges by design — so this asserts the constraint, not the
    // merge.
    expect(namesDifferentEntities('Fresenius Kabi USA, LLC', null)).toBe(false);
    expect(namesDifferentEntities(null, null)).toBe(false);
  });

  it('is deterministic, so cluster ids do not depend on query order', () => {
    const forwards = clusterSignals(signals).map((cluster) => cluster.id);
    const backwards = clusterSignals([...signals].reverse()).map((cluster) => cluster.id);

    expect(forwards).toEqual(backwards);
  });

  it('normalises corporate suffixes away', () => {
    expect(normaliseEntity('Hikma Pharmaceuticals USA INC.')).toBe('hikma pharmaceuticals usa');
    expect(namesDifferentEntities('Hikma Pharmaceuticals USA INC.', 'Hikma Pharmaceuticals')).toBe(
      false,
    );
    expect(namesDifferentEntities('Aurobindo Pharma', 'Hikma Pharmaceuticals')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Independence
// ---------------------------------------------------------------------------

describe('independence counts publishers, not feeds', () => {
  it('collapses two openFDA endpoints into one source', () => {
    // The case this file exists for. Enforcement and shortages are different
    // URLs, different schemas, and the same organisation publishing on the same
    // authority. Counting them as two would satisfy the two-source rule with
    // one source saying something twice.
    const count = countIndependentSources([
      { source: 'openfda_enforcement', domain: null },
      { source: 'openfda_shortages', domain: null },
    ]);

    expect(count.count).toBe(1);
    expect(count.keys).toEqual(['fda.gov']);
  });

  it('says so in the explanation, so a reader can tell why the count is one', () => {
    // Without this sentence, "1 independent source" is ambiguous between "one
    // feed answered" and "two answered and were correctly counted as one".
    const count = countIndependentSources([
      { source: 'openfda_enforcement', domain: null },
      { source: 'openfda_shortages', domain: null },
    ]);

    expect(count.explanation).toContain('collapsed to 1');
    expect(count.explanation).toContain('one agency are one source saying something twice');
  });

  it('counts a regulator and a newspaper as two', () => {
    const count = countIndependentSources([
      { source: 'openfda_enforcement', domain: null },
      { source: 'gdelt_doc', domain: 'thehindubusinessline.com' },
    ]);

    expect(count.count).toBe(MIN_INDEPENDENT_SOURCES);
    expect(count.explanation).toContain('thehindubusinessline.com');
  });

  it('excludes an unkeyable observation rather than counting it', () => {
    // A unique placeholder per unkeyed row would make each one independent; a
    // shared one would make them mutually dependent. Neither is true.
    const count = countIndependentSources([
      { source: 'gdelt_doc', domain: '192.168.1.1' },
      { source: 'gdelt_doc', domain: 'not-a-domain' },
    ]);

    expect(count.count).toBe(0);
    expect(count.unkeyed).toBe(2);
    expect(count.explanation).toContain('no identifiable publisher');
  });

  it('resolves a two-part public suffix', () => {
    expect(registrableDomain('www.thehindubusinessline.com')).toBe('thehindubusinessline.com');
    expect(registrableDomain('pib.gov.in')).toBe('pib.gov.in');
    expect(registrableDomain('timesofindia.indiatimes.com')).toBe('indiatimes.com');
    expect(registrableDomain('localhost')).toBeNull();
  });

  it('keys an agency by the agency and a news site by its domain', () => {
    expect(independenceKey('openfda_label', null)).toBe('fda.gov');
    expect(independenceKey('gdelt_doc', 'www.reuters.com')).toBe('reuters.com');
    expect(independenceKey('gdelt_doc', null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Veracity
// ---------------------------------------------------------------------------

describe('veracity is a product, not a weighted sum', () => {
  it('scores a single source at zero however authoritative and recent', () => {
    // The whole reason for the product. Under a weighted sum this would score
    // around 0.6 and clear a 0.5 threshold, while failing the one rule VERIFY
    // exists to enforce.
    const result = computeVeracity({
      independentSourceCount: 1,
      credibilityClasses: ['REGULATOR'],
      newestPublishedAt: NOW.toISOString(),
      independenceKeys: ['fda.gov'],
      now: NOW,
    });

    expect(result.quantity.value).toBe(0);
    expect(result.blockedBy).toBe('insufficient_independent_sources');
  });

  it('publishes a fresh, corroborated, authoritative alert', () => {
    const result = computeVeracity({
      independentSourceCount: 2,
      credibilityClasses: ['REGULATOR', 'PRESS'],
      newestPublishedAt: NOW.toISOString(),
      independenceKeys: ['fda.gov', 'reuters.com'],
      now: NOW,
    });

    expect(result.blockedBy).toBeNull();
    expect(result.quantity.value).toBeCloseTo(0.5, 5);
  });

  it('is DERIVED with the substituted formula on it, never MODELLED', () => {
    // DERIVED because it is arithmetic over counts and timestamps. MODELLED
    // would oblige a band, and a band on this would be invented.
    const result = computeVeracity({
      independentSourceCount: 2,
      credibilityClasses: ['REGULATOR'],
      newestPublishedAt: NOW.toISOString(),
      independenceKeys: ['fda.gov', 'reuters.com'],
      now: NOW,
    });

    expect(result.quantity.tag).toBe('DERIVED');
    expect(result.quantity.provenance.calculation_method).toContain('independence * credibility');
    expect(result.quantity.provenance.calculation_method).toContain('fda.gov, reuters.com');
    expect(result.quantity.band).toBeUndefined();
  });

  it('halves at the half-life rather than falling off a cliff', () => {
    const aged = new Date(NOW.getTime() + VERACITY_RECENCY_HALF_LIFE_DAYS * MS_PER_DAY);

    expect(recencyTerm(NOW.toISOString(), NOW)).toBeCloseTo(1, 5);
    expect(recencyTerm(NOW.toISOString(), aged)).toBeCloseTo(0.5, 5);
  });

  it('treats a future timestamp as now, not as fresher than now', () => {
    const future = new Date(NOW.getTime() + MS_PER_DAY).toISOString();
    expect(recencyTerm(future, NOW)).toBeCloseTo(1, 5);
  });

  it('takes the strongest publisher, not the average', () => {
    // A recall is no less true because bloggers also mentioned it. Averaging
    // would let low-credibility repeats dilute a regulator's own statement.
    expect(credibilityTerm(['REGULATOR', 'UNKNOWN_PUBLISHER', 'UNKNOWN_PUBLISHER'])).toBe(1);
    expect(credibilityTerm([])).toBe(0);
  });

  it('grows with diminishing returns above the minimum', () => {
    expect(independenceTerm(1)).toBe(0);
    expect(independenceTerm(2)).toBeCloseTo(0.5, 5);
    expect(independenceTerm(3)).toBeCloseTo(2 / 3, 5);
    expect(independenceTerm(10)).toBeLessThan(1);
  });

  it('classifies a regulator apart from a newspaper', () => {
    expect(credibilityClass('fda.gov', true)).toBe('REGULATOR');
    expect(credibilityClass('who.int', true)).toBe('OFFICIAL_STATISTICS');
    expect(credibilityClass('reuters.com', true)).toBe('PRESS');
    expect(credibilityClass('unknown.example', false)).toBe('UNKNOWN_PUBLISHER');
  });
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

describe('resolution refuses to guess', () => {
  const nodes: NodeCandidate[] = [
    {
      nodeId: 'manufacturer:hikma-pharmaceuticals',
      label: 'Hikma Pharmaceuticals',
      type: 'manufacturer',
    },
    { nodeId: 'manufacturer:aurobindo-pharma', label: 'Aurobindo Pharma', type: 'manufacturer' },
    { nodeId: 'drug:heparin-sodium', label: 'heparin sodium', type: 'drug' },
  ];

  it('leaves an ambiguous name unresolved rather than picking one', () => {
    // The case this file exists for. A cascade run from the wrong firm produces
    // a confident, wholly fictional list of exposed drugs — worse than no
    // cascade, because it looks right.
    const ambiguous: NodeCandidate[] = [
      ...nodes,
      { nodeId: 'manufacturer:hikma-usa', label: 'Hikma Pharmaceuticals', type: 'manufacturer' },
    ];

    const resolution = resolveToNode(
      { manufacturer: 'Hikma Pharmaceuticals', drugOrIngredient: null },
      ambiguous,
    );

    expect(resolution.nodeId).toBeNull();
    expect(resolution.basis).toContain('Ambiguous');
    expect(resolution.basis).toContain('precise about the wrong thing');
  });

  it('resolves a longer form of the same firm name', () => {
    const resolution = resolveToNode(
      { manufacturer: 'Hikma Pharmaceuticals USA INC.', drugOrIngredient: null },
      nodes,
    );

    expect(resolution.nodeId).toBe('manufacturer:hikma-pharmaceuticals');
    expect(resolution.basis).toContain('contained match');
  });

  it('does not pair a firm with a different firm that merely looks similar', () => {
    // Fuzzy matching pairs "Aurobindo Pharma" with "Auromedics Pharma", which
    // are two firms, one a subsidiary of the other. Worse than no match.
    const resolution = resolveToNode(
      { manufacturer: 'Auromedics Pharma', drugOrIngredient: null },
      nodes,
    );

    expect(resolution.nodeId).toBeNull();
    expect(resolution.basis).toContain('fuzzy matching was rejected');
  });

  it('falls back to the drug when no firm was named', () => {
    const resolution = resolveToNode(
      { manufacturer: null, drugOrIngredient: 'heparin sodium' },
      nodes,
    );

    expect(resolution.nodeId).toBe('drug:heparin-sodium');
  });

  it('says a headline named nothing, rather than failing silently', () => {
    const resolution = resolveToNode({ manufacturer: null, drugOrIngredient: null }, nodes);

    expect(resolution.nodeId).toBeNull();
    expect(resolution.basis).toContain('named neither a manufacturer nor a drug');
  });
});
