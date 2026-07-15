import { gpx, kml } from '@tmcw/togeojson';
import { createReferenceRoute, type ReferenceRoute } from './routes';
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

  return createReferenceRoute(lines, format, fileName);
}
