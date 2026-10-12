import type { FeatureCollection, LineString } from 'geojson';

/** Cartographic latitude/longitude guides, never routes or source observations. */
export function graticule(): FeatureCollection<LineString> {
  const parallels = [-60, -30, 0, 30, 60].map((latitude) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: Array.from({ length: 61 }, (_, index) => [-180 + index * 6, latitude]),
    },
  }));
  const meridians = Array.from({ length: 12 }, (_, index) => -180 + index * 30).map(
    (longitude) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: Array.from({ length: 31 }, (_, index) => [longitude, -90 + index * 6]),
      },
    }),
  );
  return { type: 'FeatureCollection', features: [...parallels, ...meridians] };
}
