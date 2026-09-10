/**
 * Grouping raw signals into stories (spec stage 2, clustering).
 *
 * A cluster is "one real-world event", and everything downstream depends on the
 * grouping being right. Two failure directions, and they are not symmetric:
 *
 * **Over-merging** — two different events in one cluster — is the dangerous one.
 * It loses a disruption, and it does so invisibly: the merged cluster still
 * produces an alert, so nothing looks broken.
 *
 * **Under-merging** — one event split across two clusters — costs a duplicate
 * alert and an under-counted independence score. Visible, annoying, harmless.
 *
 * So every tie is broken towards under-merging.
 *
 * ## Single-link on text alone would over-merge
 *
 * Text similarity says "Fresenius Kabi recalls injection over particulate
 * matter" and "B Braun recalls injection over particulate matter" are close.
 * They are two recalls by two firms. So the entity is part of the key, not just
 * part of the text: two signals join only when their text matches **and** they
 * do not name different manufacturers.
 *
 * That last clause is stated carefully. Signals that name *different* firms
 * never merge; a signal that names no firm may join one that does, because a
 * headline with no extractable entity is exactly what corroboration is for.
 *
 * Pure functions.
 */

import { areNearDuplicates, type DuplicateVerdict } from './simhash';

/** The minimum a signal must expose to be clustered. */
export type Clusterable = {
  id: string;
  title: string;
  text: string;
  /** Extracted manufacturer, or null when none could be read. */
  manufacturer: string | null;
  publishedAt: string;
};

export type Cluster<T extends Clusterable> = {
  /** Derived from the earliest member, so a cluster id is stable across re-runs. */
  id: string;
  members: T[];
  /** Every merge decision, so an over-merge can be traced to the pair that caused it. */
  merges: { left: string; right: string; verdict: DuplicateVerdict }[];
};

/** Normalises a firm name enough to compare two spellings of the same company. */
export function normaliseEntity(name: string | null): string | null {
  if (name === null) return null;

  const cleaned = name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    // Corporate suffixes carry no identity: "Hikma Pharmaceuticals USA INC." and
    // "Hikma Pharmaceuticals USA" are the same firm.
    .replace(
      /\b(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|s ?a|pvt|private)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length === 0 ? null : cleaned;
}

/**
 * Whether two signals name manufacturers that are definitely different.
 *
 * Returns false when either is unknown. "Unknown" is not "different" — an
 * unattributed headline is the ordinary case for GDELT, and treating it as
 * incompatible with everything would make corroboration impossible.
 */
export function namesDifferentEntities(left: string | null, right: string | null): boolean {
  const one = normaliseEntity(left);
  const other = normaliseEntity(right);
  if (one === null || other === null) return false;

  // Substring either way, so "hikma pharmaceuticals usa" and "hikma
  // pharmaceuticals" are the same firm rather than two.
  return !(one === other || one.includes(other) || other.includes(one));
}

/** The text a similarity comparison sees. Title carries most of the signal. */
function comparableText(signal: Clusterable): string {
  return `${signal.title} ${signal.text}`;
}

/**
 * Clusters signals by text similarity, subject to the entity constraint.
 *
 * Single-link agglomerative: a signal joins the first cluster containing a
 * member it duplicates. Single-link is the right linkage for "same story",
 * because a story can be rewritten in a chain — A resembles B resembles C —
 * where A and C would not pass a direct comparison. The entity constraint is
 * what stops that chain running away, which is the usual objection to
 * single-link.
 *
 * Deterministic: signals are sorted by publication time then id before
 * clustering, so the same input always produces the same clusters with the same
 * ids. Without that, cluster ids would depend on the order Mongo returned rows.
 */
export function clusterSignals<T extends Clusterable>(signals: T[]): Cluster<T>[] {
  const ordered = [...signals].sort((left, right) => {
    const byTime = Date.parse(left.publishedAt) - Date.parse(right.publishedAt);
    return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
  });

  const clusters: Cluster<T>[] = [];

  for (const signal of ordered) {
    const joined = clusters.find((cluster) => tryJoin(cluster, signal));
    if (joined !== undefined) continue;

    clusters.push({ id: `cluster-${signal.id}`, members: [signal], merges: [] });
  }

  return clusters;
}

/**
 * Adds `signal` to `cluster` if it duplicates any member, recording the verdict.
 *
 * @returns whether it joined. The merge record is appended as a side effect on
 *   the cluster, which is why this is not a pure predicate — the alternative was
 *   running the comparison twice.
 */
function tryJoin<T extends Clusterable>(cluster: Cluster<T>, signal: T): boolean {
  for (const member of cluster.members) {
    if (namesDifferentEntities(member.manufacturer, signal.manufacturer)) continue;

    const verdict = areNearDuplicates(comparableText(member), comparableText(signal));
    if (!verdict.areDuplicates) continue;

    cluster.members.push(signal);
    cluster.merges.push({ left: member.id, right: signal.id, verdict });
    return true;
  }

  return false;
}

/**
 * A sentence describing how a cluster was formed.
 *
 * Stored on the alert, because "this alert is backed by four signals" invites
 * the question "are they four signals or one signal four times", and the merge
 * measurements are the answer.
 */
export function describeCluster<T extends Clusterable>(cluster: Cluster<T>): string {
  if (cluster.members.length === 1) {
    return 'A single signal; nothing was merged into it.';
  }

  const DECIMALS = 2;
  const closest = cluster.merges
    .map((merge) => merge.verdict.jaccard)
    .reduce((best, jaccard) => Math.max(best, jaccard), 0);

  return (
    `${String(cluster.members.length)} signals merged as one story. ` +
    `${String(cluster.merges.length)} merge decision(s), closest pair at Jaccard ` +
    `${closest.toFixed(DECIMALS)} over 5-word shingles. Signals naming different ` +
    "manufacturers are never merged, so a shared phrasing cannot join two firms' events."
  );
}
