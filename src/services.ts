import distance from '@turf/distance';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import type { ActionGuidance, AirQuality, Coordinates, Fire, HourlyForecast, LocationResult, RiskAssessment, RiskLevel, TrafficIncident, Weather } from './types';

export const ACTIONABLE_FIRE_MAX_AGE_HOURS = 12;
export const ACTIONABLE_FIRE_MIN_CONFIDENCE = 70;

export function isActionableFire(fire: Fire, now = Date.now()) {
  const detectedAt = Date.parse(fire.detectedAt);
  return fire.confidence >= ACTIONABLE_FIRE_MIN_CONFIDENCE
    && Number.isFinite(detectedAt)
    && detectedAt <= now
    && now - detectedAt <= ACTIONABLE_FIRE_MAX_AGE_HOURS * 3600000;
}

export function fireAgeLabel(detectedAt: string, now = Date.now()) {
  const ageHours = Math.max(0, (now - Date.parse(detectedAt)) / 3600000);
  if (ageHours < 1) return 'hace <1 h';
  return `hace ${Math.floor(ageHours)} h`;
}

export function parseFireFeed(input: unknown) {
  const feed = input as { generatedAt?: unknown; fires?: unknown };
  if (!feed || typeof feed.generatedAt !== 'string' || !Number.isFinite(Date.parse(feed.generatedAt)) || !Array.isArray(feed.fires) || feed.fires.length > 10000) throw new Error('Feed FIRMS inválido');
  const fires = feed.fires.map((value) => {
    const fire = value as Partial<Fire>;
    const validCoordinates = Array.isArray(fire.coordinates) && fire.coordinates.length === 2 && fire.coordinates.every(Number.isFinite) && fire.coordinates[0] >= -19 && fire.coordinates[0] <= 5 && fire.coordinates[1] >= 27 && fire.coordinates[1] <= 44.5;
    if (!validCoordinates || typeof fire.id !== 'string' || !fire.id || typeof fire.name !== 'string' || fire.name.length > 120 || fire.source !== 'NASA FIRMS' || typeof fire.confidence !== 'number' || fire.confidence < 0 || fire.confidence > 100 || typeof fire.intensity !== 'number' || fire.intensity < 0 || fire.intensity > 100 || typeof fire.detectedAt !== 'string' || !Number.isFinite(Date.parse(fire.detectedAt)) || (fire.frp != null && (typeof fire.frp !== 'number' || fire.frp < 0))) throw new Error('Detección FIRMS inválida');
    return fire as Fire;
  });
  return { generatedAt: feed.generatedAt, fires };
}

export function parseTrafficFeed(input: unknown) {
  const feed = input as { source?: unknown; publishedAt?: unknown; coverage?: unknown; incidents?: unknown };
  if (feed?.source !== 'DGT DATEX II v3.7' || typeof feed.publishedAt !== 'string' || !Number.isFinite(Date.parse(feed.publishedAt)) || typeof feed.coverage !== 'string' || !Array.isArray(feed.incidents) || feed.incidents.length > 750) throw new Error('Feed DGT inválido');
  const incidents = feed.incidents.map((value) => {
    const incident = value as Partial<TrafficIncident>;
    const validText = [incident.id, incident.road, incident.municipality, incident.province, incident.cause, incident.kind, incident.updatedAt].every((item) => typeof item === 'string' && item.length <= 180);
    const validCoordinates = Array.isArray(incident.coordinates) && incident.coordinates.length >= 1 && incident.coordinates.length <= 2 && incident.coordinates.every((coordinate) => Array.isArray(coordinate) && coordinate.length === 2 && coordinate.every(Number.isFinite) && coordinate[0] >= -19 && coordinate[0] <= 5 && coordinate[1] >= 27 && coordinate[1] <= 44.5);
    const validClosure = ['complete', 'carriageway', 'lane', 'intermittent', 'affected'].includes(String(incident.closure));
    if (!validText || !validCoordinates || !validClosure || typeof incident.fireRelated !== 'boolean' || !incident.id || !incident.road || !Number.isFinite(Date.parse(String(incident.updatedAt)))) throw new Error('Incidencia DGT inválida');
    return incident as TrafficIncident;
  });
  return { source: feed.source, publishedAt: feed.publishedAt, coverage: feed.coverage, incidents };
}

export function trafficClosureLabel(closure: TrafficIncident['closure']) {
  if (closure === 'complete') return 'Carretera cortada';
  if (closure === 'carriageway') return 'Calzada cerrada';
  if (closure === 'lane') return 'Carril cerrado';
  if (closure === 'intermittent') return 'Cortes intermitentes';
  return 'Carretera afectada';
}

