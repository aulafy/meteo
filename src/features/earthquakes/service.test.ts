import { describe, expect, it, vi } from 'vitest';
import { fetchUsgsEarthquakes, parseUsgsEarthquakes, USGS_EARTHQUAKES_URL } from './service';

const validFeed = {
  type: 'FeatureCollection',
  metadata: { generated: Date.parse('2026-07-14T10:00:00Z'), count: 2 },
  features: [{
    id: 'us7000test',
    properties: { mag: 4.2, place: '10 km al norte de Test', time: Date.parse('2026-07-14T09:30:00Z'), updated: Date.parse('2026-07-14T09:40:00Z'), url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000test', status: 'reviewed', alert: null, type: 'earthquake' },
    geometry: { type: 'Point', coordinates: [-3.7, 40.4, 12.5] },
  }, {
    id: 'quarry',
    properties: { mag: 1.1, place: 'Cantera', time: Date.parse('2026-07-14T09:20:00Z'), updated: Date.parse('2026-07-14T09:21:00Z'), url: 'https://earthquake.usgs.gov/earthquakes/eventpage/quarry', status: 'automatic', alert: null, type: 'quarry blast' },
    geometry: { type: 'Point', coordinates: [-4, 39, 0] },
  }],
};

describe('adaptador de terremotos USGS', () => {
  it('normaliza únicamente terremotos sin inventar confianza ni alertas de tsunami', () => {
    const feed = parseUsgsEarthquakes(validFeed);
    expect(feed.earthquakes).toHaveLength(1);
    expect(feed.earthquakes[0]).toMatchObject({ id: 'us7000test', magnitude: 4.2, depthKm: 12.5, status: 'reviewed', source: 'USGS' });
    expect(feed.earthquakes[0]).not.toHaveProperty('confidence');
    expect(feed.earthquakes[0]).not.toHaveProperty('tsunami');
  });

  it('rechaza coordenadas y enlaces que no sean de USGS', () => {
    expect(() => parseUsgsEarthquakes({ ...validFeed, features: [{ ...validFeed.features[0], geometry: { type: 'Point', coordinates: [220, 40, 2] } }] })).toThrow();
    expect(() => parseUsgsEarthquakes({ ...validFeed, features: [{ ...validFeed.features[0], properties: { ...validFeed.features[0].properties, url: 'https://example.com/event' } }] })).toThrow();
  });

  it('consulta el feed diario oficial sin usar una API no verificada', async () => {
    const mockFetch = vi.fn(async () => new Response(JSON.stringify(validFeed), { status: 200 })) as unknown as typeof fetch;
    const feed = await fetchUsgsEarthquakes(mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(USGS_EARTHQUAKES_URL, { cache: 'no-store' });
    expect(feed.earthquakes[0].id).toBe('us7000test');
  });
});
