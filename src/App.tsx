import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import { Bell, ChevronRight, CloudRain, Flame, LocateFixed, MapPin, Menu, Navigation, Radio, Route, ShieldCheck, Thermometer, UserRound, Wind, X } from 'lucide-react';
import { DEMO_CENTER, demoFires, safePlaces } from './data';
import { assessRisk, chooseSafePlace, getRoute, getWeather } from './services';
import type { Coordinates, Fire, RiskAssessment, SafePlace, Weather } from './types';

const fallbackWeather: Weather = { temperature: 34, humidity: 24, windSpeed: 28, windDirection: 245, precipitation: 0, label: 'Cargando…' };
const emptyCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [location, setLocation] = useState<Coordinates>(DEMO_CENTER);
  const [weather, setWeather] = useState<Weather>(fallbackWeather);
  const [route, setRoute] = useState<Coordinates[]>([]);
  const [destination, setDestination] = useState<SafePlace | null>(null);
  const [sharing, setSharing] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState('');
  const [mobilePanel, setMobilePanel] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [fires, setFires] = useState<Fire[]>(demoFires);
  const [fireMode, setFireMode] = useState<'live' | 'demo'>('demo');
  const firesRef = useRef<Fire[]>(demoFires);

  const risk: RiskAssessment = useMemo(() => assessRisk(location, fires, weather), [location, weather, fires]);

  useEffect(() => { getWeather(location).then(setWeather); }, [location]);

  useEffect(() => {
    fetch('./fires.json', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('FIRMS no disponible');
      const data = await response.json() as { generatedAt: string; fires: Fire[] };
      setFires(data.fires); setFireMode('live'); setLastSync(new Date(data.generatedAt));
    }).catch(() => { setFires(demoFires); setFireMode('demo'); });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setLastSync(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: location,
      zoom: 10.3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      map.addSource('fires', { type: 'geojson', data: { type: 'FeatureCollection', features: firesRef.current.map((f) => ({ type: 'Feature', properties: f, geometry: { type: 'Point', coordinates: f.coordinates } })) } });
      map.addLayer({ id: 'fire-glow', type: 'circle', source: 'fires', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0, 22, 100, 44], 'circle-color': '#ff6a2a', 'circle-opacity': 0.14, 'circle-blur': 0.6 } });
      map.addLayer({ id: 'fire-points', type: 'circle', source: 'fires', paint: { 'circle-radius': 8, 'circle-color': '#ff4d26', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff5ee' } });
      map.addSource('safe-places', { type: 'geojson', data: { type: 'FeatureCollection', features: safePlaces.map((s) => ({ type: 'Feature', properties: s, geometry: { type: 'Point', coordinates: s.coordinates } })) } });
      map.addLayer({ id: 'safe-places', type: 'circle', source: 'safe-places', paint: { 'circle-radius': 7, 'circle-color': '#176b50', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
      map.addSource('route', { type: 'geojson', data: emptyCollection() });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#147355', 'line-width': 5, 'line-opacity': 0.95 } });
      map.addSource('user', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: location } } });
      map.addLayer({ id: 'user-halo', type: 'circle', source: 'user', paint: { 'circle-radius': 18, 'circle-color': '#147355', 'circle-opacity': 0.16 } });
      map.addLayer({ id: 'user', type: 'circle', source: 'user', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#147355', 'circle-stroke-width': 4 } });
      map.on('click', 'fire-points', (e) => {
        const p = e.features?.[0]?.properties;
        if (p) new maplibregl.Popup({ offset: 16 }).setLngLat(e.lngLat).setHTML(`<strong>${p.name}</strong><br/>Intensidad ${p.intensity}% · Confianza ${p.confidence}%<br/><small>Fuente ${p.source}</small>`).addTo(map);
      });
      map.on('mouseenter', 'fire-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'fire-points', () => { map.getCanvas().style.cursor = ''; });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    firesRef.current = fires;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource('fires') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: fires.map((fire) => ({ type: 'Feature', properties: fire, geometry: { type: 'Point', coordinates: fire.coordinates } })) });
  }, [fires]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource('user') as GeoJSONSource)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: location } });
  }, [location]);

  async function calculateRoute() {
    const safe = chooseSafePlace(location, fires, safePlaces);
    const coordinates = await getRoute(location, safe.coordinates);
    setDestination(safe); setRoute(coordinates);
    const map = mapRef.current;
    if (map?.getSource('route')) {
      (map.getSource('route') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
      const bounds = coordinates.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
      map.fitBounds(bounds, { padding: 90, maxZoom: 14 });
    }
    setToast('Ruta recalculada evitando las zonas de riesgo');
    window.setTimeout(() => setToast(''), 3500);
  }

  function locate() {
    if (!navigator.geolocation) { setToast('La geolocalización no está disponible'); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const next: Coordinates = [coords.longitude, coords.latitude];
      setLocation(next); mapRef.current?.flyTo({ center: next, zoom: 12 });
      setToast('Ubicación actualizada'); window.setTimeout(() => setToast(''), 2500);
    }, () => { setToast('Usamos la ubicación de demostración. Revisa el permiso del navegador.'); window.setTimeout(() => setToast(''), 4000); });
  }

  const riskColor = risk.level === 'extremo' ? '#b92e20' : risk.level === 'alto' ? '#d95424' : risk.level === 'moderado' ? '#d89918' : '#147355';

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Flame size={20} fill="currentColor" /></div><div><b>FUEGO SEGURO</b><span>Vigilancia y evacuación</span></div></div>
      <div className="live"><span /> {fireMode === 'live' ? 'NASA FIRMS EN VIVO' : 'MODO DEMO'}</div>
      <nav><button className="nav-link active">Mapa</button><button className="nav-link">Alertas</button><button className="nav-link">Preparación</button></nav>
      <div className="top-actions"><button className="icon-button" aria-label="Notificaciones"><Bell size={19}/><i>2</i></button><button className="account" onClick={() => setShowRegister(true)}><UserRound size={18}/><span>{registered ? 'Mi cuenta' : 'Registrarme'}</span></button><button className="mobile-menu" onClick={() => setMobilePanel(!mobilePanel)}><Menu /></button></div>
    </header>

    <main>
      <aside className={`side-panel ${mobilePanel ? 'open' : ''}`}>
        <button className="panel-close" onClick={() => setMobilePanel(false)}><X/></button>
        <section className="status-card" style={{'--risk': riskColor} as React.CSSProperties}>
          <div className="eyebrow"><Radio size={14}/> NIVEL DE RIESGO ACTUAL</div>
          <div className="risk-heading"><div><strong>{risk.level}</strong><span>Índice {risk.score}/100</span></div><div className="risk-gauge"><span style={{ transform: `rotate(${Math.min(180, risk.score * 1.8)}deg)` }}/></div></div>
          <p>Condiciones favorables para la propagación. Mantente atento a las indicaciones oficiales.</p>
          <div className="chips"><span><Wind size={14}/> {weather.windSpeed.toFixed(0)} km/h</span><span><CloudRain size={14}/> {weather.humidity.toFixed(0)}%</span><span><Thermometer size={14}/> {weather.temperature.toFixed(0)}°</span></div>
        </section>

        <section className="panel-section">
          <div className="section-title"><div><h2>Incendios cercanos</h2><span>{fireMode === 'live' ? 'NASA FIRMS' : 'MODO DEMO'} · {lastSync.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></div><button onClick={() => mapRef.current?.fitBounds([[-9.6,35.7],[4.5,43.9]], {padding:50})}>Ver España</button></div>
          {fires.length === 0 && <p className="route-copy">Sin detecciones satelitales recientes en España.</p>}
          {fires.slice(0,3).map((fire, i) => <button className="fire-row" key={fire.id} onClick={() => mapRef.current?.flyTo({center:fire.coordinates,zoom:13})}>
            <span className={`fire-icon fire-${i}`}><Flame size={17} fill="currentColor"/></span><div><b>{fire.name}</b><small>{fire.source} · {fire.intensity}% índice térmico</small></div><strong>{fire.frp != null ? `${fire.frp.toFixed(1)} MW` : `${risk.distanceKm.toFixed(1)} km`}</strong><ChevronRight size={17}/>
          </button>)}
        </section>

        <section className="panel-section route-section">
          <div className="section-title"><div><h2>Ruta de evacuación</h2><span>Calculada según riesgo y viento</span></div><Route size={20}/></div>
          {destination ? <div className="destination"><span><ShieldCheck/></span><div><small>DESTINO RECOMENDADO</small><b>{destination.name}</b><p>{destination.type} · {destination.capacity}</p></div></div> : <p className="route-copy">Busca el punto seguro que minimiza exposición a los focos activos.</p>}
          <button className="primary" onClick={calculateRoute}><Navigation size={18}/>{route.length ? 'Recalcular ruta segura' : 'Calcular ruta segura'}</button>
          <div className="advisory"><ShieldCheck size={16}/><span>La ruta evita las áreas de mayor riesgo detectado.</span></div>
        </section>

        <section className="sharing">
          <div><span className="share-icon"><MapPin size={18}/></span><div><b>Compartir mi ubicación</b><small>Para recibir alertas cercanas</small></div></div>
          <label className="switch"><input type="checkbox" checked={sharing} onChange={(e)=>setSharing(e.target.checked)}/><span/></label>
        </section>
      </aside>

      <section className="map-wrap">
        <div ref={mapContainer} className="map" />
        <div className="map-tools"><button onClick={locate} title="Usar mi ubicación"><LocateFixed/></button><button onClick={() => mapRef.current?.zoomIn()}>+</button><button onClick={() => mapRef.current?.zoomOut()}>−</button></div>
        <div className="map-meta"><span><i className="fire-dot"/> Incendio activo</span><span><i className="safe-dot"/> Punto seguro</span><span><i className="route-line"/> Ruta recomendada</span></div>
        <div className="weather-strip"><div><Wind/><span><small>VIENTO</small><b>{weather.windSpeed.toFixed(0)} km/h · {weather.windDirection.toFixed(0)}°</b></span></div><div><CloudRain/><span><small>HUMEDAD</small><b>{weather.humidity.toFixed(0)}%</b></span></div><div><Thermometer/><span><small>TEMPERATURA</small><b>{weather.temperature.toFixed(0)}°C</b></span></div><em>{weather.label}</em></div>
      </section>
    </main>

    {toast && <div className="toast"><ShieldCheck size={18}/>{toast}</div>}
    {showRegister && <div className="modal-backdrop" onClick={() => setShowRegister(false)}><form className="modal" onClick={(e)=>e.stopPropagation()} onSubmit={(e)=>{e.preventDefault();setRegistered(true);setShowRegister(false);setToast('Alertas activadas para este dispositivo');setTimeout(()=>setToast(''),3500)}}><button type="button" className="modal-x" onClick={()=>setShowRegister(false)}><X/></button><div className="modal-icon"><Bell/></div><h2>Activa las alertas cercanas</h2><p>Te avisaremos si un incendio entra en tu radio de seguridad. Tu ubicación solo se usa para calcular proximidad.</p><label>Nombre<input required placeholder="Tu nombre"/></label><label>Teléfono o correo<input required type="text" placeholder="Para recibir avisos"/></label><label className="consent"><input required type="checkbox"/> Acepto compartir mi ubicación mientras las alertas estén activas.</label><button className="primary" type="submit">Activar alertas</button></form></div>}
  </div>;
}
