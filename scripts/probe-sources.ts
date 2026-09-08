/**
 * Phase 1 acceptance gate: prove every public source returns real live data.
 *
 *   npx tsx scripts/probe-sources.ts
 *
 * Each probe issues one real request through the cached client and prints what
 * came back, along with the provenance that was attached. It is a throwaway
 * script by design — its job is to be run once per source, have its output
 * pasted into docs/BUILD_LOG.md, and then be left alone as a diagnostic.
 *
 * It is also the honest way to discover which sources are actually reachable.
 * Where one is not, the run says so and the phase is marked blocked in the build
 * log. Nothing here fabricates a response (spec rule of engagement 9).
 */

import {
  CachedHttpClient,
  ComtradeClient,
  createMemoryCache,
  GdeltClient,
  NominatimClient,
  OpenFdaClient,
  OpenMeteoClient,
  OsrmClient,
  PHARMA_HS_CODES,
  toCoordinates,
  toImportShares,
  excludeWorldAggregate,
  UsgsClient,
  type Coordinates,
  type Fetched,
} from '@vitalink/connectors';

const MS_PER_DAY = 86_400_000;

/** Hyderabad: the densest pharmaceutical manufacturing cluster in India. */
const HYDERABAD: Coordinates = [78.4867, 17.385];
/** Mumbai, as a routing destination and second cluster. */
const MUMBAI: Coordinates = [72.8777, 19.076];

const cache = createMemoryCache();
const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: (context: Record<string, unknown>, message: string) => {
    console.log(`      retrying: ${message} ${JSON.stringify(context)}`);
  },
  error: () => undefined,
};

const http = new CachedHttpClient({ cache, logger });

type ProbeResult = { name: string; ok: boolean; detail: string };
const results: ProbeResult[] = [];

function showProvenance(fetched: Fetched<unknown>): void {
  console.log(`      source_name : ${fetched.provenance.source_name}`);
  console.log(`      source_url  : ${fetched.provenance.source_url}`);
  console.log(`      query       : ${fetched.provenance.query ?? '(none)'}`);
  console.log(`      fetched_at  : ${fetched.provenance.fetched_at}`);
}

