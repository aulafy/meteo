import { describe, expect, it } from 'vitest';
import { fireObservationRows, parseFirmsFeed } from './fires.js';

const validFeed = {
  generatedAt: '2026-07-14T00:00:00Z',
  fires: [{
    id: 'viirs-1', coordinates: [-0.4, 39.4], name: 'Foco satelital', confidence: 82,
    intensity: 41, frp: 12.5, detectedAt: '2026-07-13T23:30:00Z', source: 'NASA FIRMS',
  }],
};

describe('normalización FIRMS del backend', () => {
  it('convierte el feed en filas PostGIS sin conservar campos innecesarios', () => {
    const feed = parseFirmsFeed(validFeed);
    expect(fireObservationRows(feed.fires, '2026-07-14T00:01:00Z')).toEqual([expect.objectContaining({
      source_id: 'viirs-1', longitude: -0.4, latitude: 39.4, confidence: 82,
      detected_at: '2026-07-13T23:30:00Z', ingested_at: '2026-07-14T00:01:00Z',
    })]);
  });

  it('rechaza coordenadas fuera de España y fuentes simuladas', () => {
    expect(() => parseFirmsFeed({ ...validFeed, fires: [{ ...validFeed.fires[0], coordinates: [20, 60] }] })).toThrow();
    expect(() => parseFirmsFeed({ ...validFeed, fires: [{ ...validFeed.fires[0], source: 'demo' }] })).toThrow();
  });

  it('acepta observaciones en Canarias', () => {
    const feed = parseFirmsFeed({ ...validFeed, fires: [{ ...validFeed.fires[0], coordinates: [-15.43, 28.12] }] });
    expect(feed.fires[0].coordinates).toEqual([-15.43, 28.12]);
  });
});
