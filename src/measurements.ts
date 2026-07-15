import type { Coordinates } from './types';

const EARTH_RADIUS_METERS = 6_371_008.8;
const TO_RADIANS = Math.PI / 180;

export interface MapMeasurement {
  planarMeters: number;
  surfaceMeters: number | null;
  ascentMeters: number | null;
  descentMeters: number | null;
}

export function distanceMeters(a: Coordinates, b: Coordinates) {
  const latitude1 = a[1] * TO_RADIANS;
  const latitude2 = b[1] * TO_RADIANS;
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = (b[0] - a[0]) * TO_RADIANS;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function measurePath(points: Coordinates[], elevations: Array<number | null> = []): MapMeasurement {
  let planarMeters = 0;
  let surfaceMeters = 0;
  let ascentMeters = 0;
  let descentMeters = 0;
  let hasTerrain = points.length > 1;

  for (let index = 1; index < points.length; index += 1) {
    const planarSegment = distanceMeters(points[index - 1], points[index]);
    planarMeters += planarSegment;
    const before = elevations[index - 1];
    const after = elevations[index];
    if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after)) {
      hasTerrain = false;
      surfaceMeters += planarSegment;
      continue;
    }
    const elevationDelta = after - before;
    surfaceMeters += Math.hypot(planarSegment, elevationDelta);
    if (elevationDelta > 0) ascentMeters += elevationDelta;
    else descentMeters += -elevationDelta;
  }

  return {
    planarMeters,
    surfaceMeters: hasTerrain ? surfaceMeters : null,
    ascentMeters: hasTerrain ? ascentMeters : null,
    descentMeters: hasTerrain ? descentMeters : null,
  };
}

export function formatDistance(meters: number) {
  return meters < 1_000 ? `${Math.round(meters)} m` : `${(meters / 1_000).toFixed(meters < 10_000 ? 2 : 1)} km`;
}
