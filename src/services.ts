import distance from '@turf/distance';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import type { ActionGuidance, AirQuality, Coordinates, Fire, HourlyForecast, LocationResult, RiskAssessment, RiskLevel, Weather } from './types';

export function parseFireFeed(input: unknown) {
  const feed = input as { generatedAt?: unknown; fires?: unknown };
  if (!feed || typeof feed.generatedAt !== 'string' || !Number.isFinite(Date.parse(feed.generatedAt)) || !Array.isArray(feed.fires) || feed.fires.length > 10000) throw new Error('Feed FIRMS inválido');
  const fires = feed.fires.map((value) => {
    const fire = value as Partial<Fire>;
    const validCoordinates = Array.isArray(fire.coordinates) && fire.coordinates.length === 2 && fire.coordinates.every(Number.isFinite) && fire.coordinates[0] >= -10 && fire.coordinates[0] <= 5 && fire.coordinates[1] >= 35 && fire.coordinates[1] <= 44;
    if (!validCoordinates || typeof fire.id !== 'string' || !fire.id || typeof fire.name !== 'string' || fire.name.length > 120 || fire.source !== 'NASA FIRMS' || typeof fire.confidence !== 'number' || fire.confidence < 0 || fire.confidence > 100 || typeof fire.intensity !== 'number' || fire.intensity < 0 || fire.intensity > 100 || typeof fire.detectedAt !== 'string' || !Number.isFinite(Date.parse(fire.detectedAt)) || (fire.frp != null && (typeof fire.frp !== 'number' || fire.frp < 0))) throw new Error('Detección FIRMS inválida');
    return fire as Fire;
  });
  return { generatedAt: feed.generatedAt, fires };
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
    return { temperature: current.temperature_2m, humidity: current.relative_humidity_2m, windSpeed: current.wind_speed_10m, windGusts: current.wind_gusts_10m, windDirection: current.wind_direction_10m, precipitation: current.precipitation, label: 'Open‑Meteo · ahora' };
  } catch {
    return { temperature: 0, humidity: 0, windSpeed: 0, windDirection: 0, precipitation: 0, label: 'Meteorología no disponible' };
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
    return (data.results ?? []).filter((item: any) => item.country_code === 'ES').map((item: any) => ({ name: item.name, region: item.admin1 || item.admin2 || '', country: item.country || 'España', coordinates: [item.longitude, item.latitude] as Coordinates }));
  } catch { return []; }
}

export function assessRisk(location: Coordinates, fires: Fire[], weather: Weather): RiskAssessment {
  if (!fires.length) return { score: 0, level: 'bajo', distanceKm: Infinity, reasons: ['No hay detecciones satelitales recientes en España'], etaMinutes: 0, isDownwind: false };
  const ranked = fires.map((fire) => ({ fire, km: distance(point(location), point(fire.coordinates), { units: 'kilometers' }) })).sort((a, b) => a.km - b.km);
  const nearest = ranked[0];
  const proximity = Math.max(0, 100 - nearest.km * 7);
  const dryness = Math.max(0, 70 - weather.humidity) * 0.75;
  const heat = Math.max(0, weather.temperature - 20) * 1.35;
  const wind = Math.min(35, weather.windSpeed * 0.85);
  const intensity = nearest.fire.intensity * 0.45;
  const fireToResident = (bearing(point(nearest.fire.coordinates), point(location)) + 360) % 360;
  const downwindDirection = (weather.windDirection + 180) % 360;
  const angleDifference = Math.abs(((fireToResident - downwindDirection + 540) % 360) - 180);
  const isDownwind = angleDifference <= 45;
  const downwindPenalty = isDownwind ? Math.min(18, 5 + weather.windSpeed * 0.45) : 0;
  let score = Math.round(Math.min(100, proximity * 0.36 + dryness * 0.18 + heat * 0.14 + wind * 0.14 + intensity * 0.18 + downwindPenalty));
  if (nearest.km <= 5.5 && nearest.fire.confidence >= 70) score = Math.max(score, 65);
  else if (nearest.km <= 10 && nearest.fire.confidence >= 70) score = Math.max(score, isDownwind ? 60 : 50);
  const level: RiskLevel = score >= 75 ? 'extremo' : score >= 55 ? 'alto' : score >= 30 ? 'moderado' : 'bajo';
  const reasons = [
    `Foco activo a ${nearest.km.toFixed(1)} km`,
    ...(isDownwind ? ['Tu ubicación está a sotavento de la detección'] : []),
    weather.windSpeed > 25 ? `Rachas de ${weather.windSpeed.toFixed(0)} km/h favorecen la propagación` : `Viento de ${weather.windSpeed.toFixed(0)} km/h`,
    weather.humidity < 30 ? `Humedad crítica del ${weather.humidity.toFixed(0)}%` : `Humedad del ${weather.humidity.toFixed(0)}%`,
  ];
  const ageHours = Math.max(0, (Date.now() - new Date(nearest.fire.detectedAt).getTime()) / 3600000);
  reasons.push(`Última observación satelital hace ${ageHours < 1 ? '<1' : Math.round(ageHours)} h`);
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
