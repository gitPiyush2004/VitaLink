/**
 * GDELT 2.0 DOC API — live global news in 65 languages, free, no key.
 *
 * This is the source that makes SENSE more than a regulatory feed. openFDA tells
 * us about a recall once the FDA has published it; GDELT can surface the plant
 * fire that caused it days earlier. That difference is what the evaluation
 * harness measures as *lead time*.
 *
 * Two practical notes.
 *
 * `domain` on each article is what makes corroboration meaningful: two articles
 * from the same registrable domain are one source, not two, no matter how
 * differently they are worded. The VERIFY stage counts distinct domains, and
 * this field is where that count comes from.
 *
 * GDELT sometimes answers a malformed or too-broad query with HTTP 200 and a
 * plain-text error page rather than JSON. The schema catches that as
 * `malformed_response` instead of letting a parse failure surface later as a
 * confusing empty ingestion run.
 */

import { z } from 'zod';

import type { CachedHttpClient, Fetched } from '../http/cached-client';

import { sourceConfig } from './source-registry';

const DEFAULT_MAX_RECORDS = 75;
const MAX_RECORDS_ALLOWED = 250;

export const gdeltArticleSchema = z.object({
  url: z.string(),
  title: z.string(),
  /** The registrable domain. The unit of "independent source" in VERIFY. */
  domain: z.string(),
  language: z.string().optional(),
  /** GDELT's own format: YYYYMMDDTHHMMSSZ. Converted in the ingestion mapper. */
  seendate: z.string(),
  socialimage: z.string().optional(),
  sourcecountry: z.string().optional(),
});
export type GdeltArticle = z.infer<typeof gdeltArticleSchema>;

/** GDELT omits `articles` entirely when nothing matches, rather than sending []. */
const gdeltResponseSchema = z.object({
  articles: z.array(gdeltArticleSchema).optional(),
});

export type GdeltQuery = {
  /**
   * A GDELT query string. Phrases need quoting, and operators are supported:
   *   ("drug shortage" OR "api plant") sourcelang:english
   */
  query: string;
  /** e.g. '15min', '24h', '7d'. Mutually exclusive with an explicit date range. */
  timespan?: string;
  maxRecords?: number;
  /** Restricts to a domain, which is how targeted corroboration queries work. */
  domain?: string;
  /** Excludes a domain, so corroboration cannot count the originating outlet. */
  excludeDomain?: string;
};

/** Measured: a 50-record query over a 30-day window took 23 seconds. */
const GDELT_TIMEOUT_MS = 40_000;

export class GdeltClient {
  constructor(private readonly http: CachedHttpClient) {}

  async searchArticles(query: GdeltQuery): Promise<Fetched<GdeltArticle[]>> {
    const config = sourceConfig('gdelt_doc');
    const url = buildUrl(config.baseUrl, query);

    const response = await this.http.getJson(
      {
        sourceId: config.id,
        displayName: config.displayName,
        url,
        queryDescription: describeQuery(query),
        minIntervalMs: config.minIntervalMs,
        cacheTtlSeconds: config.cacheTtlSeconds,
        // GDELT's TLS handshake takes ~11s from some networks, which is past
        // undici's 10s connect ceiling — so every request failed as
        // "unreachable" while curl on the same machine got a 200. Measured, not
        // guessed; see CONNECT_TIMEOUT_MS in cached-client.ts.
        slowHandshake: true,
        // And the whole request needs longer than the 20s default: a 50-record
        // query over 30 days took 23 seconds end to end.
        timeoutMs: GDELT_TIMEOUT_MS,
      },
      gdeltResponseSchema,
    );

    return { ...response, data: response.data.articles ?? [] };
  }
}

function buildUrl(baseUrl: string, query: GdeltQuery): string {
  const clauses = [query.query];
  if (query.domain !== undefined) clauses.push(`domain:${query.domain}`);
  if (query.excludeDomain !== undefined) clauses.push(`-domain:${query.excludeDomain}`);

  const params = new URLSearchParams({
    query: clauses.join(' '),
    mode: 'artlist',
    format: 'json',
    maxrecords: String(Math.min(query.maxRecords ?? DEFAULT_MAX_RECORDS, MAX_RECORDS_ALLOWED)),
    // Newest first: an ingestion poll wants what has appeared since last time.
    sort: 'datedesc',
  });

  if (query.timespan !== undefined) params.set('timespan', query.timespan);

  return `${baseUrl}?${params.toString()}`;
}

function describeQuery(query: GdeltQuery): string {
  const parts = [`query=${query.query}`];
  if (query.timespan !== undefined) parts.push(`timespan=${query.timespan}`);
  if (query.domain !== undefined) parts.push(`domain=${query.domain}`);
  if (query.excludeDomain !== undefined) parts.push(`-domain=${query.excludeDomain}`);
  return parts.join(' ');
}

/**
 * Converts GDELT's `YYYYMMDDTHHMMSSZ` into an ISO 8601 instant.
 *
 * Exported and pure so it can be unit tested. A malformed value returns null
 * rather than an invalid Date, because a signal with a nonsense `published_at`
 * would corrupt the time-series collection it is written into.
 */
export function parseGdeltDate(seendate: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (match === null) return null;

  const [, year, month, day, hour, minute, second] = match;
  const iso = `${String(year)}-${String(month)}-${String(day)}T${String(hour)}:${String(minute)}:${String(second)}.000Z`;
  const parsed = Date.parse(iso);

  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
