import distance from '@turf/distance';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import type { AirQuality, Coordinates, Fire, HourlyForecast, RiskAssessment, RiskLevel, Weather } from './types';

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
    return hourly.time.map((time: string, index: number) => ({ time, temperature: hourly.temperature_2m[index], humidity: hourly.relative_humidity_2m[index], precipitationProbability: hourly.precipitation_probability[index], windSpeed: hourly.wind_speed_10m[index], windGusts: hourly.wind_gusts_10m[index], windDirection: hourly.wind_direction_10m[index] }));
  } catch { return []; }
}

export async function getAirQuality([lng, lat]: Coordinates): Promise<AirQuality | null> {
  try {
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm2_5,pm10`);
    if (!response.ok) throw new Error('air'); const { current } = await response.json();
    return { europeanAqi: current.european_aqi, pm25: current.pm2_5, pm10: current.pm10 };
  } catch { return null; }
}

export function assessRisk(location: Coordinates, fires: Fire[], weather: Weather): RiskAssessment {
  if (!fires.length) return { score: 0, level: 'bajo', distanceKm: Infinity, reasons: ['No hay detecciones satelitales recientes en España'], etaMinutes: 0 };
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
  return { score, level, nearestFire: nearest.fire, distanceKm: nearest.km, reasons, etaMinutes: Math.max(5, Math.round(nearest.km * 2.6)) };
}

export function rankFiresByDistance(location: Coordinates, fires: Fire[]) {
  return fires.map((fire) => ({
    fire,
    distanceKm: distance(point(location), point(fire.coordinates), { units: 'kilometers' }),
  })).sort((a, b) => a.distanceKm - b.distanceKm);
}
