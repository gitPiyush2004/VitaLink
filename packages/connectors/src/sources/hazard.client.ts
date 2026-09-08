/**
 * Hazards: Open-Meteo for temperature, USGS for seismicity.
 *
 * Both feed the logistics `risk` sub-score (spec 6.7), and both are reused rather
 * than duplicated — the whole point of that sub-score is that it is built from
 * signals stages 1 to 4 already collect.
 *
 * Open-Meteo matters specifically for cold chain. A 2-8 °C shipment on a road
 * lane through 44 °C ambient is a different proposition from the same shipment in
 * winter, and the forecast along the OSRM geometry is how that difference becomes
 * a number instead of an opinion.
 */

import { z } from 'zod';

import type { CachedHttpClient, Fetched } from '../http/cached-client';

import type { Coordinates } from './geo.client';
import { sourceConfig } from './source-registry';

// ---------------------------------------------------------------------------
// Open-Meteo
// ---------------------------------------------------------------------------

const openMeteoSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  hourly: z
    .object({
      /** ISO local timestamps. */
      time: z.array(z.string()),
      temperature_2m: z.array(z.number().nullable()),
    })
    .optional(),
  hourly_units: z.object({ temperature_2m: z.string().optional() }).optional(),
});

export type HourlyTemperature = { at: string; celsius: number };

const DEFAULT_FORECAST_DAYS = 7;
const MAX_FORECAST_DAYS = 16;

export class OpenMeteoClient {
  constructor(private readonly http: CachedHttpClient) {}

  async hourlyTemperature(
    point: Coordinates,
    options: { forecastDays?: number } = {},
  ): Promise<Fetched<HourlyTemperature[]>> {
    const config = sourceConfig('open_meteo');
    const params = new URLSearchParams({
      latitude: String(point[1]),
      longitude: String(point[0]),
      hourly: 'temperature_2m',
      forecast_days: String(
        Math.min(options.forecastDays ?? DEFAULT_FORECAST_DAYS, MAX_FORECAST_DAYS),
      ),
      timezone: 'UTC',
    });
    const url = `${config.baseUrl}?${params.toString()}`;

    const response = await this.http.getJson(
      {
        sourceId: config.id,
        displayName: config.displayName,
        url,
        queryDescription: `hourly temperature_2m at ${String(point[1])},${String(point[0])}`,
        minIntervalMs: config.minIntervalMs,
        cacheTtlSeconds: config.cacheTtlSeconds,
      },
      openMeteoSchema,
    );

    const hourly = response.data.hourly;
    if (hourly === undefined) return { ...response, data: [] };

    // Nulls are gaps in the forecast, not zero degrees. Dropping them is correct;
    // treating them as 0 °C would fabricate a cold-chain excursion.
    const series: HourlyTemperature[] = [];
    hourly.time.forEach((at, index) => {
      const celsius = hourly.temperature_2m[index];
      if (typeof celsius === 'number') series.push({ at, celsius });
    });

    return { ...response, data: series };
  }
}

// ---------------------------------------------------------------------------
// USGS
// ---------------------------------------------------------------------------

const usgsFeatureSchema = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    /** Epoch milliseconds. */
    time: z.number(),
    updated: z.number().nullable().optional(),
    url: z.string().optional(),
    title: z.string().optional(),
  }),
  geometry: z.object({
    /** GeoJSON: [longitude, latitude, depth_km]. */
    coordinates: z.array(z.number().nullable()),
  }),
});

const usgsResponseSchema = z.object({
  type: z.string(),
  features: z.array(usgsFeatureSchema),
});

export type SeismicEvent = {
  id: string;
  magnitude: number;
  place: string;
  occurredAt: string;
  point: Coordinates;
  detailUrl: string | null;
};

export type SeismicQuery = {
  /** Bounding circle around a manufacturing cluster. */
  centre: Coordinates;
  radiusKm: number;
  minMagnitude: number;
  /** ISO date. Defaults to the last 30 days at the call site. */
  startTime: string;
};

export class UsgsClient {
  constructor(private readonly http: CachedHttpClient) {}

  async recentEvents(query: SeismicQuery): Promise<Fetched<SeismicEvent[]>> {
    const config = sourceConfig('usgs_fdsnws');
    const params = new URLSearchParams({
      format: 'geojson',
      latitude: String(query.centre[1]),
      longitude: String(query.centre[0]),
      maxradiuskm: String(query.radiusKm),
      minmagnitude: String(query.minMagnitude),
      starttime: query.startTime,
      orderby: 'time',
    });
    const url = `${config.baseUrl}?${params.toString()}`;

    const response = await this.http.getJson(
      {
        sourceId: config.id,
        displayName: config.displayName,
        url,
        queryDescription: `M>=${String(query.minMagnitude)} within ${String(query.radiusKm)}km since ${query.startTime}`,
        minIntervalMs: config.minIntervalMs,
        cacheTtlSeconds: config.cacheTtlSeconds,
      },
      usgsResponseSchema,
    );

    const events: SeismicEvent[] = [];
    for (const feature of response.data.features) {
      const magnitude = feature.properties.mag;
      const longitude = feature.geometry.coordinates[0];
      const latitude = feature.geometry.coordinates[1];

      // A record without a magnitude or a location cannot contribute to a risk
      // term, so it is dropped rather than defaulted.
      if (magnitude === null || typeof longitude !== 'number' || typeof latitude !== 'number') {
        continue;
      }

      events.push({
        id: feature.id,
        magnitude,
        place: feature.properties.place ?? 'unknown',
        occurredAt: new Date(feature.properties.time).toISOString(),
        point: [longitude, latitude],
        detailUrl: feature.properties.url ?? null,
      });
    }

    return { ...response, data: events };
  }
}