async function probe(name: string, run: () => Promise<string>): Promise<void> {
  process.stdout.write(`\n>>> ${name}\n`);
  try {
    const detail = await run();
    results.push({ name, ok: true, detail });
    console.log(`    OK  ${detail}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.log(`    BLOCKED  ${detail}`);
  }
}

async function probeOpenFdaNdc(): Promise<string> {
  const client = new OpenFdaClient(http);
  const response = await client.searchNdc({
    search: 'generic_name:"heparin sodium"',
    limit: 5,
  });

  showProvenance(response);
  for (const product of response.data.slice(0, 3)) {
    console.log(
      `      ${product.product_ndc}  ${product.generic_name ?? '?'}  by ${product.labeler_name ?? '?'}`,
    );
  }
  return `${String(response.data.length)} NDC products`;
}

async function probeOpenFdaZApi(): Promise<string> {
  // This is exactly how `z_api` is derived: one count aggregation, not paging.
  const client = new OpenFdaClient(http);
  const response = await client.count('ndc', {
    search: 'generic_name:"heparin sodium"',
    count: 'labeler_name.exact',
  });

  showProvenance(response);
  console.log(`      distinct labelers: ${String(response.data.length)}`);
  for (const bucket of response.data.slice(0, 5)) {
    console.log(`      ${String(bucket.count).padStart(4)}  ${bucket.term}`);
  }
  return `z_api candidate = ${String(response.data.length)} distinct labelers`;
}

async function probeOpenFdaLabel(): Promise<string> {
  const client = new OpenFdaClient(http);
  const response = await client.searchLabels({
    search: 'openfda.generic_name:"heparin sodium" AND _exists_:storage_and_handling',
    limit: 2,
  });

  showProvenance(response);
  const storage = response.data[0]?.storage_and_handling?.[0];
  if (storage !== undefined) {
    console.log(`      storage text: ${storage.slice(0, 160)}...`);
  }
  return `${String(response.data.length)} labels with storage_and_handling`;
}

async function probeOpenFdaEnforcement(): Promise<string> {
  const client = new OpenFdaClient(http);
  const response = await client.searchEnforcement({
    search: 'product_type:"Drugs"',
    limit: 5,
    sort: 'report_date:desc',
  });

  showProvenance(response);
  for (const report of response.data.slice(0, 3)) {
    console.log(
      `      ${report.report_date ?? '?'}  ${report.classification ?? '?'}  ${(report.recalling_firm ?? '?').slice(0, 40)}`,
    );
  }
  return `${String(response.data.length)} recent drug recalls`;
}

async function probeOpenFdaShortages(): Promise<string> {
  const client = new OpenFdaClient(http);
  const response = await client.searchShortages({
    search: 'status:"Resolved"',
    limit: 5,
  });

  showProvenance(response);
  for (const record of response.data.slice(0, 3)) {
    console.log(
      `      ${record.generic_name ?? '?'}  posted ${record.initial_posting_date ?? '?'}  status ${record.status ?? '?'}`,
    );
  }
  return `${String(response.data.length)} resolved shortage records (these fit mu)`;
}

async function probeGdelt(): Promise<string> {
  const client = new GdeltClient(http);
  const response = await client.searchArticles({
    query: '("drug shortage" OR "pharmaceutical plant" OR "api plant") sourcelang:english',
    timespan: '7d',
    maxRecords: 10,
  });

  showProvenance(response);
  const domains = new Set(response.data.map((article) => article.domain));
  for (const article of response.data.slice(0, 3)) {
    console.log(`      [${article.domain}] ${article.title.slice(0, 80)}`);
  }
  console.log(`      distinct domains: ${String(domains.size)} (this is the independence count)`);
  return `${String(response.data.length)} articles from ${String(domains.size)} distinct domains`;
}

async function probeComtrade(): Promise<string> {
  const apiKey = process.env.UN_COMTRADE_API_KEY ?? '';
  const client = new ComtradeClient(http, apiKey);

  if (!client.isConfigured()) {
    // Not a failure of the client — a missing free key. Reported, never faked.
    throw new Error('UN_COMTRADE_API_KEY is not set. Get a free key at comtradeplus.un.org.');
  }

  const lastFullYear = new Date().getUTCFullYear() - 1;
  const response = await client.getAnnualTrade({
    cmdCode: PHARMA_HS_CODES[0],
    period: String(lastFullYear),
  });

  showProvenance(response);
  const shares = toImportShares(excludeWorldAggregate(response.data));
  for (const share of shares.slice(0, 5)) {
    console.log(
      `      ${(share.share * 100).toFixed(1).padStart(5)}%  ${share.partnerName} (USD ${share.value.toLocaleString('en-US')})`,
    );
  }
  const total = shares.reduce((sum, share) => sum + share.share, 0);
  console.log(`      shares sum to ${total.toFixed(6)} (must be 1.0)`);
  return `${String(shares.length)} partner countries for HS ${PHARMA_HS_CODES[0]} ${String(lastFullYear)}`;
}

async function probeNominatim(): Promise<string> {
  const userAgent = process.env.NOMINATIM_USER_AGENT ?? 'vitalink/0.1 (probe-script)';
  const client = new NominatimClient(http, userAgent);
  const response = await client.geocode('Genome Valley, Hyderabad, Telangana, India');

  showProvenance(response);
  const first = response.data[0];
  if (first === undefined) return 'no match (this is a legitimate empty state)';

  const point = toCoordinates(first);
  console.log(`      ${first.display_name}`);
  console.log(`      coordinates [lon, lat]: ${JSON.stringify(point)}`);
  return `geocoded to ${JSON.stringify(point)}`;
}

async function probeOsrm(): Promise<string> {
  const client = new OsrmClient(http);
  const response = await client.route(HYDERABAD, MUMBAI, { alternatives: true });

  showProvenance(response);
  response.data.forEach((route, index) => {
    console.log(
      `      route ${String(index)}: ${route.distanceKm.toFixed(0)} km, ${route.durationHours.toFixed(1)} h` +
        `${route.geometryPolyline === null ? '' : ', geometry present'}`,
    );
  });
  return `${String(response.data.length)} road route(s) Hyderabad to Mumbai`;
}

async function probeOpenMeteo(): Promise<string> {
  const client = new OpenMeteoClient(http);
  const response = await client.hourlyTemperature(HYDERABAD, { forecastDays: 2 });

  showProvenance(response);
  const temperatures = response.data.map((point) => point.celsius);
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  console.log(
    `      ${String(response.data.length)} hourly points, ${min.toFixed(1)}..${max.toFixed(1)} C`,
  );
  console.log(
    `      a 2-8 C shipment through this ambient range is what the excursion term models`,
  );
  return `${String(response.data.length)} hourly temperatures, range ${min.toFixed(1)}..${max.toFixed(1)} C`;
}

async function probeUsgs(): Promise<string> {
  const client = new UsgsClient(http);
  const startTime = new Date(Date.now() - 365 * MS_PER_DAY).toISOString().slice(0, 10);
  const response = await client.recentEvents({
    centre: HYDERABAD,
    radiusKm: 800,
    minMagnitude: 4,
    startTime,
  });

  showProvenance(response);
  for (const event of response.data.slice(0, 3)) {
    console.log(`      M${event.magnitude.toFixed(1)}  ${event.occurredAt}  ${event.place}`);
  }
  return `${String(response.data.length)} events M>=4 within 800km in the last year`;
}

async function main(): Promise<void> {
  console.log('Vitalink source probe — every request below is real and live.\n');
  console.log('Nothing here is stubbed. A source that cannot be reached is reported');
  console.log('as BLOCKED and recorded as such in docs/BUILD_LOG.md.\n');

  await probe('openFDA drug/ndc — the product universe', probeOpenFdaNdc);
  await probe('openFDA drug/ndc count — how z_api is derived', probeOpenFdaZApi);
  await probe('openFDA drug/label — storage and handling text', probeOpenFdaLabel);
  await probe('openFDA drug/enforcement — recall history (fits lambda)', probeOpenFdaEnforcement);
  await probe('openFDA drug/shortages — shortage history (fits mu)', probeOpenFdaShortages);
  await probe('GDELT 2.0 DOC — live news and the independence count', probeGdelt);
  await probe('UN Comtrade — import shares for SOURCED_FROM edges', probeComtrade);
  await probe('Nominatim — geocoding', probeNominatim);
  await probe('OSRM — road routing and lane geometry', probeOsrm);
  await probe('Open-Meteo — hourly temperature for cold-chain risk', probeOpenMeteo);
  await probe('USGS — seismic events near manufacturing clusters', probeUsgs);

  console.log('\n\n=== SUMMARY ===\n');
  for (const result of results) {
    console.log(`${result.ok ? 'OK      ' : 'BLOCKED '} ${result.name}`);
    if (!result.ok) console.log(`         ${result.detail}`);
  }

  const reachable = results.filter((result) => result.ok).length;
  console.log(`\n${String(reachable)} of ${String(results.length)} probes returned live data.`);

  if (reachable < results.length) {
    console.log('\nBlocked probes are recorded in docs/BUILD_LOG.md. No response was fabricated.');
  }
}

// `void main()` rather than top-level await: the repo compiles to CommonJS
// (ADR-0002), and CommonJS has no top-level await.
void main();
