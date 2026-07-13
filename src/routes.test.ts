import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parseRouteText, sampleRoute } from './routes';

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;

const routeGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Ruta' }, geometry: { type: 'LineString', coordinates: [[-7.96, 42.31], [-7.94, 42.33], [-7.92, 42.35]] } },
  ],
});

describe('rutas locales de referencia', () => {
  it('normaliza una ruta GeoJSON y calcula su longitud', () => {
    const route = parseRouteText(routeGeoJson, 'referencia.geojson');
    expect(route.format).toBe('GeoJSON');
    expect(route.coordinates).toHaveLength(3);
    expect(route.totalMeters).toBeGreaterThan(4000);
  });

  it('interpola marcador, rumbo y rastro', () => {
    const route = parseRouteText(routeGeoJson, 'referencia.geojson');
    const sample = sampleRoute(route, 0.5);
    expect(sample.coordinate[0]).toBeCloseTo(-7.94, 2);
    expect(sample.bearing).toBeGreaterThan(0);
    expect(sample.trail.length).toBeGreaterThanOrEqual(2);
  });

  it('rechaza puntos sin una línea', () => {
    expect(() => parseRouteText(JSON.stringify({ type: 'Point', coordinates: [-7.9, 42.3] }), 'punto.geojson')).toThrow('LineString');
  });

  it('rechaza rutas fuera del ámbito de España', () => {
    expect(() => parseRouteText(JSON.stringify({ type: 'LineString', coordinates: [[20, 50], [21, 51]] }), 'fuera.geojson')).toThrow('España');
  });

  it('convierte routes y tracks GPX', () => {
    const gpx = '<?xml version="1.0"?><gpx version="1.1" creator="METEO" xmlns="http://www.topografix.com/GPX/1/1"><rte><name>Referencia</name><rtept lat="42.31" lon="-7.96"/><rtept lat="42.33" lon="-7.94"/></rte></gpx>';
    const route = parseRouteText(gpx, 'referencia.gpx');
    expect(route.format).toBe('GPX');
    expect(route.coordinates).toHaveLength(2);
  });

  it('convierte LineString KML', () => {
    const kml = '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Referencia</name><LineString><coordinates>-7.96,42.31 -7.94,42.33</coordinates></LineString></Placemark></Document></kml>';
    const route = parseRouteText(kml, 'referencia.kml');
    expect(route.format).toBe('KML');
    expect(route.coordinates).toHaveLength(2);
  });
});
