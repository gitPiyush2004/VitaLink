/**
 * UN Comtrade — bilateral trade flows by HS code.
 *
 * This is the source that closes one of the two limitations Vitalink claims to
 * close in arXiv:2601.09680. That paper needs proprietary multi-tier supplier
 * data (Bloomberg, FactSet, Panjiva) to know who depends on whom. We do not have
 * that, and no free source publishes a tier-2 contract.
 *
 * What Comtrade does publish is India's real import value per partner country per
 * HS code. From that we derive a **country-dependency edge weighted by import
 * share** — labelled a probability in the UI, never a contract. It is a weaker
 * claim than the paper's, and it is an honest one.
 *
 * The HS codes that matter for pharmaceuticals (spec PART 5):
 *   2941  antibiotics
 *   2933  heterocyclic compounds with nitrogen hetero-atoms only
 *   2934  nucleic acids and other heterocyclic compounds
 *   2936  vitamins, provitamins and derivatives
 *   3003  medicaments, not in measured doses
 *   3004  medicaments, in measured doses
 */

import { z } from 'zod';

import type { CachedHttpClient, Fetched } from '../http/cached-client';
import { ConnectorError } from '../http/connector-error';

import { sourceConfig } from './source-registry';

/** The HS chapters and headings that carry pharmaceutical inputs and products. */
export const PHARMA_HS_CODES = ['2941', '2933', '2934', '2936', '3003', '3004'] as const;
export type PharmaHsCode = (typeof PHARMA_HS_CODES)[number];

/** ISO 3166-1 numeric, which is what Comtrade's reporter/partner codes use. */
export const REPORTER_INDIA = '699';

const comtradeRecordSchema = z.object({
  /** Reporting country, ISO numeric as a number in the response. */
  reporterCode: z.number().optional(),
  reporterDesc: z.string().optional(),
  partnerCode: z.number().optional(),
  partnerDesc: z.string().optional(),
  /** HS code at the requested aggregation level. */
  cmdCode: z.string().optional(),
  cmdDesc: z.string().optional(),
  /** 'M' for imports, 'X' for exports. */
  flowCode: z.string().optional(),
  flowDesc: z.string().optional(),
  period: z.union([z.string(), z.number()]).optional(),
  refYear: z.number().optional(),
  /** Trade value in current US dollars. The basis for the import share. */
  primaryValue: z.number().nullable().optional(),
  netWgt: z.number().nullable().optional(),
  qty: z.number().nullable().optional(),
});
export type ComtradeRecord = z.infer<typeof comtradeRecordSchema>;

const comtradeResponseSchema = z.object({
  /** Present on success. Absent, with `error` set, on a bad request or quota. */
  data: z.array(comtradeRecordSchema).optional(),
  count: z.number().optional(),
  error: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .nullable()
    .optional(),
  elapsedTime: z.string().optional(),
});

export type ComtradeQuery = {
  /** ISO numeric. Defaults to India. */
  reporterCode?: string;
  /** HS code. `'ALL'` is accepted but expensive; prefer one code per call. */
  cmdCode: string;
  /** Four-digit year, or a comma-separated list. */
  period: string;
  /** 'M' imports, 'X' exports. */
  flowCode?: 'M' | 'X';
};

export class ComtradeClient {
  constructor(
    private readonly http: CachedHttpClient,
    /**
     * The free subscription key. Empty is a legitimate state: the client says so
     * with a `missing_credentials` error and the caller degrades to an empty
     * state with that reason, rather than inventing an import share.
     */
    private readonly apiKey: string,
  ) {}

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async getAnnualTrade(query: ComtradeQuery): Promise<Fetched<ComtradeRecord[]>> {
    const config = sourceConfig('un_comtrade');

    if (!this.isConfigured()) {
      throw new ConnectorError({
        kind: 'missing_credentials',
        sourceId: config.id,
        message:
          'UN Comtrade needs a free subscription key. Set UN_COMTRADE_API_KEY. Without it, ' +
          'country-dependency edges cannot be derived and are shown as an empty state.',
        url: config.documentationUrl,
      });
    }

    const url = buildUrl(config.baseUrl, query);
    const response = await this.http.getJson(
      {
        sourceId: config.id,
        displayName: config.displayName,
        url,
        queryDescription: describeQuery(query),
        minIntervalMs: config.minIntervalMs,
        cacheTtlSeconds: config.cacheTtlSeconds,
        // The key goes in a header, never the query string, so it cannot end up
        // in a log line, a cache key or a provenance `source_url`.
        headers: { 'Ocp-Apim-Subscription-Key': this.apiKey },
      },
      comtradeResponseSchema,
    );

    if (response.data.error !== null && response.data.error !== undefined) {
      throw new ConnectorError({
        kind: 'upstream_error',
        sourceId: config.id,
        message: `UN Comtrade reported an error: ${JSON.stringify(response.data.error)}`,
        url,
      });
    }

    return { ...response, data: response.data.data ?? [] };
  }
}

/**
 * Turns trade values into import shares.
 *
 * Pure, exported, and unit tested, because this is the arithmetic behind every
 * `SOURCED_FROM` edge weight in the graph. The `calculation_method` stored on
 * each edge cites this function by name.
 *
 * Shares are computed over the records supplied, so the caller controls the
 * denominator — and the caller is expected to exclude the "World" aggregate
 * partner, which Comtrade includes and which would double the total.
 */
export function toImportShares(
  records: ComtradeRecord[],
): { partnerCode: string; partnerName: string; value: number; share: number }[] {
  const withValue = records
    .filter((record) => typeof record.primaryValue === 'number' && record.primaryValue > 0)
    .map((record) => ({
      partnerCode: String(record.partnerCode ?? ''),
      partnerName: record.partnerDesc ?? 'unknown',
      value: record.primaryValue ?? 0,
    }));

  const total = withValue.reduce((sum, record) => sum + record.value, 0);
  if (total === 0) return [];

  return withValue
    .map((record) => ({ ...record, share: record.value / total }))
    .sort((a, b) => b.share - a.share);
}

/** Comtrade reports a "World" aggregate alongside individual partners. */
export const WORLD_PARTNER_CODE = '0';

export function excludeWorldAggregate(records: ComtradeRecord[]): ComtradeRecord[] {
  return records.filter((record) => String(record.partnerCode ?? '') !== WORLD_PARTNER_CODE);
}

function buildUrl(baseUrl: string, query: ComtradeQuery): string {
  const params = new URLSearchParams({
    reporterCode: query.reporterCode ?? REPORTER_INDIA,
    period: query.period,
    cmdCode: query.cmdCode,
    flowCode: query.flowCode ?? 'M',
    // HS classification, annual frequency, all partners, aggregate trade.
    partnerCode: 'ALL',
    partner2Code: '0',
    customsCode: 'C00',
    motCode: '0',
    includeDesc: 'true',
  });

  return `${baseUrl}/C/A/HS?${params.toString()}`;
}

function describeQuery(query: ComtradeQuery): string {
  return [
    `reporter=${query.reporterCode ?? REPORTER_INDIA}`,
    `hs=${query.cmdCode}`,
    `period=${query.period}`,
    `flow=${query.flowCode ?? 'M'}`,
    'partner=ALL',
  ].join(' ');
}
