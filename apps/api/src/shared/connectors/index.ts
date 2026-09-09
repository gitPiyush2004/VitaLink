/**
 * The composition root for egress.
 *
 * `packages/connectors` deliberately depends on interfaces rather than on Redis
 * or pino (see its `http/ports.ts`). This file is where those interfaces meet
 * the real implementations, once, so every source client in the API shares one
 * cache, one rate limiter and one logger.
 *
 * Sharing the *same* `CachedHttpClient` instance across all clients is not an
 * optimisation, it is a correctness requirement: the rate limiter's state lives
 * on the instance, so two clients with separate instances would each get their
 * own Nominatim allowance and between them exceed the published limit.
 */

import {
  CachedHttpClient,
  ComtradeClient,
  GdeltClient,
  NominatimClient,
  OpenFdaClient,
  OpenMeteoClient,
  OsrmClient,
  UsgsClient,
  type ResponseCache,
} from '@vitalink/connectors';

import { env } from '@config/env';
import { getRedis } from '@shared/db/redis';
import { logger } from '@shared/logger';

const CACHE_KEY_PREFIX = 'vitalink:';

/**
 * The Redis-backed response cache.
 *
 * A Redis failure returns a miss rather than throwing. That is deliberate: the
 * cache is an optimisation and a courtesy to upstream sources, not a source of
 * truth, so losing it should slow the system down rather than break it.
 */
function createRedisCache(): ResponseCache {
  return {
    async get(key: string): Promise<string | null> {
      try {
        return await getRedis().get(`${CACHE_KEY_PREFIX}${key}`);
      } catch (error) {
        logger.warn({ err: error, key }, 'response cache read failed; treating as a miss');
        return null;
      }
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      try {
        await getRedis().set(`${CACHE_KEY_PREFIX}${key}`, value, 'EX', ttlSeconds);
      } catch (error) {
        logger.warn({ err: error, key }, 'response cache write failed; continuing uncached');
      }
    },
  };
}

let http: CachedHttpClient | null = null;

/**
 * The one HTTP client. Lazily built because it needs Redis, which is connected
 * during startup rather than at import time.
 */
export function getHttpClient(): CachedHttpClient {
  if (http === null) {
    http = new CachedHttpClient({
      cache: createRedisCache(),
      logger: logger.child({ component: 'connectors' }),
    });
  }
  return http;
}

export type SourceClients = {
  openFda: OpenFdaClient;
  gdelt: GdeltClient;
  comtrade: ComtradeClient;
  nominatim: NominatimClient | null;
  osrm: OsrmClient;
  openMeteo: OpenMeteoClient;
  usgs: UsgsClient;
};

let clients: SourceClients | null = null;

/**
 * All source clients, sharing one HTTP client.
 *
 * `nominatim` can be null. Its constructor throws when the User-Agent still
 * contains a placeholder contact address, because Nominatim answers those with
 * HTTP 403 — so rather than let that throw take down catalogue ingestion, the
 * failure is caught here and geocoding degrades to an empty state with a reason.
 * Every other capability keeps working.
 */
export function getSourceClients(): SourceClients {
  if (clients !== null) return clients;

  const shared = getHttpClient();
  clients = {
    openFda: new OpenFdaClient(shared),
    gdelt: new GdeltClient(shared),
    comtrade: new ComtradeClient(shared, env.UN_COMTRADE_API_KEY),
    nominatim: buildNominatim(shared),
    osrm: new OsrmClient(shared),
    openMeteo: new OpenMeteoClient(shared),
    usgs: new UsgsClient(shared),
  };
  return clients;
}

function buildNominatim(shared: CachedHttpClient): NominatimClient | null {
  try {
    return new NominatimClient(shared, env.NOMINATIM_USER_AGENT);
  } catch (error) {
    logger.warn(
      { err: error },
      'geocoding is disabled: NOMINATIM_USER_AGENT must name a contactable operator',
    );
    return null;
  }
}
