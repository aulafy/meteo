import distance from '@turf/distance';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import type { Coordinates } from './types';

export interface ReferenceRoute {
  name: string;
  format: 'GPX' | 'KML' | 'GeoJSON';
  lines: Coordinates[][];
  coordinates: Coordinates[];
  cumulativeMeters: number[];
  totalMeters: number;
  bounds: [[number, number], [number, number]];
  geojson: {
    type: 'FeatureCollection';
    features: Array<{ type: 'Feature'; properties: { name: string; verified: false }; geometry: { type: 'LineString'; coordinates: Coordinates[] } }>;
  };
}

export interface RouteSample {
  coordinate: Coordinates;
  bearing: number;
  trail: Coordinates[];
}

export function measureRoute(coordinates: Coordinates[]) {
  const cumulativeMeters = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    const segmentMeters = distance(point(coordinates[index - 1]), point(coordinates[index]), { units: 'kilometers' }) * 1000;
    cumulativeMeters.push(cumulativeMeters[index - 1] + segmentMeters);
  }
  return { cumulativeMeters, totalMeters: cumulativeMeters.at(-1) ?? 0 };
}

function routeBounds(lines: Coordinates[][]): [[number, number], [number, number]] {
  const coordinates = lines.flat();
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return [[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]];
}

export function createReferenceRoute(lines: Coordinates[][], format: ReferenceRoute['format'], fileName: string): ReferenceRoute {
  const measuredLines = lines.map((coordinates) => ({ coordinates, ...measureRoute(coordinates) }));
  const primary = measuredLines.reduce((longest, current) => current.totalMeters > longest.totalMeters ? current : longest);
  if (primary.totalMeters <= 0) throw new Error('La ruta no tiene una longitud válida');
  const cleanName = fileName.replace(/\.(gpx|kml|geojson|json)$/i, '').slice(0, 80) || 'Ruta local';

  return {
    name: cleanName,
    format,
    lines,
    coordinates: primary.coordinates,
    cumulativeMeters: primary.cumulativeMeters,
    totalMeters: primary.totalMeters,
    bounds: routeBounds(lines),
    geojson: {
      type: 'FeatureCollection',
      features: lines.map((coordinates, index) => ({
        type: 'Feature',
        properties: { name: lines.length > 1 ? `${cleanName} ${index + 1}` : cleanName, verified: false },
        geometry: { type: 'LineString', coordinates },
      })),
    },
  };
}

export function sampleRoute(route: ReferenceRoute, progress: number): RouteSample {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const targetMeters = route.totalMeters * clampedProgress;
  let high = route.cumulativeMeters.length - 1;
  let low = 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (route.cumulativeMeters[middle] < targetMeters) low = middle + 1;
    else high = middle;
  }
  const endIndex = Math.max(1, low);
  const startIndex = endIndex - 1;
  const segmentStart = route.cumulativeMeters[startIndex];
  const segmentLength = Math.max(0.001, route.cumulativeMeters[endIndex] - segmentStart);
  const fraction = Math.max(0, Math.min(1, (targetMeters - segmentStart) / segmentLength));
  const start = route.coordinates[startIndex];
  const end = route.coordinates[endIndex];
  const coordinate: Coordinates = [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
  const heading = (bearing(point(start), point(end)) + 360) % 360;
  return { coordinate, bearing: heading, trail: [...route.coordinates.slice(0, endIndex), coordinate] };
}
