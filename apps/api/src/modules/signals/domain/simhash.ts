/**
 * Near-duplicate detection for raw signals (spec stage 2, dedupe).
 *
 * The problem this solves is specific. When a plant closes, twenty outlets carry
 * it, most of them rewriting the same wire copy. Exact-match dedupe catches none
 * of them, and an alert whose "independent source count" is really twenty copies
 * of one Reuters story would clear the two-source rule while proving nothing.
 *
 * ## What the measurements said, and what changed because of them
 *
 * The first version used 5-word shingles and a SimHash prefilter at a Hamming
 * distance of 3, which is the standard operating point — for documents with
 * hundreds of features. These documents are headlines. Measured on a real pair
 * from openFDA's enforcement feed, an 11-word recall title:
 *
 * ```
 *  shingle size   one-word rewrite   a DIFFERENT firm, same format   unrelated
 *      n=2             0.667                    0.615                  0.000
 *      n=3             0.500                    0.583                  0.000
 *      n=5             0.167                    0.500                  0.000
 * ```
 *
 * Two things follow, and both changed the design.
 *
 * **Five-word shingles are useless here.** A one-word rewrite of an 11-word
 * headline scores 0.167 — indistinguishable from unrelated text. There are only
 * seven shingles, and one changed word destroys five of them. So the shingle
 * size adapts to document length: see `shingleSizeFor`.
 *
 * **Text similarity cannot do this job alone, at any threshold.** At every
 * shingle size, a different firm's identically-worded recall scores as similar
 * as a genuine rewrite of the same story — 0.615 against 0.667 at n=2. There is
 * no threshold between them that is not an accident of this example. The entity
 * constraint in `cluster.ts` is therefore not a refinement on top of text
 * similarity; it is the part that actually works, and text similarity is the
 * secondary check.
 *
 * Which is why the threshold stays where the spec set it, at 0.7, even though
 * that means a genuine one-word rewrite does *not* merge. That is deliberate
 * under-merging: it costs a duplicate alert and an under-counted independence
 * score, where over-merging loses a disruption entirely and does so invisibly.
 *
 * ## SimHash is still here, and still runs second
 *
 * It remains a cheap prefilter for the long-document case, and it is skipped
 * below `SIMHASH_MIN_SHINGLES` because at seven features its distance is noise.
 *
 * ## No cryptographic hash
 *
 * FNV-1a, not SHA-256. The hash needs to distribute shingles evenly across 64
 * bits and nothing else — there is no adversary and no secret. A cryptographic
 * hash would be slower and would imply a security property that is not being
 * relied on.
 *
 * Pure functions. No clock, no I/O, and no random number generator anywhere.
 */

import { DEDUPE_SHINGLE_SIZE, DEDUPE_SIMILARITY_THRESHOLD } from '@config/constants';

/** 64-bit FNV-1a offset basis and prime, as published. */
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

const HASH_BITS = 64;
/** Four bits per hex character, so a 64-bit fingerprint is 16 hex chars. */
const BITS_PER_HEX_CHAR = 4;
const HEX_CHARS = HASH_BITS / BITS_PER_HEX_CHAR;
const HEX_RADIX = 16;

/** Named so the bit arithmetic below reads as intent rather than as literals. */
const ZERO = 0n;
const ONE = 1n;

/**
 * Hamming distance below which two fingerprints are candidate duplicates.
 *
 * Three of sixty-four bits. Chosen as the standard operating point for SimHash
 * near-duplicate detection: tight enough that unrelated documents almost never
 * collide, loose enough to survive the word-level edits a rewritten wire story
 * involves. It is a *candidate* threshold — `areNearDuplicates` confirms with
 * Jaccard — so erring loose here costs a set comparison and not a wrong merge.
 */
export const SIMHASH_HAMMING_THRESHOLD = 3;

/**
 * Below this many shingles, the SimHash prefilter is skipped entirely.
 *
 * With seven features one changed word moves a large share of the bit votes, so
 * the Hamming distance carries no information about similarity — it was
 * rejecting genuine rewrites before Jaccard ever saw them. Above it, the
 * prefilter behaves as published and saves the set comparison.
 */
export const SIMHASH_MIN_SHINGLES = 20;

/**
 * Word count below which a document is treated as headline-length.
 *
 * Twenty words: an FDA `reason_for_recall` and a news title both sit under it, a
 * label section or an article body sits over it.
 */
const SHORT_DOCUMENT_WORDS = 20;

/** Shingle size for short text, where 5-grams leave too few features to compare. */
const SHORT_SHINGLE_SIZE = 2;

/**
 * The shingle size for a document of this length.
 *
 * Not a tuning knob. See the measurement table at the top of the file: 5-word
 * shingles score a one-word rewrite of an 11-word headline at 0.167, which is
 * indistinguishable from unrelated text.
 */
export function shingleSizeFor(wordCount: number): number {
  return wordCount < SHORT_DOCUMENT_WORDS ? SHORT_SHINGLE_SIZE : DEDUPE_SHINGLE_SIZE;
}

