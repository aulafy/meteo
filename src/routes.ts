import distance from '@turf/distance';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import { gpx, kml } from '@tmcw/togeojson';
import type { Coordinates } from './types';

const MAX_ROUTE_POINTS = 20_000;
const SPAIN_BOUNDS = { west: -10, south: 35, east: 5, north: 44 };

type JsonGeometry = {
  type?: string;
  coordinates?: unknown;
  geometries?: JsonGeometry[];
};

type JsonFeature = {
  type?: string;
  geometry?: JsonGeometry | null;
  properties?: Record<string, unknown> | null;
};

type JsonGeoData = JsonGeometry | JsonFeature | { type?: string; features?: JsonFeature[] };

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

function parseXml(text: string) {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('El archivo XML no es válido');
  return document;
}

function normalizeCoordinate(value: unknown): Coordinates | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < SPAIN_BOUNDS.west || longitude > SPAIN_BOUNDS.east || latitude < SPAIN_BOUNDS.south || latitude > SPAIN_BOUNDS.north) {
    throw new Error('La ruta contiene coordenadas fuera del ámbito de España');
  }
  return [longitude, latitude];
}

function lineFromCoordinates(value: unknown) {
  if (!Array.isArray(value)) return null;
  const coordinates = value.map(normalizeCoordinate).filter((coordinate): coordinate is Coordinates => coordinate !== null);
  const deduplicated = coordinates.filter((coordinate, index) => index === 0 || coordinate[0] !== coordinates[index - 1][0] || coordinate[1] !== coordinates[index - 1][1]);
  return deduplicated.length >= 2 ? deduplicated : null;
}

function linesFromGeometry(geometry: JsonGeometry | null | undefined): Coordinates[][] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') {
    const line = lineFromCoordinates(geometry.coordinates);
    return line ? [line] : [];
  }
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.map(lineFromCoordinates).filter((line): line is Coordinates[] => line !== null);
  }
  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    return geometry.geometries.flatMap(linesFromGeometry);
  }
  return [];
}

function extractLines(data: JsonGeoData): Coordinates[][] {
  if (data.type === 'FeatureCollection' && 'features' in data && Array.isArray(data.features)) {
    return data.features.flatMap((feature) => linesFromGeometry(feature.geometry));
  }
  if (data.type === 'Feature' && 'geometry' in data) return linesFromGeometry(data.geometry);
  return linesFromGeometry(data as JsonGeometry);
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

export function parseRouteText(text: string, fileName: string): ReferenceRoute {
  const extension = fileName.toLowerCase().split('.').pop();
  let data: JsonGeoData;
  let format: ReferenceRoute['format'];
  if (extension === 'gpx') {
    data = gpx(parseXml(text)) as JsonGeoData;
    format = 'GPX';
  } else if (extension === 'kml') {
    data = kml(parseXml(text)) as JsonGeoData;
    format = 'KML';
  } else if (extension === 'geojson' || extension === 'json') {
    try { data = JSON.parse(text) as JsonGeoData; } catch { throw new Error('El GeoJSON no es JSON válido'); }
    format = 'GeoJSON';
  } else {
    throw new Error('Formato no compatible. Usa GPX, KML o GeoJSON');
  }

  const lines = extractLines(data);
  const pointCount = lines.reduce((total, line) => total + line.length, 0);
  if (!lines.length) throw new Error('El archivo no contiene rutas o tracks LineString');
  if (pointCount > MAX_ROUTE_POINTS) throw new Error(`La ruta supera el límite de ${MAX_ROUTE_POINTS.toLocaleString('es-ES')} puntos`);

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
