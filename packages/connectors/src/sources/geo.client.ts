/**
 * Geography: Nominatim for geocoding, OSRM for routing.
 *
 * These two are what let the physical layer of the graph exist. Without
 * coordinates a facility cannot be placed on a map, a lane has no distance, and
 * the weather along that lane cannot be sampled — so the cold-chain excursion
 * term in the logistics risk sub-score has nothing to work with.
 *
 * Nominatim's usage policy is a hard constraint, not a guideline: at most one
 * request per second, and a `User-Agent` that identifies a contactable operator.
 * The rate limiter enforces the first; the constructor requires the second and
 * refuses to run without it. Ignoring either gets the IP blocked, which would
 * take the whole geocoding pipeline down.
 *
 * Both are cached for months, because addresses and roads do not move.
 */

import { z } from 'zod';

import type { CachedHttpClient, Fetched } from '../http/cached-client';
import { ConnectorError } from '../http/connector-error';

import { sourceConfig } from './source-registry';

// ---------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------

const nominatimResultSchema = z.object({
  /** Strings, not numbers: Nominatim returns coordinates as decimal strings. */
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  /** Nominatim's own confidence proxy. Kept and surfaced, never used as a score. */
  importance: z.number().optional(),
  type: z.string().optional(),
  class: z.string().optional(),
  address: z
    .object({
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      country_code: z.string().optional(),
      postcode: z.string().optional(),
    })
    .optional(),
});
export type NominatimResult = z.infer<typeof nominatimResultSchema>;

/** GeoJSON order: [longitude, latitude]. Getting this backwards is the classic bug. */
export type Coordinates = [longitude: number, latitude: number];

/**
 * Placeholder addresses that ship in `.env.example` and in tutorials.
 *
 * Nominatim answers a request whose User-Agent it does not consider contactable
 * with HTTP 403, which is what the first probe run received. Failing here with an
 * actionable message beats failing at the fourth retry with "returned 403".
 */
const PLACEHOLDER_CONTACTS = ['your-email@example.com', 'example.com', 'contact-unset', 'foo@bar'];

function assertUsableUserAgent(userAgent: string): void {
  const trimmed = userAgent.trim();

  if (trimmed.length === 0) {
    throw new Error(
      "Nominatim's usage policy requires a User-Agent identifying a contactable operator. " +
        'Set NOMINATIM_USER_AGENT to something with a real email address in it.',
    );
  }

  const placeholder = PLACEHOLDER_CONTACTS.find((candidate) =>
    trimmed.toLowerCase().includes(candidate),
  );

  if (placeholder !== undefined) {
    throw new Error(
      `NOMINATIM_USER_AGENT still contains the placeholder "${placeholder}". Nominatim ` +
        'rejects requests it cannot attribute to a contactable operator with HTTP 403. ' +
        'Put a real email address in it.',
    );
  }
}

export class NominatimClient {
  constructor(
    private readonly http: CachedHttpClient,
    /** Must identify a contactable operator; their policy requires it. */
    private readonly userAgent: string,
  ) {
    assertUsableUserAgent(userAgent);
  }

  async geocode(freeformAddress: string): Promise<Fetched<NominatimResult[]>> {
    const config = sourceConfig('nominatim');
    const params = new URLSearchParams({
      q: freeformAddress,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
    });
    const url = `${config.baseUrl}?${params.toString()}`;

    return this.http.getJson(
      {
        sourceId: config.id,
        displayName: config.displayName,
        url,
        queryDescription: `q=${freeformAddress}`,
        minIntervalMs: config.minIntervalMs,
        cacheTtlSeconds: config.cacheTtlSeconds,
        headers: { 'User-Agent': this.userAgent },
      },
      z.array(nominatimResultSchema),
    );
  }
}

/**
 * Extracts coordinates from a Nominatim result.
 *
 * Returns null rather than throwing when the strings will not parse, because the
 * caller's fallback is a documented one: use the city centroid and label the
 * point as such. A geocode that cannot be resolved is an empty state with a
 * reason, never an invented coordinate.
 */
export function toCoordinates(result: NominatimResult): Coordinates | null {
  const longitude = Number(result.lon);
  const latitude = Number(result.lat);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
}

// ---------------------------------------------------------------------------
// OSRM
// ---------------------------------------------------------------------------

const osrmRouteSchema = z.object({
  distance: z.number(),
  duration: z.number(),
  /** Encoded polyline. Weather is sampled along this geometry for the risk term. */
  geometry: z.string().optional(),
});

const osrmResponseSchema = z.object({
  code: z.string(),
  routes: z.array(osrmRouteSchema).optional(),
  message: z.string().optional(),
});

export type RoadRoute = {
  distanceKm: number;
  durationHours: number;
  geometryPolyline: string | null;
};

const METRES_PER_KM = 1000;
const SECONDS_PER_HOUR = 3600;

export class OsrmClient {
  constructor(private readonly http: CachedHttpClient) {}

  /**
   * Primary road route between two points, with alternates when asked.
   *
   * Note this uses the public OSRM demo server, whose fair-use terms make it
   * unsuitable for production volume. That is recorded in ADR-0009: a real
   * deployment would self-host, and the only thing that changes is the base URL
   * in the source registry.
   */
  async route(
    origin: Coordinates,
    destination: Coordinates,
    options: { alternatives?: boolean } = {},
  ): Promise<Fetched<RoadRoute[]>> {
    const config = sourceConfig('osrm');
    const coordinates = `${String(origin[0])},${String(origin[1])};${String(destination[0])},${String(destination[1])}`;
    const params = new URLSearchParams({
      overview: 'simplified',
      geometries: 'polyline',
      alternatives: options.alternatives === true ? 'true' : 'false',
    });
    const url = `${config.baseUrl}/${coordinates}?${params.toString()}`;

    const response = await this.http.getJson(
      {
        sourceId: config.id,
        displayName: config.displayName,
        url,
        queryDescription: `route ${coordinates}`,
        minIntervalMs: config.minIntervalMs,
        cacheTtlSeconds: config.cacheTtlSeconds,
      },
      osrmResponseSchema,
    );

    if (response.data.code !== 'Ok') {
      throw new ConnectorError({
        kind: response.data.code === 'NoRoute' ? 'not_found' : 'upstream_error',
        sourceId: config.id,
        message: `OSRM returned ${response.data.code}: ${response.data.message ?? 'no message'}`,
        url,
      });
    }

    return {
      ...response,
      data: (response.data.routes ?? []).map((route) => ({
        distanceKm: route.distance / METRES_PER_KM,
        durationHours: route.duration / SECONDS_PER_HOUR,
        geometryPolyline: route.geometry ?? null,
      })),
    };
  }
}