function fnv1a64(text: string): bigint {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.codePointAt(index)!);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/**
 * Normalises text before shingling.
 *
 * Lowercase, strip punctuation, collapse whitespace. Deliberately does *not*
 * stem or remove stopwords: two stories about different drugs would look more
 * alike after stemming, and the cost of a wrong merge is a lost disruption.
 */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word shingles of `size` consecutive words.
 *
 * Word-level rather than character-level, because character shingles of a news
 * headline are dominated by common letter sequences and two unrelated pharma
 * headlines share most of them.
 *
 * A document shorter than one shingle yields a single shingle of the whole text,
 * rather than an empty set — an empty set would make every short document
 * identical to every other, which is the opposite of what dedupe is for.
 */
export function shingles(text: string, size?: number): string[] {
  const words = normaliseText(text).split(' ').filter(Boolean);
  if (words.length === 0) return [];

  const width = size ?? shingleSizeFor(words.length);
  if (words.length <= width) return [words.join(' ')];

  const result: string[] = [];
  for (let index = 0; index + width <= words.length; index += 1) {
    result.push(words.slice(index, index + width).join(' '));
  }
  return result;
}

/**
 * The 64-bit SimHash fingerprint, as a hex string.
 *
 * Hex rather than a bigint because it is persisted and indexed: a string is what
 * Mongo can store and compare without a custom codec, and the Hamming distance
 * is computed after parsing it back.
 */
export function simhash(text: string): string {
  const parts = shingles(text);
  if (parts.length === 0) return '0'.repeat(HEX_CHARS);

  // One accumulator per bit. A shingle votes +1 for each bit it sets and -1 for
  // each it clears; the sign of the total becomes that bit of the fingerprint.
  const votes = new Array<number>(HASH_BITS).fill(0);

  for (const shingle of parts) {
    const hash = fnv1a64(shingle);
    for (let bit = 0; bit < HASH_BITS; bit += 1) {
      const isSet = (hash >> BigInt(bit)) & ONE;
      votes[bit] = (votes[bit] ?? 0) + (isSet === ONE ? 1 : -1);
    }
  }

  let fingerprint = ZERO;
  for (let bit = 0; bit < HASH_BITS; bit += 1) {
    if ((votes[bit] ?? 0) > 0) fingerprint |= ONE << BigInt(bit);
  }

  return fingerprint.toString(HEX_RADIX).padStart(HEX_CHARS, '0');
}

/** Bits that differ between two fingerprints. */
export function hammingDistance(left: string, right: string): number {
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let bits = 0;
  while (difference > ZERO) {
    if ((difference & ONE) === ONE) bits += 1;
    difference >>= ONE;
  }
  return bits;
}

/**
 * |A ∩ B| / |A ∪ B| over the two shingle sets.
 *
 * @param size overrides the length-adaptive shingle width. Only a test passes
 *   it, so the measurement table at the top of this file stays reproducible
 *   rather than being a claim about a version of the code that no longer runs.
 */
export function jaccardSimilarity(left: string, right: string, size?: number): number {
  const leftSet = new Set(shingles(left, size));
  const rightSet = new Set(shingles(right, size));
  if (leftSet.size === 0 && rightSet.size === 0) return 1;
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  for (const shingle of leftSet) {
    if (rightSet.has(shingle)) intersection += 1;
  }

  return intersection / (leftSet.size + rightSet.size - intersection);
}

export type DuplicateVerdict = {
  areDuplicates: boolean;
  hammingDistance: number;
  jaccard: number;
  /** Which test decided it, so a wrong merge can be diagnosed from the record. */
  decidedBy: 'hamming_far' | 'jaccard_confirmed' | 'jaccard_rejected';
};

/**
 * Whether two texts are the same story: SimHash first, Jaccard to confirm.
 *
 * @returns the verdict *and* both measurements, because when two stories are
 *   wrongly merged the useful question is "how close were they", and that is
 *   unanswerable from a boolean.
 */
export function areNearDuplicates(left: string, right: string): DuplicateVerdict {
  const distance = hammingDistance(simhash(left), simhash(right));
  const features = Math.min(shingles(left).length, shingles(right).length);

  // The prefilter only earns its place on documents with enough features for
  // its distance to mean anything. Below the floor it was rejecting genuine
  // rewrites before Jaccard saw them — see the measurement table above.
  if (features >= SIMHASH_MIN_SHINGLES && distance > SIMHASH_HAMMING_THRESHOLD) {
    return {
      areDuplicates: false,
      hammingDistance: distance,
      jaccard: 0,
      decidedBy: 'hamming_far',
    };
  }

  const jaccard = jaccardSimilarity(left, right);
  const areDuplicates = jaccard >= DEDUPE_SIMILARITY_THRESHOLD;

  return {
    areDuplicates,
    hammingDistance: distance,
    jaccard,
    decidedBy: areDuplicates ? 'jaccard_confirmed' : 'jaccard_rejected',
  };
}
