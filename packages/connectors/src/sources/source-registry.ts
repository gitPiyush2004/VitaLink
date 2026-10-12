/**
 * Per-source configuration: base URL, rate limit, cache TTL and citation name.
 *
 * Every public source Vitalink reads is declared here, once. The refresh
 * intervals come straight from spec PART 5, and the rate limits come from each
 * source's published usage policy — Nominatim's one-request-per-second rule in
 * particular is a condition of use, not a suggestion.
 *
 * Keeping this as data rather than spreading it through the client files means
 * "how often do we hit openFDA, and why?" is answerable by reading one table.
 */

import type { SignalSource } from '@vitalink/contracts';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;
const MS_PER_SECOND = 1000;

export type SourceConfig = {
  /** Matches the `SignalSource` enum, so a stored signal names its own config. */
  id: SignalSource;
  /** How the source is cited in provenance and in the UI's Sources drawer. */
  displayName: string;
  baseUrl: string;
  /**
   * Minimum gap between two requests to this source, in milliseconds.
   * Where the source publishes a policy, this is that policy.
   */
  minIntervalMs: number;
  /** Redis TTL for a successful response. Derived from the source's refresh rate. */
  cacheTtlSeconds: number;
  /** Whether a key is required. An absent key is reported, never worked around. */
  requiresKey: boolean;
  /** The human-facing page a reader can open to check the source themselves. */
  documentationUrl: string;
};

