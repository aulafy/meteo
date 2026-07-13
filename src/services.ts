import distance from '@turf/distance';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import type { Coordinates, Fire, RiskAssessment, RiskLevel, SafePlace, Weather } from './types';

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
    return { temperature: 34, humidity: 24, windSpeed: 28, windDirection: 245, precipitation: 0, label: 'Simulación local' };
  }
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

export function getDownwindLocation(fire: Coordinates, windFromDegrees: number, distanceKm = 5): Coordinates {
  const radiusKm = 6371;
  const angularDistance = distanceKm / radiusKm;
  const bearingRadians = ((windFromDegrees + 180) % 360) * Math.PI / 180;
  const latitude = fire[1] * Math.PI / 180;
  const longitude = fire[0] * Math.PI / 180;
  const destinationLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearingRadians));
  const destinationLongitude = longitude + Math.atan2(Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitude), Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude));
  return [destinationLongitude * 180 / Math.PI, destinationLatitude * 180 / Math.PI];
}

export function chooseSafePlace(location: Coordinates, fires: Fire[], places: SafePlace[]): SafePlace {
  return places.map((place) => {
    const userDistance = distance(point(location), point(place.coordinates), { units: 'kilometers' });
    const fireDistance = fires.length ? Math.min(...fires.map((fire) => distance(point(place.coordinates), point(fire.coordinates), { units: 'kilometers' }))) : 20;
    return { place, score: userDistance - Math.min(fireDistance, 20) * 0.7 };
  }).sort((a, b) => a.score - b.score)[0].place;
}

export async function getRoute(from: Coordinates, to: Coordinates): Promise<Coordinates[]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.join(',')};${to.join(',')}?overview=full&geometries=geojson&alternatives=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.[0]) throw new Error('route');
    return data.routes[0].geometry.coordinates;
  } catch {
    return [from, to];
  }
}
