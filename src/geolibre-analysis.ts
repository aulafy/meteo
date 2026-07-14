import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Fire, Coordinates } from './types';
import { sampleRoute, type ReferenceRoute } from './routes';

export const FIRE_TIME_WINDOWS = [1, 3, 6, 12, 24] as const;
export type FireTimeWindow = typeof FIRE_TIME_WINDOWS[number];

export interface ElevationProfile {
  elevations: number[];
  minimum: number;
  maximum: number;
  ascent: number;
  descent: number;
  sampleCount: number;
}

export function filterFiresByWindow(fires: Fire[], hours: FireTimeWindow, now = Date.now()) {
  const threshold = now - hours * 3_600_000;
  return fires.filter((fire) => {
    const detectedAt = Date.parse(fire.detectedAt);
    return Number.isFinite(detectedAt) && detectedAt >= threshold && detectedAt <= now + 5 * 60_000;
  });
}

export function destinationPoint([longitude, latitude]: Coordinates, bearingDegrees: number, distanceKm: number): Coordinates {
  const radiusKm = 6371.0088;
  const angularDistance = distanceKm / radiusKm;
  const bearing = bearingDegrees * Math.PI / 180;
  const latitude1 = latitude * Math.PI / 180;
  const longitude1 = longitude * Math.PI / 180;
  const latitude2 = Math.asin(Math.sin(latitude1) * Math.cos(angularDistance) + Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing));
  const longitude2 = longitude1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1), Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2));
  return [((longitude2 * 180 / Math.PI + 540) % 360) - 180, latitude2 * 180 / Math.PI];
}

export function buildWindIndicator(location: Coordinates, windFromDegrees: number, distanceKm = 12): FeatureCollection<LineString | Point> {
  const direction = (windFromDegrees + 180) % 360;
  const endpoint = destinationPoint(location, direction, distanceKm);
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'direction', direction }, geometry: { type: 'LineString', coordinates: [location, endpoint] } },
      { type: 'Feature', properties: { kind: 'arrow', direction }, geometry: { type: 'Point', coordinates: endpoint } },
    ],
  };
}

function sampledRouteCoordinates(route: ReferenceRoute, maximum = 100) {
  const count = Math.min(maximum, Math.max(2, route.coordinates.length));
  return Array.from({ length: count }, (_, index) => sampleRoute(route, index / (count - 1)).coordinate);
}

export async function fetchRouteElevation(route: ReferenceRoute, fetchImpl: typeof fetch = fetch): Promise<ElevationProfile> {
  const coordinates = sampledRouteCoordinates(route);
  const params = new URLSearchParams({
    latitude: coordinates.map((coordinate) => coordinate[1].toFixed(6)).join(','),
    longitude: coordinates.map((coordinate) => coordinate[0].toFixed(6)).join(','),
  });
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetchImpl(`https://api.open-meteo.com/v1/elevation?${params}`, { signal: controller.signal });
  } catch {
    throw new Error('No se pudo consultar la elevación de Open‑Meteo');
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Elevación no disponible (HTTP ${response.status})`);
  const data = await response.json() as { elevation?: unknown };
  if (!Array.isArray(data.elevation) || data.elevation.length !== coordinates.length || data.elevation.some((value) => !Number.isFinite(value))) {
    throw new Error('Open‑Meteo devolvió un perfil de elevación inválido');
  }
  const elevations = data.elevation as number[];
  let ascent = 0;
  let descent = 0;
  for (let index = 1; index < elevations.length; index += 1) {
    const difference = elevations[index] - elevations[index - 1];
    if (difference > 0) ascent += difference;
    else descent += Math.abs(difference);
  }
  return {
    elevations,
    minimum: Math.min(...elevations),
    maximum: Math.max(...elevations),
    ascent,
    descent,
    sampleCount: elevations.length,
  };
}
