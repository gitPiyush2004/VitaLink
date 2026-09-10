/**
 * Source payload -> `RawSignal` (spec stage 1, SENSE).
 *
 * One function per source. Each one does three things and no more: derive a
 * stable id, convert the source's own date format, and attach the extraction
 * that `extraction.ts` produced. No source-specific logic lives anywhere else,
 * for the same reason no carrier-specific logic lives outside its adapter.
 *
 * ## The id is derived, never generated
 *
 * `openfda_enforcement:D-1234-2026`, `gdelt_doc:<sha of url>`. So re-running
 * ingestion over an overlapping window upserts instead of duplicating — which
 * matters more than it sounds, because two copies of one recall report would
 * satisfy the two-independent-sources rule between themselves.
 *
 * ## Dates
 *
 * Three sources, three formats, all converted here at the boundary:
 * openFDA enforcement uses `YYYYMMDD`, openFDA shortages uses `MM/DD/YYYY`, and
 * GDELT uses `YYYYMMDDTHHMMSSZ`. A malformed date returns null and the signal is
 * skipped with a reason, rather than defaulting to now — a signal dated "now"
 * because its real date was unparseable would score full marks on recency.
 */

import { createHash } from 'node:crypto';

import type { EnforcementReport, GdeltArticle, ShortageRecord } from '@vitalink/connectors';
import type { Provenance } from '@vitalink/contracts';

import { HASH_PREFIX_LENGTH } from '@config/constants';

import type { SignalUpsertInput } from '../signals.repository';

import { extractFromEnforcement, extractFromHeadline, extractFromShortage } from './extraction';
import { registrableDomain } from './independence';
import { simhash } from './simhash';

/** Character offsets in a `YYYYMMDD` string. Named so the slices read as dates. */
const COMPACT = { yearEnd: 4, monthEnd: 6, dayEnd: 8 } as const;

/** `YYYYMMDD` -> ISO instant at midnight UTC. */
export function fromCompactDate(compact: string | undefined): string | null {
  if (compact === undefined || !/^\d{8}$/.test(compact)) return null;

  const iso =
    `${compact.slice(0, COMPACT.yearEnd)}-` +
    `${compact.slice(COMPACT.yearEnd, COMPACT.monthEnd)}-` +
    `${compact.slice(COMPACT.monthEnd, COMPACT.dayEnd)}T00:00:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** `MM/DD/YYYY` -> ISO instant at midnight UTC. openFDA's shortages format. */
export function fromSlashDate(slashed: string | undefined): string | null {
  if (slashed === undefined) return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(slashed.trim());
  if (match === null) return null;

  const iso = `${match[3] ?? ''}-${match[1] ?? ''}-${match[2] ?? ''}T00:00:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** `YYYYMMDDTHHMMSSZ` -> ISO instant. GDELT's `seendate` format. */
export function fromGdeltDate(seendate: string | undefined): string | null {
  if (seendate === undefined) return null;

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate.trim());
  if (match === null) return null;

  const iso =
    `${match[1] ?? ''}-${match[2] ?? ''}-${match[3] ?? ''}` +
    `T${match[4] ?? ''}:${match[5] ?? ''}:${match[6] ?? ''}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** A short, stable digest of a URL, for sources with no identifier of their own. */
function urlDigest(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, HASH_PREFIX_LENGTH);
}

/** What every mapper returns: a signal, or the reason there is none. */
export type MapResult =
  { kind: 'signal'; signal: SignalUpsertInput } | { kind: 'skipped'; reason: string };

/**
 * An openFDA enforcement report.
 *
 * `report_date` is the FDA's own publication date, and it is what `published_at`
 * carries — not `recall_initiation_date`, which is when the firm began the
 * recall and can precede publication by weeks. Recency in VERIFY asks "how
 * current is this information", so the publication date is the honest input.
 */
export function mapEnforcement(report: EnforcementReport, provenance: Provenance): MapResult {
  const publishedAt = fromCompactDate(report.report_date);
  if (publishedAt === null) {
    return {
      kind: 'skipped',
      reason:
        `enforcement report ${report.recall_number} has no parseable report_date ` +
        `("${report.report_date ?? 'absent'}"), and a signal dated "now" because its real date ` +
        'was unreadable would score full marks on recency',
    };
  }

  const { extraction, method, severityBasis, basis } = extractFromEnforcement(report);
  const text = [report.product_description, report.reason_for_recall].filter(Boolean).join(' ');

  return {
    kind: 'signal',
    signal: {
      id: `openfda_enforcement:${report.recall_number}`,
      source: 'openfda_enforcement',
      publishedAt,
      title: `${report.recalling_firm ?? 'Unknown firm'}: ${report.reason_for_recall ?? 'recall'}`,
      text,
      url: `https://api.fda.gov/drug/enforcement.json?search=recall_number:"${report.recall_number}"`,
      // The agency, not a news domain. `independenceKey` maps the source itself
      // to fda.gov, so this field is the article-level fallback and is null here.
      domain: null,
      geoHint: [report.city, report.state, report.country].filter(Boolean).join(', ') || null,
      entityHint: report.recalling_firm ?? null,
      contentHash: simhash(`${report.recalling_firm ?? ''} ${text}`),
      category: extraction.category,
      manufacturer: extraction.manufacturer,
      drugOrIngredient: extraction.drug_or_ingredient,
      locationCity: extraction.location_city,
      locationCountry: extraction.location_country,
      severity: extraction.severity_1_5,
      insight: extraction.insight,
      isPharmaSupplyRelevant: extraction.is_pharma_supply_relevant,
      extractionMethod: method,
      severityBasis,
      extractionBasis: basis,
      provenance,
    },
  };
}

