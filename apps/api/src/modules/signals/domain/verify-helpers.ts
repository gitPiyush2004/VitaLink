/**
 * The pure parts of VERIFY: who counts, which order, and which signal leads.
 *
 * Extracted from `signals.service.ts` so the service is orchestration and these
 * are testable without a database. Every one of them is a decision with a
 * reason, which is why they are functions with comments rather than inline
 * expressions.
 */

import type { SignalSource } from '@vitalink/contracts';

import type { AlertRecord, SignalRecord } from '../signals.repository';

/**
 * Every publisher that said something about this cluster, in one list.
 *
 * A cluster's own signals and its corroborating hits are counted on the same
 * footing, which is the point: an FDA recall plus an FDA shortage listing is one
 * publisher, and `countIndependentSources` is what collapses them.
 */
export function toObservations(
  members: SignalRecord[],
  corroborations: AlertRecord['corroborations'],
): { source: SignalSource; domain: string | null }[] {
  return [
    ...members.map((signal) => ({ source: signal.source as SignalSource, domain: signal.domain })),
    ...corroborations.map((one) => ({
      source: one.source as SignalSource,
      domain: one.independence_key,
    })),
  ];
}

/** Decimal places veracity is reported to. */
export const VERACITY_DECIMALS = 3;

/**
 * Highest severity first, then most recent.
 *
 * The corroboration budget is finite, so the order it is spent in is a real
 * decision: a Class I recall of a sole-source injectable should get its query
 * before a two-week-old Class III.
 */
export function prioritise<T extends { members: { signal: SignalRecord }[] }>(clusters: T[]): T[] {
  return [...clusters].sort((left, right) => {
    const bySeverity = severityOf(right) - severityOf(left);
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(newestOf(right)) - Date.parse(newestOf(left));
  });
}

export function severityOf(cluster: { members: { signal: SignalRecord }[] }): number {
  return Math.max(...cluster.members.map((member) => member.signal.severity));
}

export function newestOf(cluster: { members: { signal: SignalRecord }[] }): string {
  return cluster.members
    .map((member) => member.signal.publishedAt)
    .reduce((latest, current) => (Date.parse(current) > Date.parse(latest) ? current : latest));
}

/**
 * The cluster's representative signal.
 *
 * A structured-field extraction beats a keyword one, then higher severity, then
 * the earliest publication. So an FDA recall leads a cluster it shares with
 * three headlines, and the alert's category and entity come from the source that
 * actually stated them rather than from whichever row sorted first.
 */
export function pickLead(members: SignalRecord[]): SignalRecord {
  const ranked = [...members].sort((left, right) => {
    const byMethod = methodRank(right.extractionMethod) - methodRank(left.extractionMethod);
    if (byMethod !== 0) return byMethod;

    const bySeverity = right.severity - left.severity;
    if (bySeverity !== 0) return bySeverity;

    return Date.parse(left.publishedAt) - Date.parse(right.publishedAt);
  });

  const lead = ranked[0];
  if (lead === undefined) throw new Error('a cluster cannot be empty');
  return lead;
}

/**
 * How much a lead's extraction is worth, highest first.
 *
 * A field the FDA published beats a sentence a model wrote, which beats a phrase
 * matched in a headline. So an FDA recall leads a cluster it shares with three
 * news items, and the alert's category and entity come from the source that
 * actually stated them.
 */
const METHOD_RANK = { STRUCTURED_FIELD: 3, LLM: 2, KEYWORD: 1 } as const;

function methodRank(method: SignalRecord['extractionMethod']): number {
  return METHOD_RANK[method];
}

/**
 * The corroboration query for one cluster.
 *
 * The first version joined the firm and the drug — `"Fresenius Kabi USA, LLC"
 * "TOCILIZUMAB-AAZG"` — which is an implicit AND and found nothing, because
 * almost no article names both a corporate entity in full and an INN in caps.
 * It looked like a targeted query and behaved like a guaranteed miss.
 *
 * What it asks now is "did anyone else report an event of this kind at this
 * entity": the entity, AND any one of the words that would appear in coverage of
 * a supply disruption. That is narrow enough that an article about the firm's
 * quarterly earnings does not corroborate a recall, and broad enough to actually
 * match.
 *
 * @returns null when the cluster names no entity at all, which is the ordinary
 *   case for a GDELT headline and is why those are corroboration material rather
 *   than alert candidates in their own right.
 */
export function corroborationQuery(lead: SignalRecord): string | null {
  // The firm first: it is the entity a second outlet would name. The drug is
  // the fallback for a shortage record, which names a drug and sometimes no firm.
  const entity = lead.manufacturer ?? lead.drugOrIngredient;
  if (entity === null || entity.trim().length === 0) return null;

  // Trimmed to the distinctive part. GDELT matches phrases literally, so
  // "Fresenius Kabi USA, LLC" fails where "Fresenius Kabi" succeeds — the
  // corporate suffix is exactly the part a headline drops.
  const shortened = entity
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|pvt|private)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (shortened.length === 0) return null;

  const EVENT_WORDS = ['recall', 'shortage', 'contamination', 'halt', 'suspend', 'shut'];
  return `"${shortened}" (${EVENT_WORDS.join(' OR ')}) sourcelang:english`;
}
