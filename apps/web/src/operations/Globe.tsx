import type { Feature, Geometry } from 'geojson';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Incident } from '@vitalink/contracts';

import 'maplibre-gl/dist/maplibre-gl.css';
import { groupPlaces, hasMappedLocation } from './globe-data';
import { graticule } from './globe-graticule';

export type CameraCommand = { sequence: number; kind: 'overview' | 'fit' };
type CameraPosition = { center: [number, number]; zoom: number; bearing: number; pitch: number };
const overview = { center: [-98, 27] as [number, number], zoom: 1.75, bearing: 0, pitch: 0 };
const duration = (): number =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 950;

export function Globe({
  incidents,
  selected,
  locationsEnabled,
  command,
  onPlace,
  onNational,
}: {
  incidents: Incident[];
  selected: Incident | null;
  locationsEnabled: boolean;
  command: CameraCommand;
  onPlace: (ids: string[], label: string) => void;
  onNational: () => void;
}): React.ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const handlers = useRef({ onPlace, onNational });
  handlers.current = { onPlace, onNational };
  const places = useMemo(
    () => groupPlaces(locationsEnabled ? incidents : []),
    [incidents, locationsEnabled],
  );
  const currentPlaces = useRef(places);
  currentPlaces.current = places;
  const previousCamera = useRef<CameraPosition | null>(null);
  const previousSelection = useRef<string | null>(null);
  const sourceSignature = useRef('');
  const revision = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState({ longitude: -98, latitude: 27, zoom: overview.zoom });
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    const markers = new Map<string, { marker: maplibregl.Marker; button: HTMLButtonElement }>();
    let alive = true;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        ...overview,
        maxZoom: 6,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            graticule: { type: 'geojson', data: graticule() },
            countries: {
              type: 'geojson',
              data: '/maps/countries.geojson',
              attribution:
                'Made with <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
            },
          },
          layers: [
            { id: 'ocean', type: 'background', paint: { 'background-color': '#070f1b' } },
            {
              id: 'land',
              type: 'fill',
              source: 'countries',
              paint: { 'fill-color': '#1b2b3c', 'fill-opacity': 0.94 },
            },
            {
              id: 'borders',
              type: 'line',
              source: 'countries',
              paint: { 'line-color': '#476178', 'line-width': 0.65, 'line-opacity': 0.45 },
            },
            {
              id: 'us-coverage',
              type: 'fill',
              source: 'countries',
              filter: ['==', ['get', 'iso'], 'USA'],
              paint: { 'fill-color': '#49d9e8', 'fill-opacity': 0.08 },
            },
            {
              id: 'coordinate-grid',
              type: 'line',
              source: 'graticule',
              paint: { 'line-color': '#8badc4', 'line-width': 0.6, 'line-opacity': 0.14 },
            },
            {
              id: 'us-outline',
              type: 'line',
              source: 'countries',
              filter: ['==', ['get', 'iso'], 'USA'],
              paint: { 'line-color': '#49d9e8', 'line-width': 1, 'line-opacity': 0.4 },
            },
          ],
        },
      });
      map.current = instance;
      instance.on('load', () => {
        if (!alive) return;
        instance.setProjection({ type: 'globe' });
        const tooltip = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 24,
          className: 'op-globe-tooltip',
        });
        instance.setSky({
          'sky-color': '#060b12',
          'horizon-color': '#24576a',
          'fog-color': '#060b12',
          'sky-horizon-blend': 0.8,
          'horizon-fog-blend': 0.2,
          'fog-ground-blend': 0.1,
        });
        instance.addSource('places', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 4,
          clusterProperties: {
            records: ['+', ['get', 'records']],
            critical: ['+', ['get', 'critical']],
          },
        });
        instance.addLayer({
          id: 'place-targets',
          type: 'circle',
          source: 'places',
          paint: { 'circle-radius': 14, 'circle-opacity': 0 },
        });
        instance.addSource('selection', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        instance.addLayer({
          id: 'selected-ring',
          type: 'circle',
          source: 'selection',
          paint: {
            'circle-radius': 30,
            'circle-color': '#49d9e8',
            'circle-opacity': 0.05,
            'circle-stroke-color': '#49d9e8',
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 0.9,
          },
        });
        const renderContacts = (): void => {
          if (!alive || !instance.isSourceLoaded('places')) return;
          const seen = new Set<string>();
          for (const feature of instance.querySourceFeatures('places') as Feature<
            Geometry,
            Record<string, unknown>
          >[]) {
            if (feature.geometry.type !== 'Point') continue;
            const props = feature.properties;
            const isCluster = props.cluster === true;
            const key = isCluster ? `cluster:${String(props.cluster_id)}` : String(props.id);
            if (seen.has(key)) continue;
            seen.add(key);
            const coordinates = feature.geometry.coordinates as [number, number];
            let contact = markers.get(key);
            if (!contact) {
              const button = document.createElement('button');
              button.type = 'button';
              button.addEventListener('click', (event) => {
                event.stopPropagation();
                tooltip.remove();
                const generation = revision.current;
                void (async () => {
                  const source = instance.getSource<GeoJSONSource>('places');
                  if (!source) return;
                  const ids = isCluster
                    ? (
                        (await source.getClusterLeaves(
                          Number(props.cluster_id),
                          5000,
                          0,
                        )) as Feature<Geometry, Record<string, unknown>>[]
                      ).map((leaf) => String(leaf.properties.id))
                    : [String(props.id)];
                  if (!alive || generation !== revision.current) return;
                  const matches = currentPlaces.current.filter((place) => ids.includes(place.id));
                  if (!matches.length) return;
                  handlers.current.onPlace(
                    matches.flatMap((place) => place.incidentIds),
                    matches.length === 1
                      ? matches[0]!.label
                      : `${String(matches.length)} recalling-firm cities`,
                  );
                  instance.flyTo({
                    center: coordinates,
                    zoom: Math.min(Math.max(instance.getZoom() + 0.9, 3), 4.7),
                    duration: duration(),
                    offset: window.innerWidth > 760 ? [150, 0] : [0, -100],
                  });
                })().catch(() => {
                  if (alive) {
                    setError(
                      'The map selection changed. Select the marker again or use Mapped records.',
                    );
                  }
                });
              });
              const marker = new maplibregl.Marker({ element: button })
                .setLngLat(coordinates)
                .addTo(instance)
                .setSubpixelPositioning(true)
                .setOpacity(1, 0);
              const preview = (): void => {
                tooltip.setLngLat(marker.getLngLat()).setText(button.title).addTo(instance);
              };
              button.addEventListener('mouseenter', preview);
              button.addEventListener('focus', preview);
              button.addEventListener('mouseleave', () => {
                tooltip.remove();
              });
              button.addEventListener('blur', () => {
                tooltip.remove();
              });
              contact = { marker, button };
              markers.set(key, contact);
            }
            contact.marker.setLngLat(coordinates);
            const label = isCluster
              ? `${String(props.point_count)} firm cities`
              : String(props.label);
            contact.button.classList.add('op-contact');
            contact.button.classList.toggle('critical', Number(props.critical) > 0);
            contact.button.classList.toggle('cluster', isCluster);
            contact.button.textContent = String(props.records);
            contact.button.setAttribute(
              'aria-label',
              `${label}: ${String(props.records)} recall records. Inspect city-level evidence`,
            );
            contact.button.title = `${label} · ${String(props.records)} recall records`;
          }
          for (const [key, contact] of markers) {
            if (!seen.has(key)) {
              contact.marker.remove();
              markers.delete(key);
            }
          }
        };
        instance.on('render', renderContacts);
        instance.on('click', 'us-coverage', () => {
          handlers.current.onNational();
        });
        instance.on('moveend', () => {
          const center = instance.getCenter();
          setView({ longitude: center.lng, latitude: center.lat, zoom: instance.getZoom() });
        });
        setReady(true);
      });
      instance.on('error', () => {
        if (alive) {
          setError('Some map data could not load. Open Records to inspect the FDA evidence.');
        }
      });
    } catch {
      setError('The globe needs WebGL. Open Records to inspect all FDA evidence.');
    }
    return () => {
      alive = false;
      markers.forEach(({ marker }) => {
        marker.remove();
      });
      map.current?.remove();
      map.current = null;
      sourceSignature.current = '';
      previousSelection.current = null;
      previousCamera.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const data = {
      type: 'FeatureCollection' as const,
      features: places.map((place) => ({
        type: 'Feature' as const,
        properties: {
          id: place.id,
          label: place.label,
          records: place.incidentIds.length,
          critical: place.criticalCount,
        },
        geometry: { type: 'Point' as const, coordinates: place.coordinates },
      })),
    };
    const signature = JSON.stringify(data);
    if (signature === sourceSignature.current) return;
    sourceSignature.current = signature;
    revision.current += 1;
    map.current?.getSource<GeoJSONSource>('places')?.setData(data);
  }, [places, ready]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const coordinates =
      selected && hasMappedLocation(selected) ? selected.location?.coordinates : null;
    instance.getSource<GeoJSONSource>('selection')?.setData({
      type: 'FeatureCollection',
      features: coordinates
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates } }]
        : [],
    });
    instance.setPaintProperty(
      'us-coverage',
      'fill-opacity',
      selected?.kind === 'SHORTAGE' ? 0.15 : 0.08,
    );
    if (selected?.id === previousSelection.current) return;
    if (selected && !previousSelection.current) {
      const center = instance.getCenter();
      previousCamera.current = {
        center: [center.lng, center.lat],
        zoom: instance.getZoom(),
        bearing: instance.getBearing(),
        pitch: instance.getPitch(),
      };
    }
    previousSelection.current = selected?.id ?? null;
    if (selected) {
      instance.flyTo({
        ...(coordinates
          ? { center: coordinates, zoom: Math.max(instance.getZoom(), 3.5) }
          : overview),
        duration: duration(),
        offset: window.innerWidth > 760 ? [-220, 0] : [0, 0],
      });
    } else if (previousCamera.current) {
      instance.flyTo({ ...previousCamera.current, duration: duration() });
      previousCamera.current = null;
    }
  }, [selected, ready]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || command.sequence === 0) return;
    previousCamera.current = null;
    if (command.kind === 'fit' && currentPlaces.current.length) {
      const bounds = new maplibregl.LngLatBounds();
      currentPlaces.current.forEach((place) => {
        bounds.extend(place.coordinates);
      });
      instance.fitBounds(bounds, {
        padding: window.innerWidth > 760 ? { top: 120, bottom: 130, left: 280, right: 110 } : 70,
        maxZoom: 4.5,
        duration: duration(),
      });
    } else {
      instance.flyTo({ ...overview, duration: duration() });
    }
  }, [command, ready]);
  return (
    <div className="op-map-wrap">
      <div
        ref={container}
        className="op-map"
        aria-label="Interactive globe of FDA recalling-firm city records"
      />
      {error && (
        <p className="op-map-error" role="status">
          {error}
        </p>
      )}
      <div className="op-camera-readout" aria-label="Map camera position">
        <span>View center</span>
        <b>
          {Math.abs(view.latitude).toFixed(2)}° {view.latitude < 0 ? 'S' : 'N'} /{' '}
          {Math.abs(view.longitude).toFixed(2)}° {view.longitude < 0 ? 'W' : 'E'}
        </b>
        <span>Zoom {view.zoom.toFixed(1)}</span>
      </div>
    </div>
  );
}
