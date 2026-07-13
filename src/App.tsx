import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import { AlertTriangle, Bell, Bot, ChevronRight, CloudRain, Download, ExternalLink, Flame, Layers, LocateFixed, MapPin, Menu, Pause, Play, Radio, Route, Search, ShieldCheck, Thermometer, Trash2, Upload, UserRound, Wind, X } from 'lucide-react';
import { SPAIN_CENTER } from './data';
import { assessRisk, fireAgeLabel, getActionGuidance, getAirQuality, getHourlyForecast, getWeather, isActionableFire, parseFireFeed, parseTrafficFeed, rankFiresByDistance, rankTrafficByDistance, searchSpanishLocations, trafficCauseLabel, trafficClosureLabel, windDirectionToCardinal } from './services';
import { parseRouteText, sampleRoute, type ReferenceRoute } from './routes';
import { buildWindIndicator, fetchRouteElevation, filterFiresByWindow, FIRE_TIME_WINDOWS, type ElevationProfile, type FireTimeWindow } from './geolibre-analysis';
import type { AirQuality, Coordinates, Fire, HourlyForecast, LocationResult, RiskAssessment, TrafficIncident, Weather } from './types';

const fallbackWeather: Weather = { available: false, temperature: 0, humidity: 0, windSpeed: 0, windDirection: 0, precipitation: 0, label: 'Cargando meteorología…' };
const emptyFeatureCollection = { type: 'FeatureCollection' as const, features: [] };
const trafficFeatureCollection = (incidents: TrafficIncident[]) => ({
  type: 'FeatureCollection' as const,
  features: incidents.map((incident) => ({
    type: 'Feature' as const,
    properties: { id: incident.id, road: incident.road, municipality: incident.municipality, province: incident.province, cause: incident.cause, kind: incident.kind, closure: incident.closure, fireRelated: incident.fireRelated, updatedAt: incident.updatedAt },
    geometry: incident.coordinates.length > 1
      ? { type: 'LineString' as const, coordinates: incident.coordinates }
      : { type: 'Point' as const, coordinates: incident.coordinates[0] },
  })),
});
const createRouteArrow = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 48; canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.beginPath(); context.moveTo(24, 4); context.lineTo(40, 40); context.lineTo(24, 33); context.lineTo(8, 40); context.closePath();
  context.fillStyle = '#2563eb'; context.fill(); context.lineWidth = 3; context.strokeStyle = '#ffffff'; context.stroke();
  return context.getImageData(0, 0, 48, 48);
};
const decodeVapidKey = (value: string) => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [location, setLocation] = useState<Coordinates>(SPAIN_CENTER);
  const [locationKind, setLocationKind] = useState<'general' | 'gps' | 'search'>('general');
  const [locationLabel, setLocationLabel] = useState('España');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [weather, setWeather] = useState<Weather>(fallbackWeather);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [registered, setRegistered] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem('meteo_local_alerts') === 'true');
  const [remoteRegistered, setRemoteRegistered] = useState(() => localStorage.getItem('meteo_remote_alerts') === 'true');
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState('');
  const [mobilePanel, setMobilePanel] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [clock, setClock] = useState(Date.now());
  const [fires, setFires] = useState<Fire[]>([]);
  const [fireMode, setFireMode] = useState<'loading' | 'live' | 'error'>('loading');
  const visibleFiresRef = useRef<Fire[]>([]);
  const trafficRef = useRef<TrafficIncident[]>([]);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [trafficMode, setTrafficMode] = useState<'loading' | 'live' | 'error'>('loading');
  const [trafficPublishedAt, setTrafficPublishedAt] = useState<Date | null>(null);
  const notifiedFireRef = useRef('');
  const [aiGuidance, setAiGuidance] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showRouteImport, setShowRouteImport] = useState(false);
  const [routeAcknowledged, setRouteAcknowledged] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [referenceRoute, setReferenceRoute] = useState<ReferenceRoute | null>(null);
  const [routeProgress, setRouteProgress] = useState(0);
  const [routePlaying, setRoutePlaying] = useState(false);
  const [routeSpeed, setRouteSpeed] = useState(60);
  const [routeFollow, setRouteFollow] = useState(false);
  const [routeTrail, setRouteTrail] = useState(true);
  const [showMapLayers, setShowMapLayers] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [satelliteEnabled, setSatelliteEnabled] = useState(false);
  const [windLayerEnabled, setWindLayerEnabled] = useState(true);
  const [dgtLayerEnabled, setDgtLayerEnabled] = useState(true);
  const [fireTimeWindow, setFireTimeWindow] = useState<FireTimeWindow>(24);
  const [routeElevation, setRouteElevation] = useState<ElevationProfile | null>(null);
  const [routeElevationLoading, setRouteElevationLoading] = useState(false);
  const [routeElevationError, setRouteElevationError] = useState('');

  const hasSelectedLocation = locationKind !== 'general';
  const hasPreciseLocation = locationKind === 'gps';
  const risk: RiskAssessment = useMemo(() => assessRisk(location, fires, weather), [location, weather, fires]);
  const nearestFires = useMemo(() => rankFiresByDistance(location, fires), [location, fires]);
  const nearestTraffic = useMemo(() => rankTrafficByDistance(location, trafficIncidents), [location, trafficIncidents]);
  const hasSituationContext = Boolean((risk.nearestFire && risk.distanceKm <= 50) || (nearestTraffic[0] && nearestTraffic[0].distanceKm <= 50));
  const trafficForPanel = useMemo(() => hasSelectedLocation
    ? nearestTraffic
    : [...nearestTraffic].sort((a, b) => Number(b.incident.fireRelated) - Number(a.incident.fireRelated) || Number(b.incident.closure === 'complete') - Number(a.incident.closure === 'complete') || Date.parse(b.incident.updatedAt) - Date.parse(a.incident.updatedAt)), [hasSelectedLocation, nearestTraffic]);
  const visibleFires = useMemo(() => filterFiresByWindow(fires, fireTimeWindow, clock), [fires, fireTimeWindow, clock]);
  const routeElevationPolyline = useMemo(() => {
    if (!routeElevation || routeElevation.elevations.length < 2) return '';
    const range = Math.max(1, routeElevation.maximum - routeElevation.minimum);
    return routeElevation.elevations.map((elevation, index) => `${(index / (routeElevation.elevations.length - 1) * 100).toFixed(2)},${(38 - ((elevation - routeElevation.minimum) / range) * 34).toFixed(2)}`).join(' ');
  }, [routeElevation]);
  const actionGuidance = useMemo(() => getActionGuidance(risk), [risk]);
  const feedAgeMinutes = Math.max(0, (clock - lastSync.getTime()) / 60000);
  const feedIsStale = fireMode === 'live' && feedAgeMinutes > 60;
  const feedStatusText = fireMode === 'loading' ? 'cargando…' : fireMode === 'error' && fires.length === 0 ? 'no disponible' : `feed hace ${feedAgeMinutes < 1 ? '<1' : Math.floor(feedAgeMinutes)} min${fireMode === 'error' ? ' · última copia' : feedIsStale ? ' · con retraso' : ''}`;
  const trafficAgeMinutes = trafficPublishedAt ? Math.max(0, (clock - trafficPublishedAt.getTime()) / 60_000) : Infinity;
  const trafficStatusText = trafficMode === 'loading' ? 'cargando…' : trafficMode === 'error' ? 'no disponible' : `hace ${trafficAgeMinutes < 1 ? '<1' : Math.floor(trafficAgeMinutes)} min${trafficAgeMinutes > 10 ? ' · con retraso' : ''}`;

  useEffect(() => {
    let active = true;
    const loadConditions = () => {
      getWeather(location).then((value) => { if (active) setWeather(value); });
      getHourlyForecast(location).then((value) => { if (active) setHourly(value); });
      getAirQuality(location).then((value) => { if (active) setAirQuality(value); });
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') loadConditions(); };
    loadConditions();
    const timer = window.setInterval(loadConditions, 10 * 60000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [location]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(() => searchSpanishLocations(searchQuery).then(setSearchResults).finally(() => setSearching(false)), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    const firesUrl = import.meta.env.VITE_FIRES_URL || 'https://aulafy.github.io/meteo/fires.json';
    const loadFires = () => fetch(firesUrl, { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('FIRMS no disponible');
        const data = parseFireFeed(await response.json());
        if (active) { setFires(data.fires); setFireMode('live'); setLastSync(new Date(data.generatedAt)); }
      }).catch(() => { if (active) setFireMode('error'); });
    const onVisibility = () => { if (document.visibilityState === 'visible') loadFires(); };
    loadFires();
    const timer = window.setInterval(loadFires, 15 * 60000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    let active = true;
    const trafficUrl = import.meta.env.VITE_DGT_URL || '/api/dgt-incidents';
    const loadTraffic = () => fetch(trafficUrl, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('DGT no disponible');
      const data = parseTrafficFeed(await response.json());
      if (active) { setTrafficIncidents(data.incidents); setTrafficPublishedAt(new Date(data.publishedAt)); setTrafficMode('live'); }
    }).catch(() => { if (active) setTrafficMode('error'); });
    const onVisibility = () => { if (document.visibilityState === 'visible') loadTraffic(); };
    loadTraffic();
    const timer = window.setInterval(loadTraffic, 5 * 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (!registered || !hasPreciseLocation || !risk.nearestFire || !['alto', 'extremo'].includes(risk.level) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notificationKey = `${risk.nearestFire.id}:${risk.level}`;
    if (notifiedFireRef.current === notificationKey) return;
    notifiedFireRef.current = notificationKey;
    new Notification(`METEO · Riesgo ${risk.level}`, { body: `Detección satelital a ${risk.distanceKm.toFixed(1)} km. Consulta 112 y Protección Civil.`, icon: './favicon.svg', tag: notificationKey });
  }, [registered, hasPreciseLocation, risk]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!routePlaying || !referenceRoute) return;
    let animationFrame = 0;
    let previousTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsedSeconds = Math.min(0.25, (currentTime - previousTime) / 1000);
      previousTime = currentTime;
      setRouteProgress((current) => {
        const next = current + (elapsedSeconds * routeSpeed) / referenceRoute.totalMeters;
        if (next >= 1) { setRoutePlaying(false); return 1; }
        return next;
      });
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [routePlaying, routeSpeed, referenceRoute]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: location,
      zoom: 10.3,
      maxPitch: 80,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
      map.addSource('meteo-terrain', { type: 'raster-dem', url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json', tileSize: 256 });
      map.addLayer({ id: 'meteo-hillshade', type: 'hillshade', source: 'meteo-terrain', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#503c28', 'hillshade-highlight-color': '#f3ead2', 'hillshade-accent-color': '#876f53' } }, firstSymbolLayer);
      map.addSource('meteo-satellite', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagen: Esri, Maxar, Earthstar Geographics y colaboradores' });
      map.addLayer({ id: 'meteo-satellite', type: 'raster', source: 'meteo-satellite', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.92, 'raster-saturation': -0.1, 'raster-contrast': 0.08 } }, firstSymbolLayer);
      map.addSource('reference-route', { type: 'geojson', data: emptyFeatureCollection });
      map.addSource('reference-route-trail', { type: 'geojson', data: emptyFeatureCollection });
      map.addSource('reference-route-marker', { type: 'geojson', data: emptyFeatureCollection });
      map.addLayer({ id: 'reference-route-line', type: 'line', source: 'reference-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.72, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'reference-route-trail-line', type: 'line', source: 'reference-route-trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e7b84d', 'line-width': 5, 'line-opacity': 0.95 } });
      map.addSource('fires', { type: 'geojson', cluster: true, clusterMaxZoom: 10, clusterRadius: 45, data: { type: 'FeatureCollection', features: visibleFiresRef.current.map((f) => ({ type: 'Feature', properties: f, geometry: { type: 'Point', coordinates: f.coordinates } })) } });
      map.addLayer({ id: 'fire-clusters', type: 'circle', source: 'fires', filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#f59a45', 10, '#ef5a31', 30, '#bd2f20'], 'circle-radius': ['step', ['get', 'point_count'], 17, 10, 23, 30, 29], 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } });
      map.addLayer({ id: 'fire-cluster-count', type: 'symbol', source: 'fires', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }, paint: { 'text-color': '#fff' } });
      map.addLayer({ id: 'fire-glow', type: 'circle', source: 'fires', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0, 22, 100, 44], 'circle-color': '#ff6a2a', 'circle-opacity': 0.14, 'circle-blur': 0.6 } });
      map.addLayer({ id: 'fire-points', type: 'circle', source: 'fires', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 8, 'circle-color': '#ff4d26', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff5ee' } });
      map.addSource('dgt-incidents', { type: 'geojson', data: trafficFeatureCollection(trafficRef.current) });
      map.addLayer({ id: 'dgt-incident-lines', type: 'line', source: 'dgt-incidents', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['case', ['==', ['get', 'closure'], 'complete'], '#8f1d1d', ['==', ['get', 'fireRelated'], true], '#e55225', ['==', ['get', 'closure'], 'carriageway'], '#c73d2b', '#d18a1f'], 'line-width': ['case', ['==', ['get', 'closure'], 'complete'], 7, 5], 'line-opacity': 0.92 } });
      map.addLayer({ id: 'dgt-incident-points', type: 'circle', source: 'dgt-incidents', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['case', ['==', ['get', 'closure'], 'complete'], 9, 7], 'circle-color': ['case', ['==', ['get', 'closure'], 'complete'], '#8f1d1d', ['==', ['get', 'fireRelated'], true], '#e55225', '#d18a1f'], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
      map.addSource('user', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: location } } });
      map.addLayer({ id: 'user-halo', type: 'circle', source: 'user', paint: { 'circle-radius': 18, 'circle-color': '#147355', 'circle-opacity': 0.16 } });
      map.addLayer({ id: 'user', type: 'circle', source: 'user', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#147355', 'circle-stroke-width': 4 } });
      map.addSource('wind-indicator', { type: 'geojson', data: emptyFeatureCollection });
      map.addLayer({ id: 'wind-indicator-line', type: 'line', source: 'wind-indicator', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#e7b84d', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'wind-indicator-tip', type: 'circle', source: 'wind-indicator', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#e7b84d', 'circle-stroke-width': 3, 'circle-stroke-color': '#263128' } });
      const arrow = createRouteArrow();
      if (arrow) map.addImage('meteo-route-arrow', arrow, { pixelRatio: 2 });
      map.addLayer({ id: 'reference-route-marker-symbol', type: 'symbol', source: 'reference-route-marker', layout: { 'icon-image': 'meteo-route-arrow', 'icon-size': 0.65, 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
      map.on('click', 'fire-points', (e) => {
        const p = e.features?.[0]?.properties;
        if (p) {
          const content = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = String(p.name);
          const details = document.createElement('span');
          details.textContent = `Anomalía térmica no confirmada\nConfianza ${p.confidence}% · FRP ${p.frp ? Number(p.frp).toFixed(1) : '—'} MW`;
          details.style.whiteSpace = 'pre-line';
          const observation = document.createElement('small');
          observation.textContent = `Observada ${new Date(p.detectedAt).toLocaleString('es-ES')} · ${p.source}`;
          content.append(title, document.createElement('br'), details, document.createElement('br'), observation);
          new maplibregl.Popup({ offset: 16 }).setLngLat(e.lngLat).setDOMContent(content).addTo(map);
        }
      });
      map.on('click', 'fire-clusters', (e) => map.easeTo({ center: e.lngLat, zoom: Math.min(14, map.getZoom() + 2) }));
      const showTrafficPopup = (e: maplibregl.MapLayerMouseEvent) => {
        const properties = e.features?.[0]?.properties;
        if (!properties) return;
        const content = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = `${trafficClosureLabel(String(properties.closure) as TrafficIncident['closure'])} · ${String(properties.road)}`;
        const detail = document.createElement('span'); detail.textContent = `${String(properties.municipality || properties.province || 'Ubicación DGT')}\nCausa: ${trafficCauseLabel(String(properties.cause))}${properties.fireRelated ? ' · relacionada con fuego/humo' : ''}`; detail.style.whiteSpace = 'pre-line';
        const updated = document.createElement('small'); updated.textContent = `DGT · actualizado ${new Date(String(properties.updatedAt)).toLocaleString('es-ES')}`;
        content.append(title, document.createElement('br'), detail, document.createElement('br'), updated);
        new maplibregl.Popup({ offset: 14 }).setLngLat(e.lngLat).setDOMContent(content).addTo(map);
      };
      map.on('click', 'dgt-incident-lines', showTrafficPopup);
      map.on('click', 'dgt-incident-points', showTrafficPopup);
      map.on('mouseenter', 'fire-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'fire-points', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'fire-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'fire-clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'dgt-incident-lines', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'dgt-incident-lines', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'dgt-incident-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'dgt-incident-points', () => { map.getCanvas().style.cursor = ''; });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    visibleFiresRef.current = visibleFires;
    const map = mapRef.current;
    if (!map) return;
    (map.getSource('fires') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: visibleFires.map((fire) => ({ type: 'Feature', properties: fire, geometry: { type: 'Point', coordinates: fire.coordinates } })) });
  }, [visibleFires]);

  useEffect(() => {
    trafficRef.current = trafficIncidents;
    const map = mapRef.current;
    if (!map) return;
    (map.getSource('dgt-incidents') as GeoJSONSource)?.setData(trafficFeatureCollection(trafficIncidents));
  }, [trafficIncidents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('dgt-incident-lines')) return;
    const visibility = dgtLayerEnabled ? 'visible' : 'none';
    map.setLayoutProperty('dgt-incident-lines', 'visibility', visibility);
    map.setLayoutProperty('dgt-incident-points', 'visibility', visibility);
  }, [dgtLayerEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource('user') as GeoJSONSource)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: location } });
  }, [location]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('wind-indicator') as GeoJSONSource | undefined;
    source?.setData(windLayerEnabled && hasSelectedLocation && weather.available ? buildWindIndicator(location, weather.windDirection) : emptyFeatureCollection);
  }, [location, weather, windLayerEnabled, hasSelectedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('meteo-satellite')) return;
    map.setLayoutProperty('meteo-satellite', 'visibility', satelliteEnabled ? 'visible' : 'none');
  }, [satelliteEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('meteo-hillshade') || !map.getSource('meteo-terrain')) return;
    map.setLayoutProperty('meteo-hillshade', 'visibility', terrainEnabled ? 'visible' : 'none');
    if (terrainEnabled) {
      map.setCenterClampedToGround(false);
      map.setTerrain({ source: 'meteo-terrain', exaggeration: 1 });
      map.easeTo({ pitch: 58, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700 });
    } else {
      map.setTerrain(null);
      map.setCenterClampedToGround(true);
      map.easeTo({ pitch: 0, bearing: 0, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 });
    }
  }, [terrainEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const routeSource = map.getSource('reference-route') as GeoJSONSource | undefined;
    const trailSource = map.getSource('reference-route-trail') as GeoJSONSource | undefined;
    const markerSource = map.getSource('reference-route-marker') as GeoJSONSource | undefined;
    if (!referenceRoute) {
      routeSource?.setData(emptyFeatureCollection);
      trailSource?.setData(emptyFeatureCollection);
      markerSource?.setData(emptyFeatureCollection);
      return;
    }
    const sample = sampleRoute(referenceRoute, routeProgress);
    routeSource?.setData(referenceRoute.geojson);
    trailSource?.setData(routeTrail ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: sample.trail } } : emptyFeatureCollection);
    markerSource?.setData({ type: 'Feature', properties: { bearing: sample.bearing }, geometry: { type: 'Point', coordinates: sample.coordinate } });
    if (routeFollow && routePlaying) map.easeTo({ center: sample.coordinate, bearing: sample.bearing, duration: 0 });
  }, [referenceRoute, routeProgress, routeTrail, routeFollow, routePlaying]);

  function locate() {
    if (!navigator.geolocation) { setToast('La geolocalización no está disponible'); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const next: Coordinates = [coords.longitude, coords.latitude];
      setLocationKind('gps'); setLocationLabel('Mi ubicación'); setLocation(next); setSearchQuery(''); setSearchResults([]); mapRef.current?.flyTo({ center: next, zoom: 12 });
      const remoteUpdated = await updateRemoteAlertLocation(next);
      setToast(remoteRegistered ? remoteUpdated ? 'Ubicación y avisos 24/7 actualizados' : 'Vista actualizada; no se pudo actualizar el canal 24/7' : 'Ubicación actualizada');
      window.setTimeout(() => setToast(''), 3500);
    }, () => { setToast('No se pudo obtener tu ubicación. Revisa el permiso del navegador.'); window.setTimeout(() => setToast(''), 4000); });
  }

  async function updateRemoteAlertLocation([longitude, latitude]: Coordinates) {
    if (!remoteRegistered || !('serviceWorker' in navigator)) return false;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return false;
      const apiBase = import.meta.env.VITE_PUSH_API_URL || '';
      const response = await fetch(`${apiBase}/api/subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON(), latitude, longitude, radiusKm: 25, consentVersion: '2026-07-13' }) });
      return response.ok;
    } catch { return false; }
  }

  async function activateLocalAlerts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typeof Notification === 'undefined') { setToast('Este navegador no admite notificaciones locales'); return; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setToast('Permiso de notificaciones no concedido'); return; }
    localStorage.setItem('meteo_local_alerts', 'true');
    setRegistered(true); setShowRegister(false);
    let remoteEnabled = false;
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push no compatible');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }));
      const preciseLocation: Coordinates = [position.coords.longitude, position.coords.latitude];
      setLocation(preciseLocation); setLocationKind('gps'); setLocationLabel('Mi ubicación');
      const apiBase = import.meta.env.VITE_PUSH_API_URL || '';
      const keyResponse = await fetch(`${apiBase}/api/push-public-key`);
      if (!keyResponse.ok) throw new Error('Backend no configurado');
      const { publicKey } = await keyResponse.json();
      const registration = await navigator.serviceWorker.register('./sw.js');
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicKey) });
      const response = await fetch(`${apiBase}/api/subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON(), latitude: position.coords.latitude, longitude: position.coords.longitude, radiusKm: 25, consentVersion: '2026-07-13' }) });
      if (!response.ok) throw new Error('No se pudo guardar la suscripción');
      remoteEnabled = true;
      localStorage.setItem('meteo_remote_alerts', 'true');
      localStorage.setItem('meteo_push_endpoint', subscription.endpoint);
      setRemoteRegistered(true);
    } catch {
      remoteEnabled = false;
      localStorage.removeItem('meteo_remote_alerts');
      setRemoteRegistered(false);
    }
    setToast(remoteEnabled ? 'Avisos remotos 24/7 activados en un radio de 25 km' : 'Avisos locales activos; el canal remoto aún no está configurado');
    window.setTimeout(() => setToast(''), 4000);
  }

  async function deactivateAlerts() {
    try {
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint || localStorage.getItem('meteo_push_endpoint');
      if (remoteRegistered && !endpoint) throw new Error('No se puede identificar la suscripción remota');
      if (endpoint) {
        const apiBase = import.meta.env.VITE_PUSH_API_URL || '';
        const response = await fetch(`${apiBase}/api/subscriptions`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) });
        if (!response.ok) throw new Error('No se pudo eliminar la suscripción remota');
        await subscription?.unsubscribe();
      }
      localStorage.removeItem('meteo_local_alerts');
      localStorage.removeItem('meteo_remote_alerts');
      localStorage.removeItem('meteo_push_endpoint');
      setRegistered(false); setRemoteRegistered(false); setShowRegister(false);
      setToast('Avisos desactivados y ubicación eliminada del servidor');
    } catch {
      setToast('No se pudieron desactivar los avisos. Revisa la conexión e inténtalo de nuevo.');
    }
    window.setTimeout(() => setToast(''), 4500);
  }

  function selectSearchedLocation(result: LocationResult) {
    setLocation(result.coordinates); setLocationKind('search'); setLocationLabel(`${result.name}${result.region ? `, ${result.region}` : ''}`);
    setSearchQuery(''); setSearchResults([]); mapRef.current?.flyTo({ center: result.coordinates, zoom: 11 });
    setToast(`Consultando ${result.name}. Las alertas 24/7 siguen vinculadas al GPS del dispositivo.`); window.setTimeout(() => setToast(''), 4500);
  }

  async function importReferenceRoute(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setRouteError('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite local de 5 MB');
      const parsed = parseRouteText(await file.text(), file.name);
      setReferenceRoute(parsed); setRouteProgress(0); setRoutePlaying(false); setRouteElevation(null); setRouteElevationError(''); setShowRouteImport(false); setRouteAcknowledged(false);
      mapRef.current?.fitBounds(parsed.bounds, { padding: 70, maxZoom: 15 });
      setToast(`${parsed.format} cargado localmente · ${parsed.lines.length} trazado${parsed.lines.length === 1 ? '' : 's'} · no verificado`);
      window.setTimeout(() => setToast(''), 4500);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'No se pudo leer la ruta');
    } finally { input.value = ''; }
  }

  function toggleRoutePlayback() {
    if (!referenceRoute) return;
    if (!routePlaying && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setToast('La reproducción está desactivada por la preferencia de movimiento reducido. Puedes usar el control de progreso.');
      window.setTimeout(() => setToast(''), 4500);
      return;
    }
    if (!routePlaying && routeProgress >= 1) setRouteProgress(0);
    setRoutePlaying((playing) => !playing);
  }

  function clearReferenceRoute() {
    setReferenceRoute(null); setRoutePlaying(false); setRouteProgress(0); setRouteFollow(false); setRouteElevation(null); setRouteElevationError('');
    setToast('Ruta local eliminada del mapa'); window.setTimeout(() => setToast(''), 3000);
  }

  async function calculateRouteElevation() {
    if (!referenceRoute || routeElevationLoading) return;
    setRouteElevationLoading(true); setRouteElevationError('');
    try {
      setRouteElevation(await fetchRouteElevation(referenceRoute));
    } catch (error) {
      setRouteElevationError(error instanceof Error ? error.message : 'No se pudo calcular el perfil');
    } finally { setRouteElevationLoading(false); }
  }

  function exportVisibleAnalysis() {
    const features = [
      ...visibleFires.map((fire) => ({ type: 'Feature' as const, properties: { ...fire, layer: 'NASA FIRMS', thermalDetection: true }, geometry: { type: 'Point' as const, coordinates: fire.coordinates } })),
      ...(dgtLayerEnabled ? trafficFeatureCollection(trafficIncidents).features.map((feature) => ({ ...feature, properties: { ...feature.properties, layer: 'DGT DATEX II v3.7' } })) : []),
      ...(referenceRoute?.geojson.features ?? []).map((feature) => ({ ...feature, properties: { ...feature.properties, layer: 'Ruta local no verificada' } })),
    ];
    const payload = {
      type: 'FeatureCollection',
      features,
      meteo: {
        exportedAt: new Date().toISOString(),
        fireWindowHours: fireTimeWindow,
        firesVisible: visibleFires.length,
        dgtIncidentsVisible: dgtLayerEnabled ? trafficIncidents.length : 0,
        includesPreciseUserLocation: false,
        warning: 'Las detecciones satelitales no confirman incendios y las rutas locales no están verificadas.',
      },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/geo+json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `meteo-analisis-${new Date().toISOString().slice(0, 10)}.geojson`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('GeoJSON generado localmente sin incluir tu ubicación precisa'); window.setTimeout(() => setToast(''), 3500);
  }

  async function explainRisk() {
    setShowAi(true); setAiLoading(true); setAiGuidance('');
    try {
      const response = await fetch('/api/ai-guidance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskLevel: risk.level, riskScore: risk.score,
          distanceKm: Number.isFinite(risk.distanceKm) ? Number(risk.distanceKm.toFixed(1)) : null,
          confidence: risk.nearestFire?.confidence ?? null, frp: risk.nearestFire?.frp != null ? Number(risk.nearestFire.frp.toFixed(1)) : null,
          weather: { available: weather.available, temperature: Number(weather.temperature.toFixed(1)), humidity: Number(weather.humidity.toFixed(0)), windSpeed: Number(weather.windSpeed.toFixed(0)), windDirection: Number(weather.windDirection.toFixed(0)) },
          reasons: risk.reasons,
          route: { state: referenceRoute ? 'local-reference' : 'none', verified: false },
          traffic: {
            available: trafficMode === 'live',
            publishedAt: trafficPublishedAt?.toISOString() ?? null,
            coverage: 'Red estatal excepto Cataluña y País Vasco',
            incidents: nearestTraffic.slice(0, 5).filter((item) => item.distanceKm <= 50).map(({ incident, distanceKm }) => ({ road: incident.road, status: trafficClosureLabel(incident.closure), cause: trafficCauseLabel(incident.cause), municipality: incident.municipality || incident.province, distanceKm: Number(distanceKm.toFixed(1)), updatedAt: incident.updatedAt })),
          },
        }),
      });
      const data = await response.json() as { guidance?: string; error?: string };
      if (!response.ok || !data.guidance) throw new Error(data.error || 'Asistente no disponible');
      setAiGuidance(data.guidance);
    } catch (error) {
      setAiGuidance(error instanceof Error ? error.message : 'Asistente no disponible');
    } finally { setAiLoading(false); }
  }

  const riskColor = risk.level === 'extremo' ? '#b92e20' : risk.level === 'alto' ? '#d95424' : risk.level === 'moderado' ? '#d89918' : '#147355';

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Flame size={20} fill="currentColor" /></div><div><b>METEO</b><span>Alertas y orientación segura</span></div></div>
      <div className="live"><span /> {feedIsStale ? 'FIRMS CON RETRASO' : fireMode === 'live' ? 'NASA FIRMS ACTUALIZADO' : fireMode === 'loading' ? 'CARGANDO DATOS' : 'FIRMS NO DISPONIBLE'}</div>
      <div className="top-actions"><button className="icon-button" aria-label="Configurar notificaciones" onClick={() => setShowRegister(true)}><Bell size={19}/>{registered && <i aria-hidden="true">✓</i>}</button><button className="account" onClick={() => setShowRegister(true)}><UserRound size={18}/><span>{registered ? 'Mis avisos' : 'Registrarme'}</span></button><button className="mobile-menu" aria-label="Abrir panel de información" aria-expanded={mobilePanel} onClick={() => setMobilePanel(!mobilePanel)}><Menu /></button></div>
    </header>

    <main>
      <aside className={`side-panel ${mobilePanel ? 'open' : ''}`}>
        <button className="panel-close" aria-label="Cerrar panel" onClick={() => setMobilePanel(false)}><X/></button>
        <section className="status-card" style={{'--risk': riskColor} as React.CSSProperties}>
          <div className="eyebrow"><Radio size={14}/> {locationKind === 'gps' ? 'RIESGO EN TU UBICACIÓN' : locationKind === 'search' ? `CONSULTA · ${locationLabel}` : 'VISTA GENERAL · ELIGE UNA UBICACIÓN'}</div>
          <div className="risk-heading"><div><strong>{hasSelectedLocation ? risk.level : 'sin ubicación'}</strong><span>{hasSelectedLocation ? `Índice ${risk.score}/100` : 'Riesgo pendiente'}</span></div><div className="risk-gauge"><span style={{ transform: `rotate(${hasSelectedLocation ? Math.min(180, risk.score * 1.8) : 0}deg)` }}/></div></div>
          <p>{!hasSelectedLocation ? 'Usa el GPS o busca un municipio para calcular proximidad.' : risk.level === 'alto' || risk.level === 'extremo' ? 'Detección cercana que requiere atención inmediata. No evacúes sin instrucciones oficiales.' : 'Mantente atento a las indicaciones oficiales y a cualquier cambio en las condiciones.'}</p>
          {hasSelectedLocation && <ul className="risk-reasons">{risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          {hasSelectedLocation && <div className={`decision-card urgency-${actionGuidance.urgency}`}><small>{locationKind === 'search' ? 'ORIENTACIÓN PARA ESTA ZONA' : 'QUÉ HACER AHORA'}</small><b>{actionGuidance.title}</b><p>{actionGuidance.message}</p><ol>{actionGuidance.steps.map(step=><li key={step}>{step}</li>)}</ol></div>}
          <div className="chips"><span><Wind size={14}/> {weather.available ? `${weather.windSpeed.toFixed(0)} km/h` : '—'}</span><span><CloudRain size={14}/> {weather.available ? `${weather.humidity.toFixed(0)}%` : '—'}</span><span><Thermometer size={14}/> {weather.available ? `${weather.temperature.toFixed(0)}°` : '—'}</span></div>
          {hasSelectedLocation && risk.nearestFire && <div className="satellite-note"><AlertTriangle size={15}/><span><b>Detección satelital, no incendio confirmado.</b> Confianza {risk.nearestFire.confidence}%{risk.nearestFire.frp != null ? ` · ${risk.nearestFire.frp.toFixed(1)} MW` : ''}.</span></div>}
          {hasSelectedLocation && <div className="evacuation-status"><Route/><div><small>RUTA DE EVACUACIÓN</small><b>{referenceRoute ? 'Ruta local visible · no verificada' : 'No hay una ruta oficial disponible'}</b><span>{referenceRoute ? 'No incorpora todos los cortes, perímetros ni órdenes oficiales.' : 'METEO no va a inventar una salida. Sigue ES‑Alert, 112 y a los agentes.'}</span></div></div>}
          <button className="ai-button" disabled={!hasSelectedLocation || !hasSituationContext} onClick={explainRisk}><Bot size={17}/> {!hasSelectedLocation ? 'Elige una ubicación para obtener contexto' : hasSituationContext ? 'Explicar incendio y carreteras con IA' : 'Sin incidencias cercanas para explicar'}</button>
          {(risk.level === 'alto' || risk.level === 'extremo') && <div className="what-now"><b>Qué hacer ahora</b><ol><li>Consulta 112 y Protección Civil.</li><li>Prepara medicación, documentación, agua y animales.</li><li>No conduzcas hacia humo o fuego ni improvises una ruta.</li></ol><div><a href="https://www.112.es/consejos/incendio-forestal.html" target="_blank" rel="noreferrer">Consejos 112 <ExternalLink size={12}/></a><a href="https://www.dgt.es/conoce-el-estado-del-trafico/informacion-e-incidencias-de-trafico/index.html" target="_blank" rel="noreferrer">Estado DGT <ExternalLink size={12}/></a></div></div>}
        </section>

        <section className="panel-section">
          <div className="section-title"><div><h2>Detecciones cercanas</h2><span>NASA FIRMS · {feedStatusText}</span></div><button onClick={() => mapRef.current?.fitBounds([[-9.6,35.7],[4.5,43.9]], {padding:50})}>Ver España</button></div>
          {fires.length === 0 && <p className="route-copy">{fireMode === 'error' ? 'FIRMS no está disponible. La ausencia de puntos no significa ausencia de fuego.' : 'Sin detecciones satelitales recientes en España.'}</p>}
          {nearestFires.slice(0,3).map(({ fire, distanceKm }, i) => <button className="fire-row" key={fire.id} onClick={() => mapRef.current?.flyTo({center:fire.coordinates,zoom:13})}>
            <span className={`fire-icon fire-${i}`}><Flame size={17} fill="currentColor"/></span><div><b>{fire.name}</b><small>{fire.source}{fire.frp != null ? ` · ${fire.frp.toFixed(1)} MW` : ''} · {fireAgeLabel(fire.detectedAt, clock)}{isActionableFire(fire, clock) ? '' : ' · solo contexto'}</small></div><strong>{hasSelectedLocation ? `${distanceKm.toFixed(1)} km` : 'Ver foco'}</strong><ChevronRight size={17}/>
          </button>)}
        </section>

        <section className="panel-section traffic-section">
          <div className="section-title"><div><h2>Carreteras afectadas</h2><span>DGT DATEX II · {trafficStatusText}</span></div><button onClick={() => setShowMapLayers(true)}>Ver capa</button></div>
          {trafficMode === 'error' && <p className="route-copy">La DGT no está disponible. METEO no puede confirmar qué carreteras están abiertas.</p>}
          {trafficMode === 'live' && trafficForPanel.length === 0 && <p className="route-copy">Sin cortes en la selección recibida. Esto no garantiza que todas las vías estén abiertas.</p>}
          {trafficForPanel.slice(0, 4).map(({ incident, distanceKm }) => <button className={`traffic-row closure-${incident.closure}`} key={incident.id} onClick={() => mapRef.current?.flyTo({ center: incident.coordinates[0], zoom: 13 })}><span className="traffic-road">{incident.road}</span><span><b>{trafficClosureLabel(incident.closure)}</b><small>{trafficCauseLabel(incident.cause)} · {incident.municipality || incident.province || 'Red DGT'} · act. {new Date(incident.updatedAt).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></span>{hasSelectedLocation && <strong>{distanceKm.toFixed(1)} km</strong>}</button>)}
          <p className="traffic-coverage">Red estatal excepto Cataluña y País Vasco. No incluye necesariamente calles, caminos forestales ni controles locales.</p>
        </section>

        <section className="panel-section resident-section">
          <div className="section-title"><div><h2>Información para residentes</h2><span>Según tu proximidad y las condiciones</span></div><ShieldCheck size={20}/></div>
          <div className="resident-grid"><div><small>Distancia</small><b>{hasSelectedLocation && Number.isFinite(risk.distanceKm) ? `${risk.distanceKm.toFixed(1)} km` : 'Elige ubicación'}</b></div><div><small>Aire (AQI UE)</small><b>{airQuality ? airQuality.europeanAqi.toFixed(0) : 'Sin datos'}</b></div><div><small>Partículas PM2.5</small><b>{airQuality ? `${airQuality.pm25.toFixed(0)} µg/m³` : 'Sin datos'}</b></div><div><small>Próxima revisión</small><b>≤ 15 min</b></div></div>
          <div className="resident-advice"><b>Prepárate antes de recibir una orden</b><ul><li>Móvil cargado, documentación, medicación, agua y llaves.</li><li>Localiza a menores, mayores, dependientes y animales.</li><li>Cierra ventanas si hay humo y evita ejercicio exterior.</li><li>No bloquees carreteras ni vayas a observar el incendio.</li></ul></div>
          <div className="official-links"><a href="tel:112">Llamar al 112</a><a href="https://www.aemet.es/es/eltiempo/prediccion/avisos" target="_blank" rel="noreferrer">Avisos AEMET</a><a href="https://www.dgt.es/conoce-el-estado-del-trafico/informacion-e-incidencias-de-trafico/" target="_blank" rel="noreferrer">Tráfico DGT</a><a href="https://www.proteccioncivil.es/" target="_blank" rel="noreferrer">Protección Civil</a></div>
          <div className="advisory"><ShieldCheck size={16}/><span>METEO no dibuja rutas reales sin perímetros, carreteras cortadas y refugios confirmados por las autoridades.</span></div>
        </section>

        <section className="panel-section">
          <div className="section-title"><div><h2>Próximas 12 horas</h2><span>Pronóstico Open‑Meteo · tecnología MeteoFlow</span></div><Wind size={20}/></div>
          {hourly.length ? <><div className="forecast-summary">{hourly.some(hour=>hour.danger==='alto') ? '⚠ Se prevén horas con viento/aire seco desfavorables.' : hourly.some(hour=>hour.danger==='moderado') ? 'Vigila cambios de viento y humedad durante las próximas horas.' : 'Sin empeoramiento meteorológico acusado en este horizonte.'}</div><div className="hourly-forecast">{hourly.filter((_, index) => index % 2 === 0).slice(0,6).map((hour) => <div className={`hourly-item danger-${hour.danger}`} key={hour.time}><small>{new Date(hour.time).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</small><b>{hour.temperature.toFixed(0)}°</b><span><Wind size={12}/>{hour.windSpeed.toFixed(0)} km/h</span><span>R {hour.windGusts.toFixed(0)} · H {hour.humidity.toFixed(0)}%</span></div>)}</div></> : <p className="route-copy">Pronóstico no disponible temporalmente.</p>}
        </section>

        <section className="sharing">
          <div><span className="share-icon"><MapPin size={18}/></span><div><b>{hasPreciseLocation ? 'GPS activo' : locationKind === 'search' ? `Consultando ${locationLabel}` : 'Ubicación necesaria'}</b><small>{hasPreciseLocation ? 'Distancias y alertas vinculadas al dispositivo' : locationKind === 'search' ? 'Esta consulta no cambia tus alertas 24/7' : 'Usa GPS o busca un municipio'}</small></div></div>
          <button className="location-inline" onClick={locate}>{hasPreciseLocation ? 'Actualizar' : 'Activar'}</button>
        </section>
      </aside>

      <section className="map-wrap">
        <div ref={mapContainer} className="map" />
        <div className="location-search"><div className="location-search-input"><Search size={17}/><input value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} placeholder="Buscar municipio en España" aria-label="Buscar municipio en España"/>{searchQuery && <button onClick={()=>{setSearchQuery('');setSearchResults([])}} aria-label="Limpiar búsqueda"><X size={15}/></button>}</div>{(searching || searchResults.length > 0 || searchQuery.length >= 2) && <div className="location-results">{searching ? <p>Buscando…</p> : searchResults.length ? searchResults.map(result=><button key={`${result.name}-${result.coordinates.join('-')}`} onClick={()=>selectSearchedLocation(result)}><MapPin size={14}/><span><b>{result.name}</b><small>{result.region}, {result.country}</small></span></button>) : <p>Sin resultados en España</p>}</div>}</div>
        {weather.available && <div className="wind-compass"><span style={{transform:`rotate(${weather.windDirection + 180}deg)`}}>↑</span><div><small>EL VIENTO SOPLA HACIA</small><b>{windDirectionToCardinal((weather.windDirection + 180) % 360)} · {weather.windSpeed.toFixed(0)} km/h</b></div></div>}
        <div className="map-tools"><button className={showMapLayers ? 'active' : ''} aria-expanded={showMapLayers} onClick={() => setShowMapLayers((visible) => !visible)} title="Capas y análisis GeoLibre" aria-label="Capas y análisis GeoLibre"><Layers/></button><button onClick={() => { setRouteError(''); setShowRouteImport(true); }} title="Cargar ruta local" aria-label="Cargar ruta local"><Route/></button><button onClick={locate} title="Usar mi ubicación" aria-label="Usar mi ubicación"><LocateFixed/></button><button onClick={() => mapRef.current?.zoomIn()} aria-label="Acercar mapa">+</button><button onClick={() => mapRef.current?.zoomOut()} aria-label="Alejar mapa">−</button></div>
        {showMapLayers && <section className="map-layer-panel" aria-label="Capas y análisis del mapa"><div className="map-layer-heading"><div><b>Capas y análisis</b><small>Patrones GeoLibre · MapLibre</small></div><button onClick={() => setShowMapLayers(false)} aria-label="Cerrar capas"><X/></button></div><label className="map-layer-switch"><span><b>Relieve 3D</b><small>Elevación JAXA · contexto topográfico</small></span><input type="checkbox" checked={terrainEnabled} onChange={(event) => setTerrainEnabled(event.target.checked)}/></label><label className="map-layer-switch"><span><b>Imagen satelital</b><small>Esri · imagen contextual, no en tiempo real</small></span><input type="checkbox" checked={satelliteEnabled} onChange={(event) => setSatelliteEnabled(event.target.checked)}/></label><label className="map-layer-switch"><span><b>Cortes y afecciones DGT</b><small>{trafficMode === 'live' ? `${trafficIncidents.length} incidencias oficiales normalizadas` : trafficMode === 'loading' ? 'Cargando DATEX II…' : 'DGT no disponible'}</small></span><input type="checkbox" checked={dgtLayerEnabled} onChange={(event) => setDgtLayerEnabled(event.target.checked)}/></label><label className="map-layer-switch"><span><b>Dirección del viento</b><small>{hasSelectedLocation ? 'Línea hacia sotavento · no predice el fuego' : 'Selecciona una ubicación para mostrarla'}</small></span><input type="checkbox" disabled={!hasSelectedLocation || !weather.available} checked={windLayerEnabled} onChange={(event) => setWindLayerEnabled(event.target.checked)}/></label><label className="fire-time-control"><span><b>Ventana de detecciones</b><small>Solo modifica lo que se ve en el mapa</small></span><select value={fireTimeWindow} onChange={(event) => setFireTimeWindow(Number(event.target.value) as FireTimeWindow)}>{FIRE_TIME_WINDOWS.map((hours) => <option key={hours} value={hours}>Últimas {hours} h</option>)}</select></label><div className="visible-layer-count"><Flame/> {visibleFires.length} de {fires.length} detecciones · {trafficIncidents.length} afecciones DGT</div><button className="map-export" onClick={exportVisibleAnalysis}><Download/> Exportar GeoJSON visible</button><p>El filtro temporal, el relieve y la imagen no cambian el riesgo. Los datos DGT informan de afecciones; no generan una ruta de evacuación.</p></section>}
        <div className="map-meta"><span><i className="fire-dot"/> FIRMS {visibleFires.length}/{fires.length} · {fireTimeWindow} h</span><span><i className="traffic-dot"/> DGT {trafficMode === 'live' ? trafficIncidents.length : '—'}</span><span><i className="safe-dot"/> {hasSelectedLocation ? locationLabel : 'Punto de consulta'}</span>{referenceRoute && <span><i className="route-line"/> Ruta local no verificada</span>}</div>
        {referenceRoute && <section className="route-animation" aria-label="Animación de ruta local">
          <div className="route-animation-title"><div><b>{referenceRoute.name}</b><small>{referenceRoute.format} · {(referenceRoute.totalMeters / 1000).toFixed(1)} km · solo referencia</small></div><button onClick={clearReferenceRoute} aria-label="Eliminar ruta local"><Trash2/></button></div>
          <div className="route-playback"><button className="route-play" onClick={toggleRoutePlayback} aria-label={routePlaying ? 'Pausar animación' : 'Reproducir animación'}>{routePlaying ? <Pause/> : <Play/>}</button><label><span>Progreso <b>{Math.round(routeProgress * 100)}%</b></span><input aria-label="Progreso de la ruta" type="range" min="0" max="1" step="0.001" value={routeProgress} onChange={(event) => { setRoutePlaying(false); setRouteProgress(Number(event.target.value)); }}/></label></div>
          <label className="route-speed"><span>Velocidad visual <b>{routeSpeed} m/s</b></span><input aria-label="Velocidad visual" type="range" min="10" max="500" step="10" value={routeSpeed} onChange={(event) => setRouteSpeed(Number(event.target.value))}/></label>
          <div className="route-toggles"><label><input type="checkbox" checked={routeFollow} onChange={(event) => setRouteFollow(event.target.checked)}/> Seguir marcador</label><label><input type="checkbox" checked={routeTrail} onChange={(event) => setRouteTrail(event.target.checked)}/> Mostrar rastro</label></div>
          {!routeElevation && <button className="route-elevation-action" disabled={routeElevationLoading} onClick={calculateRouteElevation}>{routeElevationLoading ? 'Calculando elevación…' : 'Calcular perfil de elevación'}</button>}
          {routeElevation && <div className="route-elevation"><svg viewBox="0 0 100 42" role="img" aria-label={`Perfil entre ${routeElevation.minimum.toFixed(0)} y ${routeElevation.maximum.toFixed(0)} metros`}><polyline points={routeElevationPolyline}/></svg><div><span>Mín. <b>{routeElevation.minimum.toFixed(0)} m</b></span><span>Máx. <b>{routeElevation.maximum.toFixed(0)} m</b></span><span>Ascenso <b>{routeElevation.ascent.toFixed(0)} m</b></span><span>Descenso <b>{routeElevation.descent.toFixed(0)} m</b></span></div></div>}
          {routeElevationError && <small className="route-elevation-error">{routeElevationError}</small>}
          <p>El archivo permanece local. El perfil, si lo solicitas, envía hasta 100 coordenadas a Open‑Meteo. No valida carreteras, cortes ni seguridad.</p>
        </section>}
        <div className="weather-strip"><div><Wind/><span><small>VIENTO</small><b>{weather.available ? `${weather.windSpeed.toFixed(0)} km/h · ${weather.windDirection.toFixed(0)}°` : '—'}</b></span></div><div><CloudRain/><span><small>HUMEDAD</small><b>{weather.available ? `${weather.humidity.toFixed(0)}%` : '—'}</b></span></div><div><Thermometer/><span><small>TEMPERATURA</small><b>{weather.available ? `${weather.temperature.toFixed(0)}°C` : '—'}</b></span></div><em>{weather.label}</em></div>
      </section>
    </main>

    {toast && <div className="toast"><ShieldCheck size={18}/>{toast}</div>}
    {showRegister && <div className="modal-backdrop" onClick={() => setShowRegister(false)}><form className="modal" onClick={(e)=>e.stopPropagation()} onSubmit={activateLocalAlerts}><button type="button" className="modal-x" onClick={()=>setShowRegister(false)}><X/></button><div className="modal-icon"><Bell/></div><h2>{registered ? 'Gestiona tus avisos' : 'Activa avisos de proximidad'}</h2><p>{remoteRegistered ? 'Los avisos remotos 24/7 están activos en este dispositivo.' : 'METEO registrará este dispositivo para comprobar cada 15 minutos si existe una detección de alta confianza en un radio de 25 km. Es un canal complementario y no sustituye ES‑Alert ni a las autoridades.'}</p>{!registered && <><label className="consent"><input required type="checkbox"/> Entiendo el alcance y acepto usar mi ubicación para calcular proximidad.</label><button className="primary" type="submit">Permitir notificaciones</button></>}{registered && <button className="primary" type="button" onClick={deactivateAlerts}>Desactivar y eliminar mi ubicación</button>}</form></div>}
    {showAi && <div className="modal-backdrop" onClick={() => setShowAi(false)}><section className="modal ai-modal" onClick={(e)=>e.stopPropagation()}><button type="button" className="modal-x" onClick={()=>setShowAi(false)}><X/></button><div className="modal-icon"><Bot/></div><h2>Explicación de seguridad</h2>{aiLoading ? <p>Analizando los datos visibles…</p> : <div className="ai-answer">{aiGuidance}</div>}<small>Groq · Apoyo informativo. No sustituye al 112, ES‑Alert ni a las autoridades.</small></section></div>}
    {showRouteImport && <div className="modal-backdrop" onClick={() => setShowRouteImport(false)}><section className="modal route-import-modal" onClick={(event)=>event.stopPropagation()}><button type="button" className="modal-x" onClick={()=>setShowRouteImport(false)}><X/></button><div className="modal-icon"><Route/></div><h2>Cargar ruta de referencia</h2><p>Importa un GPX, KML o GeoJSON desde tu dispositivo. El archivo se procesa localmente y no modifica el nivel de riesgo ni tus alertas.</p><label className="consent"><input type="checkbox" checked={routeAcknowledged} onChange={(event)=>setRouteAcknowledged(event.target.checked)}/> Entiendo que METEO no ha verificado esta ruta y que no debo usarla como orden de evacuación.</label><label className={`route-file ${routeAcknowledged ? '' : 'disabled'}`}><Upload/> <span>{referenceRoute ? 'Sustituir ruta local' : 'Seleccionar GPX, KML o GeoJSON'}</span><input aria-label="Seleccionar archivo de ruta" disabled={!routeAcknowledged} type="file" accept=".gpx,.kml,.geojson,.json,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml" onChange={importReferenceRoute}/></label>{routeError && <p className="route-error" role="alert">{routeError}</p>}<small>Máximo 5 MB y 20.000 puntos. Solo rutas dentro de España.</small></section></div>}
  </div>;
}
