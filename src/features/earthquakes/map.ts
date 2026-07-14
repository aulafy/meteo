import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import type { Earthquake } from './types';

export const earthquakeFeatureCollection = (earthquakes: Earthquake[]) => ({
  type: 'FeatureCollection' as const,
  features: earthquakes.map((earthquake) => ({
    type: 'Feature' as const,
    properties: earthquake,
    geometry: { type: 'Point' as const, coordinates: earthquake.coordinates },
  })),
});

export function addEarthquakeLayers(map: MapLibreMap, earthquakes: Earthquake[] = []) {
  map.addSource('earthquakes', { type: 'geojson', cluster: true, clusterMaxZoom: 11, clusterRadius: 48, data: earthquakeFeatureCollection(earthquakes) });
  map.addLayer({ id: 'earthquake-clusters', type: 'circle', source: 'earthquakes', filter: ['has', 'point_count'], layout: { visibility: 'none' }, paint: { 'circle-color': ['step', ['get', 'point_count'], '#6f77c9', 20, '#6d4f9c', 100, '#46336f'], 'circle-radius': ['step', ['get', 'point_count'], 17, 20, 23, 100, 30], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
  map.addLayer({ id: 'earthquake-cluster-count', type: 'symbol', source: 'earthquakes', filter: ['has', 'point_count'], layout: { visibility: 'none', 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }, paint: { 'text-color': '#ffffff' } });
  map.addLayer({ id: 'earthquake-points', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']], layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'magnitude'], 0, 4, 3, 7, 5, 11, 7, 16], 'circle-color': ['interpolate', ['linear'], ['get', 'magnitude'], 0, '#8da0d8', 3, '#7167b8', 5, '#8d467e', 7, '#b12d52'], 'circle-opacity': 0.86, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });

  map.on('click', 'earthquake-points', (event) => {
    const properties = event.features?.[0]?.properties;
    if (!properties) return;
    const content = document.createElement('div');
    content.className = 'earthquake-popup';
    const title = document.createElement('strong'); title.textContent = `Terremoto M${Number(properties.magnitude).toFixed(1)}`;
    const place = document.createElement('span'); place.textContent = String(properties.place);
    const detail = document.createElement('small'); detail.textContent = `Profundidad ${Number(properties.depthKm).toFixed(1)} km · ${new Date(String(properties.detectedAt)).toLocaleString('es-ES')}\nEstado USGS: ${String(properties.status)}`; detail.style.whiteSpace = 'pre-line';
    const link = document.createElement('a'); link.href = String(properties.url); link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'Ver evento oficial en USGS';
    content.append(title, document.createElement('br'), place, document.createElement('br'), detail, document.createElement('br'), link);
    new maplibregl.Popup({ offset: 15 }).setLngLat(event.lngLat).setDOMContent(content).addTo(map);
  });
  map.on('click', 'earthquake-clusters', async (event) => {
    const clusterId = Number(event.features?.[0]?.properties?.cluster_id);
    const source = map.getSource('earthquakes') as GeoJSONSource | undefined;
    if (!source || !Number.isFinite(clusterId)) return;
    try {
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: event.lngLat, zoom });
    } catch {
      // The feed may refresh while a cluster is being expanded; the next click uses the new cluster id.
    }
  });
  for (const layer of ['earthquake-points', 'earthquake-clusters']) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }
}

export function updateEarthquakeSource(map: MapLibreMap, earthquakes: Earthquake[]) {
  (map.getSource('earthquakes') as GeoJSONSource | undefined)?.setData(earthquakeFeatureCollection(earthquakes));
}

export function setEarthquakeLayerVisibility(map: MapLibreMap, visible: boolean) {
  if (!map.getLayer('earthquake-points')) return;
  const visibility = visible ? 'visible' : 'none';
  for (const layer of ['earthquake-clusters', 'earthquake-cluster-count', 'earthquake-points']) map.setLayoutProperty(layer, 'visibility', visibility);
}
