import { describe, expect, it, vi } from 'vitest';
import { buildWindIndicator, destinationPoint, fetchRouteElevation, filterFiresByWindow } from './geolibre-analysis';
import { parseRouteText } from './route-importer';
import type { Fire } from './types';

const fire: Fire = { id: '1', coordinates: [-3.7, 40.4], name: 'Foco', confidence: 90, intensity: 70, detectedAt: '2026-07-14T10:00:00Z', source: 'NASA FIRMS' };

describe('análisis GeoLibre para METEO', () => {
  it('filtra detecciones por ventana sin aceptar fechas futuras', () => {
    const now = Date.parse('2026-07-14T12:00:00Z');
    const future = { ...fire, id: '2', detectedAt: '2026-07-14T13:00:00Z' };
    expect(filterFiresByWindow([fire, future], 3, now)).toEqual([fire]);
    expect(filterFiresByWindow([fire], 1, now)).toEqual([]);
  });

  it('calcula el extremo del viento hacia sotavento', () => {
    const north = destinationPoint([-3.7, 40.4], 0, 10);
    expect(north[1]).toBeGreaterThan(40.48);
    const indicator = buildWindIndicator([-3.7, 40.4], 270, 10);
    const endpoint = indicator.features[1];
    expect(endpoint.properties?.direction).toBe(90);
    expect(endpoint.properties?.kind).toBe('arrow');
    expect(endpoint.geometry.type).toBe('Point');
  });

  it('genera un perfil de elevación de hasta 100 muestras', async () => {
    const route = parseRouteText(JSON.stringify({ type: 'LineString', coordinates: [[-3.8, 40.3], [-3.7, 40.4], [-3.6, 40.5]] }), 'ruta.geojson');
    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ elevation: [100, 140, 120] }), { status: 200 })) as unknown as typeof fetch;
    const profile = await fetchRouteElevation(route, mockFetch);
    expect(profile).toMatchObject({ minimum: 100, maximum: 140, ascent: 40, descent: 20, sampleCount: 3 });
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
