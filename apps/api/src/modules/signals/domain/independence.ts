/**
 * What counts as an independent source (spec stage 2).
 *
 * The rule is that an alert needs two *genuinely independent* sources, and the
 * word doing the work is "genuinely". This file is the whole definition of that
 * word, and it is the part of VERIFY most easily faked into meaninglessness.
 *
 * ## Three ways a source count lies
 *
 * **Twenty copies of one wire story.** Handled upstream by `simhash.ts`: they
 * collapse into one cluster before they get here.
 *
 * **Two endpoints of the same agency.** openFDA's enforcement feed and its
 * shortages feed are different URLs, different schemas, different endpoints —
 * and the same organisation, publishing on the same authority. A recall report
 * corroborated by an FDA shortage listing is *one* source saying something
 * twice. This is the case the code has to get right, because it looks like two.
 *
 * **Two outlets, one owner.** thehindu.com and thehindubusinessline.com are the
 * same publisher. Domain-level counting treats them as two. That one is *not*
 * solved here, and the limitation is stated rather than papered over — see the
 * note on `AFFILIATED_DOMAINS`.
 *
 * ## The independence key
 *
 * Every source collapses to one string. Two signals are independent when their
 * keys differ. For an agency feed the key is the agency; for a news article it
 * is the registrable domain. That is why `openfda_enforcement` and
 * `openfda_shortages` both key to `fda.gov`.
 *
 * Pure functions. No I/O and no network calls — public-suffix resolution is done
 * from a small embedded list rather than by fetching the PSL, and the reason is
 * in `registrableDomain`.
 */

import type { SignalSource } from '@vitalink/contracts';

/**
 * Sources that are the same publisher regardless of endpoint.
 *
 * Keyed by source, valued by the organisation. Anything absent falls back to the
 * article's own domain.
 */
const AGENCY_KEYS: Partial<Record<SignalSource, string>> = {
  openfda_enforcement: 'fda.gov',
  openfda_shortages: 'fda.gov',
  openfda_ndc: 'fda.gov',
  openfda_label: 'fda.gov',
  dailymed_spl: 'nlm.nih.gov',
  cdsco_alerts: 'cdsco.gov.in',
  nppa_dpco: 'nppa.gov.in',
  un_comtrade: 'un.org',
  who_eml: 'who.int',
  usgs_fdsnws: 'usgs.gov',
  open_meteo: 'open-meteo.com',
  osm_overpass: 'openstreetmap.org',
  data_gov_in: 'data.gov.in',
};

/**
 * Two-part public suffixes that appear in this domain.
 *
 * A three-line list rather than the full Public Suffix List, and the trade-off
 * is worth being explicit about. The PSL is ~10,000 entries, changes, and would
 * either be vendored (stale) or fetched (a network call inside a pure function).
 * Getting a suffix wrong costs one over-count of independence for one outlet;
 * the entries here cover the Indian and UK news domains this system reads.
 *
 * When a fourth case appears, add it here. If the list reaches twenty, take the
 * PSL dependency.
 */
const TWO_PART_SUFFIXES = new Set([
  'co.in',
  'co.uk',
  'com.au',
  'co.jp',
  'gov.in',
  'nic.in',
  'org.in',
  'net.in',
  'ac.in',
  'ac.uk',
  'gov.uk',
  'org.uk',
]);

const MIN_LABELS = 2;
/** A two-part public suffix needs one more label above it to be registrable. */
const THREE_LABELS = 3;

/**
 * The registrable domain: one label above the public suffix.
 *
 * `www.thehindubusinessline.com` -> `thehindubusinessline.com`
 * `pib.gov.in` -> `pib.gov.in`  (because `gov.in` is the suffix)
 *
 * @returns null when the input is not a parseable host, which is a real case:
 *   GDELT occasionally returns a domain field that is an IP or a fragment, and
 *   an unparseable domain must not silently become an independence key of its
 *   own — that would make every malformed row an "independent source".
 */