/**
 * An openFDA shortage record.
 *
 * `update_date` rather than `initial_posting_date`: a shortage first posted in
 * 2023 and updated last week is *current* information, and dating it 2023 would
 * decay it to nothing on the recency term while the shortage is still live.
 */
export function mapShortage(record: ShortageRecord, provenance: Provenance): MapResult {
  const publishedAt =
    fromSlashDate(record.update_date) ?? fromSlashDate(record.initial_posting_date);
  const name = record.generic_name ?? record.proprietary_name;

  if (publishedAt === null || name === undefined) {
    return {
      kind: 'skipped',
      reason:
        `shortage record for "${name ?? 'unnamed drug'}" is missing a parseable date or a drug ` +
        'name, so it cannot be dated or resolved to a node',
    };
  }

  const { extraction, method, severityBasis, basis } = extractFromShortage(record);
  const text = [record.shortage_reason, record.availability_information].filter(Boolean).join(' ');

  return {
    kind: 'signal',
    signal: {
      id: `openfda_shortages:${urlDigest(`${name}|${record.company_name ?? ''}`)}`,
      source: 'openfda_shortages',
      publishedAt,
      title: `${name} shortage${record.company_name === undefined ? '' : ` (${record.company_name})`}`,
      text,
      url: `https://api.fda.gov/drug/shortages.json?search=generic_name:"${encodeURIComponent(name)}"`,
      domain: null,
      geoHint: null,
      entityHint: record.company_name ?? null,
      contentHash: simhash(`${name} ${record.company_name ?? ''} ${text}`),
      category: extraction.category,
      manufacturer: extraction.manufacturer,
      drugOrIngredient: extraction.drug_or_ingredient,
      locationCity: extraction.location_city,
      locationCountry: extraction.location_country,
      severity: extraction.severity_1_5,
      insight: extraction.insight,
      isPharmaSupplyRelevant: extraction.is_pharma_supply_relevant,
      extractionMethod: method,
      severityBasis,
      extractionBasis: basis,
      provenance,
    },
  };
}

/**
 * A GDELT article.
 *
 * `text` is the title again, because the DOC API returns no body. That is a
 * duplication rather than a bug: the dedupe and clustering both read
 * `title + text`, and leaving the text empty would halve the signal available to
 * them. The `extractionBasis` says the title was the entire input.
 */
export function mapGdeltArticle(article: GdeltArticle, provenance: Provenance): MapResult {
  const publishedAt = fromGdeltDate(article.seendate);
  if (publishedAt === null) {
    return {
      kind: 'skipped',
      reason: `GDELT article "${article.title}" has an unparseable seendate ("${article.seendate}")`,
    };
  }

  const domain = registrableDomain(article.domain);
  if (domain === null) {
    return {
      kind: 'skipped',
      reason:
        `GDELT article "${article.title}" has no parseable publisher domain ` +
        `("${article.domain}"), so it could never count as an independent source`,
    };
  }

  const { extraction, method, severityBasis, basis } = extractFromHeadline(article);

  return {
    kind: 'signal',
    signal: {
      id: `gdelt_doc:${urlDigest(article.url)}`,
      source: 'gdelt_doc',
      publishedAt,
      title: article.title,
      text: article.title,
      url: article.url,
      domain,
      geoHint: article.sourcecountry ?? null,
      entityHint: null,
      contentHash: simhash(article.title),
      category: extraction.category,
      manufacturer: extraction.manufacturer,
      drugOrIngredient: extraction.drug_or_ingredient,
      locationCity: extraction.location_city,
      locationCountry: extraction.location_country,
      severity: extraction.severity_1_5,
      insight: extraction.insight,
      isPharmaSupplyRelevant: extraction.is_pharma_supply_relevant,
      extractionMethod: method,
      severityBasis,
      extractionBasis: basis,
      provenance,
    },
  };
}
