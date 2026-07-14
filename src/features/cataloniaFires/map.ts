import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import { cataloniaFireKindLabel, cataloniaFirePhaseLabel, cataloniaFireResourcesLabel } from './selectors';
import type { CataloniaFireIncident } from './types';

const SOURCE_ID = 'catalonia-fire-incidents';
const LAYER_IDS = ['catalonia-fire-halo', 'catalonia-fire-points'] as const;

export const cataloniaFireFeatureCollection = (incidents: CataloniaFireIncident[]) => ({
  type: 'FeatureCollection' as const,
  features: incidents.map((incident) => ({
    type: 'Feature' as const,
    properties: incident,
    geometry: { type: 'Point' as const, coordinates: incident.coordinates },
  })),
});

export function addCataloniaFireLayers(map: MapLibreMap, incidents: CataloniaFireIncident[]) {
  if (map.getSource(SOURCE_ID)) return;
  map.addSource(SOURCE_ID, { type: 'geojson', data: cataloniaFireFeatureCollection(incidents) });
  map.addLayer({
    id: 'catalonia-fire-halo',
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'resources'], 0, 13, 30, 30],
      'circle-color': ['match', ['get', 'phase'], 'active', '#9f2525', 'stabilized', '#df7126', 'controlled', '#d8a51e', '#53677a'],
      'circle-opacity': 0.18,
      'circle-blur': 0.45,
    },
  });
  map.addLayer({
    id: 'catalonia-fire-points',
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'resources'], 0, 6, 30, 13],
      'circle-color': ['match', ['get', 'phase'], 'active', '#9f2525', 'stabilized', '#df7126', 'controlled', '#d8a51e', '#53677a'],
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.on('click', 'catalonia-fire-points', (event) => {
    const properties = event.features?.[0]?.properties;
    if (!properties) return;
    const content = document.createElement('div');
    content.className = 'catalonia-fire-popup';
    const title = document.createElement('strong');
    title.textContent = String(properties.municipality);
    const detail = document.createElement('span');
    const resources = Number(properties.resources) || 0;
    detail.textContent = `${cataloniaFireKindLabel(String(properties.kind))}\n${cataloniaFirePhaseLabel(String(properties.phase) as CataloniaFireIncident['phase'])} · ${cataloniaFireResourcesLabel(resources)} publicadas`;
    detail.style.whiteSpace = 'pre-line';
    const updated = document.createElement('small');
    updated.textContent = `Actualizado ${new Date(String(properties.updatedAt)).toLocaleString('es-ES')} · Bombers Generalitat`;
    const link = document.createElement('a');
    link.href = String(properties.officialUrl);
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Abrir visor oficial';
    content.append(title, document.createElement('br'), detail, document.createElement('br'), updated, document.createElement('br'), link);
    new maplibregl.Popup({ offset: 16 }).setLngLat(event.lngLat).setDOMContent(content).addTo(map);
  });
  map.on('mouseenter', 'catalonia-fire-points', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'catalonia-fire-points', () => { map.getCanvas().style.cursor = ''; });
}

export function updateCataloniaFireSource(map: MapLibreMap, incidents: CataloniaFireIncident[]) {
  (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(cataloniaFireFeatureCollection(incidents));
}

export function setCataloniaFireLayerVisibility(map: MapLibreMap, visible: boolean) {
  for (const layerId of LAYER_IDS) if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}
