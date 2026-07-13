import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import { AlertTriangle, Bell, Bot, ChevronRight, CloudRain, ExternalLink, Flame, LocateFixed, MapPin, Menu, Navigation, Radio, Route, ShieldCheck, TestTube2, Thermometer, UserRound, Wind, X } from 'lucide-react';
import { DEMO_CENTER, demoFires, safePlaces } from './data';
import { assessRisk, chooseSafePlace, getDownwindLocation, getRoute, getWeather, rankFiresByDistance } from './services';
import type { Coordinates, Fire, RiskAssessment, SafePlace, Weather } from './types';

const fallbackWeather: Weather = { temperature: 34, humidity: 24, windSpeed: 28, windDirection: 245, precipitation: 0, label: 'Cargando…' };
const emptyCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });
const decodeVapidKey = (value: string) => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [location, setLocation] = useState<Coordinates>(DEMO_CENTER);
  const [weather, setWeather] = useState<Weather>(fallbackWeather);
  const [route, setRoute] = useState<Coordinates[]>([]);
  const [destination, setDestination] = useState<SafePlace | null>(null);
  const [sharing, setSharing] = useState(true);
  const [registered, setRegistered] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem('meteo_local_alerts') === 'true');
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState('');
  const [mobilePanel, setMobilePanel] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [fires, setFires] = useState<Fire[]>(demoFires);
  const [fireMode, setFireMode] = useState<'live' | 'demo'>('demo');
  const firesRef = useRef<Fire[]>(demoFires);
  const notifiedFireRef = useRef('');
  const [simulatedScenario, setSimulatedScenario] = useState(false);
  const [aiGuidance, setAiGuidance] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const risk: RiskAssessment = useMemo(() => assessRisk(location, fires, weather), [location, weather, fires]);
  const nearestFires = useMemo(() => rankFiresByDistance(location, fires), [location, fires]);

  useEffect(() => { getWeather(location).then(setWeather); }, [location]);

  useEffect(() => {
    const firesUrl = import.meta.env.VITE_FIRES_URL || 'https://aulafy.github.io/meteo/fires.json';
    fetch(firesUrl, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('FIRMS no disponible');
      const data = await response.json() as { generatedAt: string; fires: Fire[] };
      setFires(data.fires); setFireMode('live'); setLastSync(new Date(data.generatedAt));
    }).catch(() => { setFires(demoFires); setFireMode('demo'); });
  }, []);

  useEffect(() => {
    if (!registered || simulatedScenario || !risk.nearestFire || !['alto', 'extremo'].includes(risk.level) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notificationKey = `${risk.nearestFire.id}:${risk.level}`;
    if (notifiedFireRef.current === notificationKey) return;
    notifiedFireRef.current = notificationKey;
    new Notification(`METEO · Riesgo ${risk.level}`, { body: `Detección satelital a ${risk.distanceKm.toFixed(1)} km. Consulta 112 y Protección Civil.`, icon: './favicon.svg', tag: notificationKey });
  }, [registered, simulatedScenario, risk]);

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
    if (fireMode === 'live') {
      setToast('Ruta bloqueada: faltan perímetros, cortes y refugios oficiales');
      window.setTimeout(() => setToast(''), 4500);
      return;
    }
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
      setSimulatedScenario(false); setLocation(next); mapRef.current?.flyTo({ center: next, zoom: 12 });
      setToast('Ubicación actualizada'); window.setTimeout(() => setToast(''), 2500);
    }, () => { setToast('Usamos la ubicación de demostración. Revisa el permiso del navegador.'); window.setTimeout(() => setToast(''), 4000); });
  }

  async function simulateFiveKmScenario() {
    const fire = [...fires].filter((item) => item.confidence >= 70).sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0))[0];
    if (!fire) { setToast('No hay una detección adecuada para el ensayo'); return; }
    const fireWeather = await getWeather(fire.coordinates);
    const resident = getDownwindLocation(fire.coordinates, fireWeather.windDirection, 5);
    setSimulatedScenario(true); setWeather(fireWeather); setLocation(resident);
    mapRef.current?.flyTo({ center: resident, zoom: 11.5 });
    setToast('Ensayo activo: residente simulado a 5 km y a sotavento');
    window.setTimeout(() => setToast(''), 4500);
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
    } catch {
      remoteEnabled = false;
    }
    setToast(remoteEnabled ? 'Avisos remotos 24/7 activados en un radio de 25 km' : 'Avisos locales activos; el canal remoto aún no está configurado');
    window.setTimeout(() => setToast(''), 4000);
  }

  async function explainRisk() {
    setShowAi(true); setAiLoading(true); setAiGuidance('');
    try {
      const response = await fetch('/api/ai-guidance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskLevel: risk.level, riskScore: risk.score,
          distanceKm: Number.isFinite(risk.distanceKm) ? risk.distanceKm : null,
          confidence: risk.nearestFire?.confidence ?? null, frp: risk.nearestFire?.frp ?? null,
          weather: { temperature: weather.temperature, humidity: weather.humidity, windSpeed: weather.windSpeed, windDirection: weather.windDirection },
          reasons: risk.reasons,
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
      <div className="brand"><div className="brand-mark"><Flame size={20} fill="currentColor" /></div><div><b>METEO</b><span>Alertas y rutas seguras</span></div></div>
      <div className="live"><span /> {fireMode === 'live' ? 'NASA FIRMS EN VIVO' : 'MODO DEMO'}</div>
      <nav><button className="nav-link active">Mapa</button><button className="nav-link">Alertas</button><button className="nav-link">Preparación</button></nav>
      <div className="top-actions"><button className="icon-button" aria-label="Notificaciones"><Bell size={19}/><i>2</i></button><button className="account" onClick={() => setShowRegister(true)}><UserRound size={18}/><span>{registered ? 'Mi cuenta' : 'Registrarme'}</span></button><button className="mobile-menu" onClick={() => setMobilePanel(!mobilePanel)}><Menu /></button></div>
    </header>

    <main>
      <aside className={`side-panel ${mobilePanel ? 'open' : ''}`}>
        <button className="panel-close" onClick={() => setMobilePanel(false)}><X/></button>
        <section className="status-card" style={{'--risk': riskColor} as React.CSSProperties}>
          <div className="eyebrow"><Radio size={14}/> {simulatedScenario ? 'ENSAYO DE SEGURIDAD · NO ES TU UBICACIÓN' : 'NIVEL DE RIESGO ACTUAL'}</div>
          <div className="risk-heading"><div><strong>{risk.level}</strong><span>Índice {risk.score}/100</span></div><div className="risk-gauge"><span style={{ transform: `rotate(${Math.min(180, risk.score * 1.8)}deg)` }}/></div></div>
          <p>{risk.level === 'alto' || risk.level === 'extremo' ? 'Detección cercana que requiere atención inmediata. No evacúes sin instrucciones oficiales.' : 'Mantente atento a las indicaciones oficiales y a cualquier cambio en las condiciones.'}</p>
          <ul className="risk-reasons">{risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <div className="chips"><span><Wind size={14}/> {weather.windSpeed.toFixed(0)} km/h</span><span><CloudRain size={14}/> {weather.humidity.toFixed(0)}%</span><span><Thermometer size={14}/> {weather.temperature.toFixed(0)}°</span></div>
          {risk.nearestFire && <div className="satellite-note"><AlertTriangle size={15}/><span><b>Detección satelital, no incendio confirmado.</b> Confianza {risk.nearestFire.confidence}%{risk.nearestFire.frp != null ? ` · ${risk.nearestFire.frp.toFixed(1)} MW` : ''}.</span></div>}
          <button className="ai-button" onClick={explainRisk}><Bot size={17}/> Explicar esta situación con IA</button>
          {(risk.level === 'alto' || risk.level === 'extremo') && <div className="what-now"><b>Qué hacer ahora</b><ol><li>Consulta 112 y Protección Civil.</li><li>Prepara medicación, documentación, agua y animales.</li><li>No conduzcas hacia humo o fuego ni improvises una ruta.</li></ol><div><a href="https://www.112.es/consejos/incendio-forestal.html" target="_blank" rel="noreferrer">Consejos 112 <ExternalLink size={12}/></a><a href="https://www.dgt.es/conoce-el-estado-del-trafico/informacion-e-incidencias-de-trafico/index.html" target="_blank" rel="noreferrer">Estado DGT <ExternalLink size={12}/></a></div></div>}
        </section>

        <section className="panel-section">
          <div className="section-title"><div><h2>Incendios cercanos</h2><span>{fireMode === 'live' ? 'NASA FIRMS' : 'MODO DEMO'} · {lastSync.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></div><button onClick={() => mapRef.current?.fitBounds([[-9.6,35.7],[4.5,43.9]], {padding:50})}>Ver España</button></div>
          {fires.length === 0 && <p className="route-copy">Sin detecciones satelitales recientes en España.</p>}
          {nearestFires.slice(0,3).map(({ fire, distanceKm }, i) => <button className="fire-row" key={fire.id} onClick={() => mapRef.current?.flyTo({center:fire.coordinates,zoom:13})}>
            <span className={`fire-icon fire-${i}`}><Flame size={17} fill="currentColor"/></span><div><b>{fire.name}</b><small>{fire.source}{fire.frp != null ? ` · ${fire.frp.toFixed(1)} MW` : ''}</small></div><strong>{distanceKm.toFixed(1)} km</strong><ChevronRight size={17}/>
          </button>)}
        </section>

        <section className="panel-section route-section">
          <div className="section-title"><div><h2>Ruta de evacuación</h2><span>Calculada según riesgo y viento</span></div><Route size={20}/></div>
          {destination ? <div className="destination"><span><ShieldCheck/></span><div><small>DESTINO RECOMENDADO</small><b>{destination.name}</b><p>{destination.type} · {destination.capacity}</p></div></div> : <p className="route-copy">Busca el punto seguro que minimiza exposición a los focos activos.</p>}
          <button className="primary" disabled={fireMode === 'live'} onClick={calculateRoute}><Navigation size={18}/>{fireMode === 'live' ? 'Ruta pendiente de datos oficiales' : route.length ? 'Recalcular ruta segura' : 'Calcular ruta segura'}</button>
          <div className="advisory"><ShieldCheck size={16}/><span>{fireMode === 'live' ? 'No se recomendará una ruta sin perímetros, cortes y refugios verificados.' : 'La ruta es una simulación y evita las áreas de mayor riesgo detectado.'}</span></div>
        </section>

        <section className="sharing">
          <div><span className="share-icon"><MapPin size={18}/></span><div><b>Compartir mi ubicación</b><small>Para recibir alertas cercanas</small></div></div>
          <label className="switch"><input type="checkbox" checked={sharing} onChange={(e)=>setSharing(e.target.checked)}/><span/></label>
        </section>
        <button className="scenario-button" onClick={simulateFiveKmScenario}><TestTube2 size={17}/><span><b>Probar alerta a 5 km</b><small>Ensayo con un foco FIRMS real</small></span></button>
      </aside>

      <section className="map-wrap">
        <div ref={mapContainer} className="map" />
        <div className="map-tools"><button onClick={locate} title="Usar mi ubicación"><LocateFixed/></button><button onClick={() => mapRef.current?.zoomIn()}>+</button><button onClick={() => mapRef.current?.zoomOut()}>−</button></div>
        <div className="map-meta"><span><i className="fire-dot"/> Incendio activo</span><span><i className="safe-dot"/> Punto seguro</span><span><i className="route-line"/> Ruta recomendada</span></div>
        <div className="weather-strip"><div><Wind/><span><small>VIENTO</small><b>{weather.windSpeed.toFixed(0)} km/h · {weather.windDirection.toFixed(0)}°</b></span></div><div><CloudRain/><span><small>HUMEDAD</small><b>{weather.humidity.toFixed(0)}%</b></span></div><div><Thermometer/><span><small>TEMPERATURA</small><b>{weather.temperature.toFixed(0)}°C</b></span></div><em>{weather.label}</em></div>
      </section>
    </main>

    {toast && <div className="toast"><ShieldCheck size={18}/>{toast}</div>}
    {showRegister && <div className="modal-backdrop" onClick={() => setShowRegister(false)}><form className="modal" onClick={(e)=>e.stopPropagation()} onSubmit={activateLocalAlerts}><button type="button" className="modal-x" onClick={()=>setShowRegister(false)}><X/></button><div className="modal-icon"><Bell/></div><h2>Activa avisos de proximidad</h2><p>METEO registrará este dispositivo para comprobar cada 15 minutos si existe una detección de alta confianza en un radio de 25 km. Es un canal complementario y no sustituye ES‑Alert ni a las autoridades.</p><label className="consent"><input required type="checkbox"/> Entiendo el alcance y acepto usar mi ubicación para calcular proximidad.</label><button className="primary" type="submit">Permitir notificaciones</button></form></div>}
    {showAi && <div className="modal-backdrop" onClick={() => setShowAi(false)}><section className="modal ai-modal" onClick={(e)=>e.stopPropagation()}><button type="button" className="modal-x" onClick={()=>setShowAi(false)}><X/></button><div className="modal-icon"><Bot/></div><h2>Explicación de seguridad</h2>{aiLoading ? <p>Analizando los datos visibles…</p> : <div className="ai-answer">{aiGuidance}</div>}<small>Groq · Apoyo informativo. No sustituye al 112, ES‑Alert ni a las autoridades.</small></section></div>}
  </div>;
}