export function trafficCauseLabel(cause: string) {
  const labels: Record<string, string> = {
    forestFire: 'Incendio forestal', smokeHazard: 'Humo', vehicleOnFire: 'Vehículo incendiado',
    roadworks: 'Obras', rockfalls: 'Desprendimientos', avalanches: 'Aludes', flooding: 'Inundación',
    damagedRoadSurface: 'Calzada dañada', accident: 'Accidente', obstruction: 'Obstáculo',
  };
  return labels[cause] || cause.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

export function rankTrafficByDistance(location: Coordinates, incidents: TrafficIncident[]) {
  return incidents.map((incident) => ({
    incident,
    distanceKm: Math.min(...incident.coordinates.map((coordinate) => distance(point(location), point(coordinate), { units: 'kilometers' }))),
  })).sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function getWeather([lng, lat]: Coordinates): Promise<Weather> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m');
    url.searchParams.set('wind_speed_unit', 'kmh');
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather');
    const { current } = await res.json();
    const values = [current.temperature_2m, current.relative_humidity_2m, current.wind_speed_10m, current.wind_direction_10m, current.precipitation];
    if (!values.every(Number.isFinite)) throw new Error('weather');
    return { available: true, temperature: current.temperature_2m, humidity: current.relative_humidity_2m, windSpeed: current.wind_speed_10m, windGusts: current.wind_gusts_10m, windDirection: current.wind_direction_10m, precipitation: current.precipitation, label: 'Open‑Meteo · ahora' };
  } catch {
    return { available: false, temperature: 0, humidity: 0, windSpeed: 0, windDirection: 0, precipitation: 0, label: 'Meteorología no disponible' };
  }
}

export async function getHourlyForecast([lng, lat]: Coordinates): Promise<HourlyForecast[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat)); url.searchParams.set('longitude', String(lng));
  url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m');
  url.searchParams.set('forecast_hours', '12'); url.searchParams.set('timezone', 'auto'); url.searchParams.set('wind_speed_unit', 'kmh');
  try {
    const response = await fetch(url); if (!response.ok) throw new Error('forecast');
    const { hourly } = await response.json();
    return hourly.time.map((time: string, index: number) => {
      const wind = hourly.wind_speed_10m[index]; const gust = hourly.wind_gusts_10m[index]; const humidity = hourly.relative_humidity_2m[index];
      const danger = gust >= 50 || (wind >= 30 && humidity <= 30) ? 'alto' : gust >= 30 || wind >= 20 || humidity <= 35 ? 'moderado' : 'bajo';
      return { time, temperature: hourly.temperature_2m[index], humidity, precipitationProbability: hourly.precipitation_probability[index], windSpeed: wind, windGusts: gust, windDirection: hourly.wind_direction_10m[index], danger };
    });
  } catch { return []; }
}

