import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import type { Incident } from '@vitalink/contracts';
import 'maplibre-gl/dist/maplibre-gl.css';

export function Globe({
  incidents,
  selected,
  onSelect,
}: {
  incidents: Incident[];
  selected: Incident | null;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        center: [-92, 30],
        zoom: 1.8,
        maxZoom: 12,
        style: {
          version: 8,
          sources: {
            earth: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'earth',
              type: 'raster',
              source: 'earth',
              paint: {
                'raster-saturation': -1,
                'raster-brightness-max': 0.3,
                'raster-contrast': 0.1,
              },
            },
          ],
        },
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
      instance.on('load', () => {
        instance.setProjection({ type: 'globe' });
        instance.setSky({
          'sky-color': '#080e19',
          'horizon-color': '#164052',
          'fog-color': '#0a1421',
          'sky-horizon-blend': 0.7,
          'horizon-fog-blend': 0.5,
          'fog-ground-blend': 0.3,
        });
        instance.addSource('incidents', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        instance.addLayer({
          id: 'halo',
          type: 'circle',
          source: 'incidents',
          paint: { 'circle-radius': 17, 'circle-color': '#ff5c6e', 'circle-opacity': 0.12 },
        });
        instance.addLayer({
          id: 'events',
          type: 'circle',
          source: 'incidents',
          paint: {
            'circle-radius': 5,
            'circle-color': ['case', ['==', ['get', 'critical'], true], '#ff5c6e', '#f4b860'],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffe4da',
          },
        });
        instance.on('click', 'events', (event) => {
          const id: unknown = event.features?.[0]?.properties?.id;
          if (typeof id === 'string') select.current(id);
        });
        instance.on('mouseenter', 'events', () => {
          instance.getCanvas().style.cursor = 'pointer';
        });
        instance.on('mouseleave', 'events', () => {
          instance.getCanvas().style.cursor = '';
        });
        setReady(true);
      });
      instance.on('error', () => {
        setError(
          'Some map tiles could not load. All source records remain available in the event list.',
        );
      });
    } catch {
      setError('The map needs WebGL. All source records remain available in the event list.');
    }
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const source = map.current?.getSource<GeoJSONSource>('incidents');
    source?.setData({
      type: 'FeatureCollection',
      features: incidents.flatMap((incident) =>
        incident.location?.coordinates
          ? [
              {
                type: 'Feature' as const,
                properties: { id: incident.id, critical: incident.classification === 'Class I' },
                geometry: { type: 'Point' as const, coordinates: incident.location.coordinates },
              },
            ]
          : [],
      ),
    });
  }, [incidents, ready]);
  useEffect(() => {
    if (ready && selected?.location?.coordinates) {
      map.current?.flyTo({
        center: selected.location.coordinates,
        zoom: 3.3,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200,
      });
    }
  }, [selected, ready]);
  return (
    <div className="op-map-wrap">
      <div
        ref={container}
        className="op-map"
        aria-label="Regulatory events at recalling-firm city locations"
      />
      {error && <p className="op-map-error">{error}</p>}
      <div className="op-map-caption">
        <span className="op-dot" /> RECALLING-FIRM CITIES <span>•</span> Geographic context; not
        factories or shipment routes
      </div>
    </div>
  );
}