export const SOURCES: Record<SignalSource, SourceConfig> = {
  // ---- openFDA ------------------------------------------------------------
  // One rate limit covers all four endpoints because they share a quota:
  // 240 requests/minute unauthenticated, so 250ms between requests is safe.
  openfda_ndc: {
    id: 'openfda_ndc',
    displayName: 'openFDA NDC Directory',
    baseUrl: 'https://api.fda.gov/drug/ndc.json',
    minIntervalMs: 250,
    cacheTtlSeconds: 6 * SECONDS_PER_HOUR,
    requiresKey: false,
    documentationUrl: 'https://open.fda.gov/apis/drug/ndc/',
  },
  openfda_label: {
    id: 'openfda_label',
    displayName: 'openFDA Drug Label',
    baseUrl: 'https://api.fda.gov/drug/label.json',
    minIntervalMs: 250,
    cacheTtlSeconds: 6 * SECONDS_PER_HOUR,
    requiresKey: false,
    documentationUrl: 'https://open.fda.gov/apis/drug/label/',
  },
  openfda_enforcement: {
    id: 'openfda_enforcement',
    displayName: 'openFDA Drug Enforcement Reports',
    baseUrl: 'https://api.fda.gov/drug/enforcement.json',
    minIntervalMs: 250,
    cacheTtlSeconds: 6 * SECONDS_PER_HOUR,
    requiresKey: false,
    documentationUrl: 'https://open.fda.gov/apis/drug/enforcement/',
  },
  // Approval records and therapeutic-equivalence codes. This is the only
  // endpoint that publishes a TE code over an API; the Orange Book publishes the
  // same codes as a downloadable archive, which gate 2 would reject as a bundled
  // dataset. A product with no `te_code` here has none published — which is not
  // the same as being rated non-equivalent, and must never be rendered as such.
  openfda_drugsfda: {
    id: 'openfda_drugsfda',
    displayName: 'openFDA Drugs@FDA',
    baseUrl: 'https://api.fda.gov/drug/drugsfda.json',
    minIntervalMs: 250,
    // Approval records change on submission, not continuously.
    cacheTtlSeconds: 24 * SECONDS_PER_HOUR,
    requiresKey: false,
    documentationUrl: 'https://open.fda.gov/apis/drug/drugsfda/',
  },
  openfda_shortages: {
    id: 'openfda_shortages',
    displayName: 'openFDA Drug Shortages',
    baseUrl: 'https://api.fda.gov/drug/shortages.json',
    minIntervalMs: 250,
    cacheTtlSeconds: 6 * SECONDS_PER_HOUR,
    requiresKey: false,
    documentationUrl: 'https://open.fda.gov/apis/drug/shortages/',
  },

  // ---- Registries ---------------------------------------------------------
  dailymed_spl: {
    id: 'dailymed_spl',
    displayName: 'DailyMed SPL',
    baseUrl: 'https://dailymed.nlm.nih.gov/dailymed/services/v2',
    minIntervalMs: 500,
    cacheTtlSeconds: 7 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm',
  },
  cdsco_alerts: {
    id: 'cdsco_alerts',
    displayName: 'CDSCO Drug Alerts (India)',
    baseUrl: 'https://cdsco.gov.in',
    // A courtesy limit: CDSCO publishes PDFs from a small government server and
    // has no API to rate-limit us, so we throttle ourselves.
    minIntervalMs: 2 * MS_PER_SECOND,
    cacheTtlSeconds: 7 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/',
  },
  nppa_dpco: {
    id: 'nppa_dpco',
    displayName: 'NPPA Ceiling Prices (DPCO)',
    baseUrl: 'https://www.nppaindia.nic.in',
    minIntervalMs: 2 * MS_PER_SECOND,
    cacheTtlSeconds: 7 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'https://www.nppaindia.nic.in/en/ceiling-price/',
  },

  // ---- News ---------------------------------------------------------------
  gdelt_doc: {
    id: 'gdelt_doc',
    displayName: 'GDELT 2.0 DOC API',
    baseUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
    // Five seconds, and this is not a guess. GDELT answers a faster caller with
    // HTTP 429 and the body "Please limit requests to one every 5 seconds",
    // which is exactly what the first probe run received. Their number, not ours.
    minIntervalMs: 5 * MS_PER_SECOND,
    cacheTtlSeconds: 15 * SECONDS_PER_MINUTE,
    requiresKey: false,
    documentationUrl: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
  },

  // ---- Trade --------------------------------------------------------------
  un_comtrade: {
    id: 'un_comtrade',
    displayName: 'UN Comtrade',
    baseUrl: 'https://comtradeapi.un.org/data/v1/get',
    // The free tier is metered per day, so requests are spaced generously and
    // cached for a month — the underlying data is monthly anyway.
    minIntervalMs: 3 * MS_PER_SECOND,
    cacheTtlSeconds: 30 * SECONDS_PER_DAY,
    requiresKey: true,
    documentationUrl: 'https://comtradedeveloper.un.org/',
  },

  // ---- Hazards ------------------------------------------------------------
  open_meteo: {
    id: 'open_meteo',
    displayName: 'Open-Meteo Forecast',
    baseUrl: 'https://api.open-meteo.com/v1/forecast',
    minIntervalMs: 200,
    cacheTtlSeconds: 3 * SECONDS_PER_HOUR,
    requiresKey: false,
    documentationUrl: 'https://open-meteo.com/en/docs',
  },
  usgs_fdsnws: {
    id: 'usgs_fdsnws',
    displayName: 'USGS Earthquake Catalog',
    baseUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    minIntervalMs: 500,
    cacheTtlSeconds: 30 * SECONDS_PER_MINUTE,
    requiresKey: false,
    documentationUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/',
  },

  // ---- Geography ----------------------------------------------------------
  nominatim: {
    id: 'nominatim',
    displayName: 'OpenStreetMap Nominatim',
    baseUrl: 'https://nominatim.openstreetmap.org/search',
    // Their usage policy is an absolute maximum of one request per second, and a
    // contactable User-Agent. Exceeding it gets the IP blocked, so this is the
    // one rate limit in the file that must not be tuned down.
    minIntervalMs: MS_PER_SECOND,
    // Addresses do not move. A long TTL is both polite and correct.
    cacheTtlSeconds: 90 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'https://operations.osmfoundation.org/policies/nominatim/',
  },
  osrm: {
    id: 'osrm',
    displayName: 'OSRM Routing (demo server)',
    baseUrl: 'https://router.project-osrm.org/route/v1/driving',
    minIntervalMs: MS_PER_SECOND,
    cacheTtlSeconds: 30 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'http://project-osrm.org/docs/v5.24.0/api/',
  },
  osm_overpass: {
    id: 'osm_overpass',
    displayName: 'OpenStreetMap Overpass API',
    baseUrl: 'https://overpass-api.de/api/interpreter',
    // Overpass queries are expensive for the server; five seconds apart is the
    // conventional courtesy interval for a batch consumer.
    minIntervalMs: 5 * MS_PER_SECOND,
    cacheTtlSeconds: 30 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'https://wiki.openstreetmap.org/wiki/Overpass_API',
  },
  data_gov_in: {
    id: 'data_gov_in',
    displayName: 'data.gov.in',
    baseUrl: 'https://api.data.gov.in/resource',
    minIntervalMs: MS_PER_SECOND,
    cacheTtlSeconds: 30 * SECONDS_PER_DAY,
    requiresKey: true,
    documentationUrl: 'https://data.gov.in/help/how-use-datasets-apis',
  },

  // ---- Static reference ---------------------------------------------------
  who_eml: {
    id: 'who_eml',
    displayName: 'WHO Essential Medicines List / ATC-DDD',
    baseUrl: 'https://list.essentialmeds.org',
    minIntervalMs: MS_PER_SECOND,
    // Published on a roughly two-year cycle, so effectively static.
    cacheTtlSeconds: 90 * SECONDS_PER_DAY,
    requiresKey: false,
    documentationUrl: 'https://list.essentialmeds.org/',
  },
};

export function sourceConfig(id: SignalSource): SourceConfig {
  return SOURCES[id];
}