export function registrableDomain(host: string): string | null {
  const cleaned = host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

  if (cleaned.length === 0 || /^[\d.]+$/.test(cleaned)) return null;

  const labels = cleaned.split('.').filter(Boolean);
  if (labels.length < MIN_LABELS) return null;

  const lastTwo = labels.slice(-MIN_LABELS).join('.');
  const take = TWO_PART_SUFFIXES.has(lastTwo) ? THREE_LABELS : MIN_LABELS;

  return labels.length < take ? null : labels.slice(-take).join('.');
}

/**
 * The independence key for one observation.
 *
 * An agency source keys to the agency, so two of its endpoints do not count
 * twice. A news source keys to its registrable domain.
 *
 * @returns null when neither is available. A source with no independence key is
 *   not counted at all, which is stricter than assigning it a placeholder — a
 *   placeholder shared by every unkeyed row would make them mutually dependent,
 *   and a unique placeholder per row would make each one independent. Neither is
 *   true, so it is excluded and the exclusion is visible in the count.
 */
export function independenceKey(source: SignalSource, domain: string | null): string | null {
  const agency = AGENCY_KEYS[source];
  if (agency !== undefined) return agency;
  if (domain === null) return null;

  return registrableDomain(domain);
}

export type IndependenceCount = {
  /** Distinct keys. This is the number the two-source rule is applied to. */
  count: number;
  keys: string[];
  /** Observations that produced no key and were therefore not counted. */
  unkeyed: number;
  /** Sentence for the alert's provenance, naming who corroborated whom. */
  explanation: string;
};

/**
 * Counts distinct independent sources across a set of observations.
 *
 * The explanation is part of the return value rather than something a caller
 * composes, so an alert cannot record a count without recording which sources
 * produced it. "Verified by two sources" is not a claim anyone can check;
 * "verified by fda.gov and thehindubusinessline.com" is.
 */
export function countIndependentSources(
  observations: { source: SignalSource; domain: string | null }[],
): IndependenceCount {
  const keys = new Set<string>();
  let unkeyed = 0;

  for (const observation of observations) {
    const key = independenceKey(observation.source, observation.domain);
    if (key === null) {
      unkeyed += 1;
      continue;
    }
    keys.add(key);
  }

  const sorted = [...keys].sort();
  const sameAgencyNote = describeCollapse(observations, sorted.length);

  return {
    count: sorted.length,
    keys: sorted,
    unkeyed,
    explanation:
      (sorted.length === 0
        ? 'No observation carried an identifiable publisher, so no independent source was counted.'
        : `${String(sorted.length)} independent source(s): ${sorted.join(', ')}.`) +
      (unkeyed === 0
        ? ''
        : ` ${String(unkeyed)} observation(s) had no identifiable publisher and were not counted.`) +
      sameAgencyNote,
  };
}

/**
 * States when observations collapsed, and why.
 *
 * This sentence is the whole point of the file. Without it, an alert built from
 * an FDA recall and an FDA shortage listing shows "1 independent source" and a
 * reader has no way to tell whether that is because one feed answered or because
 * two answered and were correctly counted as one.
 */
function describeCollapse(
  observations: { source: SignalSource; domain: string | null }[],
  distinctKeys: number,
): string {
  if (observations.length <= distinctKeys) return '';

  const collapsed = observations.length - distinctKeys;
  return (
    ` ${String(observations.length)} observations collapsed to ${String(distinctKeys)} ` +
    `source(s): ${String(collapsed)} came from a publisher already counted. Two endpoints of ` +
    'one agency are one source saying something twice, not two sources agreeing.'
  );
}

/**
 * Whether two publishers are known to share an owner.
 *
 * **Not implemented, and that is a stated limitation rather than an oversight.**
 * thehindu.com and thehindubusinessline.com are the same publisher, and this
 * function returning false means an alert corroborated only by those two counts
 * two independent sources when it has one and a half.
 *
 * Fixing it properly needs a media-ownership dataset, which is not open data in
 * any form this project can cite. The honest alternatives were: hard-code a
 * partial list, which would be arbitrary and would look authoritative; or state
 * the gap. The gap is stated, it is in the module README, and every alert's
 * provenance names the domains so a reader can spot the case themselves.
 */
export function shareOwnership(_left: string, _right: string): boolean {
  return false;
}
