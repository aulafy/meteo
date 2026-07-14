import distance from '@turf/distance';
import { point } from '@turf/helpers';
import type { Coordinates } from '../../types';
import type { Earthquake } from './types';

export interface EarthquakeSummaryItem {
  earthquake: Earthquake;
  distanceKm: number | null;
}

export function rankEarthquakesByDistance(location: Coordinates, earthquakes: Earthquake[]): EarthquakeSummaryItem[] {
  return earthquakes
    .map((earthquake) => ({
      earthquake,
      distanceKm: distance(point(location), point(earthquake.coordinates), { units: 'kilometers' }),
    }))
    .sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity));
}

export function selectEarthquakesForSummary(location: Coordinates | null, earthquakes: Earthquake[]): EarthquakeSummaryItem[] {
  if (location) return rankEarthquakesByDistance(location, earthquakes).slice(0, 3);
  return [...earthquakes]
    .sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))
    .slice(0, 5)
    .map((earthquake) => ({ earthquake, distanceKm: null }));
}

export function formatEarthquakeDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.max(0, distanceKm).toFixed(1)} km`;
  if (distanceKm < 1_000) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm).toLocaleString('es-ES')} km`;
}