export async function getAirQuality([lng, lat]: Coordinates): Promise<AirQuality | null> {
  try {
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm2_5,pm10`);
    if (!response.ok) throw new Error('air'); const { current } = await response.json();
    return { europeanAqi: current.european_aqi, pm25: current.pm2_5, pm10: current.pm10 };
  } catch { return null; }
}

export async function searchSpanishLocations(query: string): Promise<LocationResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query.trim()); url.searchParams.set('count', '8'); url.searchParams.set('language', 'es'); url.searchParams.set('format', 'json'); url.searchParams.set('countryCode', 'ES');
    const response = await fetch(url); if (!response.ok) throw new Error('geocoding');
    const data = await response.json();
    type GeocodingResult = { name: string; admin1?: string; admin2?: string; country?: string; country_code?: string; longitude: number; latitude: number };
    return ((data.results ?? []) as GeocodingResult[]).filter((item) => item.country_code === 'ES').map((item) => ({ name: item.name, region: item.admin1 || item.admin2 || '', country: item.country || 'España', coordinates: [item.longitude, item.latitude] as Coordinates }));
  } catch { return []; }
}

export function assessRisk(location: Coordinates, fires: Fire[], weather: Weather): RiskAssessment {
  const actionableFires = fires.filter((fire) => isActionableFire(fire));
  if (!actionableFires.length) return { score: 0, level: 'bajo', distanceKm: Infinity, reasons: ['No hay detecciones de confianza ≥70% observadas en las últimas 12 h'], etaMinutes: 0, isDownwind: false };
  const ranked = actionableFires.map((fire) => ({ fire, km: distance(point(location), point(fire.coordinates), { units: 'kilometers' }) })).sort((a, b) => a.km - b.km);
  const nearest = ranked[0];
  const weatherAvailable = weather.available !== false;
  const proximity = Math.max(0, 100 - nearest.km * 7);
  const dryness = weatherAvailable ? Math.max(0, 70 - weather.humidity) * 0.75 : 0;
  const heat = weatherAvailable ? Math.max(0, weather.temperature - 20) * 1.35 : 0;
  const wind = weatherAvailable ? Math.min(35, weather.windSpeed * 0.85) : 0;
  const intensity = nearest.fire.intensity * 0.45;
  const fireToResident = (bearing(point(nearest.fire.coordinates), point(location)) + 360) % 360;
  const downwindDirection = (weather.windDirection + 180) % 360;
  const angleDifference = Math.abs(((fireToResident - downwindDirection + 540) % 360) - 180);
  const isDownwind = weatherAvailable && angleDifference <= 45;
  const downwindPenalty = isDownwind ? Math.min(18, 5 + weather.windSpeed * 0.45) : 0;
  let score = Math.round(Math.min(100, proximity * 0.36 + dryness * 0.18 + heat * 0.14 + wind * 0.14 + intensity * 0.18 + downwindPenalty));
  if (nearest.km <= 5.5 && nearest.fire.confidence >= 70) score = Math.max(score, 65);
  else if (nearest.km <= 10 && nearest.fire.confidence >= 70) score = Math.max(score, isDownwind ? 60 : 50);
  const level: RiskLevel = score >= 75 ? 'extremo' : score >= 55 ? 'alto' : score >= 30 ? 'moderado' : 'bajo';
  const reasons = [
    `Anomalía térmica reciente a ${nearest.km.toFixed(1)} km`,
    ...(isDownwind ? ['Tu ubicación está a sotavento de la detección'] : []),
    ...(weatherAvailable ? [weather.windSpeed > 25 ? `Viento de ${weather.windSpeed.toFixed(0)} km/h favorece la propagación` : `Viento de ${weather.windSpeed.toFixed(0)} km/h`] : [weather.label.startsWith('Cargando') ? 'Meteorología cargando; evaluación provisional' : 'Meteorología no disponible; evaluación incompleta']),
    ...(weatherAvailable ? [weather.humidity < 30 ? `Humedad crítica del ${weather.humidity.toFixed(0)}%` : `Humedad del ${weather.humidity.toFixed(0)}%`] : []),
  ];
  const ageHours = Math.max(0, (Date.now() - new Date(nearest.fire.detectedAt).getTime()) / 3600000);
  reasons.push(`Última observación satelital hace ${ageHours < 1 ? '<1' : Math.floor(ageHours)} h`);
  return { score, level, nearestFire: nearest.fire, distanceKm: nearest.km, reasons, etaMinutes: 0, isDownwind };
}

export function getActionGuidance(risk: RiskAssessment): ActionGuidance {
  if (risk.level === 'extremo') return { urgency: 'critica', title: 'Atención inmediata', message: risk.isDownwind ? 'La detección está próxima y el viento puede transportar humo y pavesas hacia tu zona.' : 'La combinación de proximidad e intensidad requiere vigilancia inmediata.', steps: ['Comprueba ahora ES‑Alert, 112 y Protección Civil.', 'Reúne a tu hogar y prepara una salida rápida si la ordenan.', 'Ante humo denso, llamas o peligro inmediato, llama al 112.'] };
  if (risk.level === 'alto') return { urgency: 'alta', title: risk.isDownwind ? 'Viento hacia tu zona' : 'Riesgo alto cercano', message: 'No esperes a ver llamas para preparar documentación, medicación, dependientes y animales.', steps: ['Mantén móvil y radio con sonido.', 'Revisa los accesos oficiales y el estado de la DGT.', 'No inicies una evacuación por una ruta no confirmada.'] };
  if (risk.level === 'moderado') return { urgency: 'atencion', title: 'Mantente preparado', message: 'La situación no implica una orden de evacuación, pero puede cambiar con el viento.', steps: ['Consulta canales oficiales periódicamente.', 'Carga el móvil y prepara los elementos esenciales.', 'Cierra ventanas si aparece humo.'] };
  return { urgency: 'informativa', title: 'Vigilancia activa', message: 'No se aprecia una combinación de proximidad y condiciones que eleve el riesgo ahora.', steps: ['Mantén activadas las alertas.', 'Sigue siempre las instrucciones oficiales.'] };
}

export function windDirectionToCardinal(degrees: number) {
  return ['N','NE','E','SE','S','SO','O','NO'][Math.round(((degrees % 360) / 45)) % 8];
}

export function rankFiresByDistance(location: Coordinates, fires: Fire[]) {
  return fires.map((fire) => ({
    fire,
    distanceKm: distance(point(location), point(fire.coordinates), { units: 'kilometers' }),
  })).sort((a, b) => a.distanceKm - b.distanceKm);
}

export function selectFiresForAi(location: Coordinates | null, fires: Fire[]) {
  if (location) return rankFiresByDistance(location, fires).slice(0, 3);
  return [...fires]
    .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))
    .slice(0, 5)
    .map((fire) => ({ fire, distanceKm: null }));
}
