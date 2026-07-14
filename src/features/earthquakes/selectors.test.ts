import { describe, expect, it } from 'vitest';
import type { Earthquake } from './types';
import { rankEarthquakesByDistance, selectEarthquakesForSummary } from './selectors';

const earthquake = (id: string, coordinates: [number, number], detectedAt: string): Earthquake => ({
  id,
  coordinates,
  magnitude: 3.2,
  depthKm: 8,
  place: `Evento ${id}`,
  detectedAt,
  updatedAt: detectedAt,
  status: 'reviewed',
  alert: null,
  url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
  source: 'USGS',
});

describe('selección de terremotos para residentes', () => {
  const events = [
    earthquake('far', [15, 45], '2026-07-14T08:00:00Z'),
    earthquake('near', [-3.7, 40.4], '2026-07-14T07:00:00Z'),
    earthquake('middle', [2.1, 41.4], '2026-07-14T09:00:00Z'),
    earthquake('latest', [-120, 35], '2026-07-14T11:00:00Z'),
    earthquake('older', [140, -30], '2026-07-14T06:00:00Z'),
    earthquake('oldest', [100, 10], '2026-07-14T05:00:00Z'),
  ];

  it('devuelve los tres eventos más próximos cuando existe una ubicación', () => {
    const selected = selectEarthquakesForSummary([-3.7, 40.4], events);
    expect(selected).toHaveLength(3);
    expect(selected.map(({ earthquake: event }) => event.id)).toEqual(['near', 'middle', 'far']);
    expect(selected[0].distanceKm).toBeCloseTo(0, 5);
  });

  it('devuelve los cinco eventos más recientes sin tratar España como ubicación del usuario', () => {
    const selected = selectEarthquakesForSummary(null, events);
    expect(selected).toHaveLength(5);
    expect(selected.map(({ earthquake: event }) => event.id)).toEqual(['latest', 'middle', 'far', 'near', 'older']);
    expect(selected.every(({ distanceKm }) => distanceKm === null)).toBe(true);
  });

  it('ordena todas las distancias sin modificar la entrada', () => {
    const input = [...events];
    const ranked = rankEarthquakesByDistance([-3.7, 40.4], input);
    expect(ranked[0].earthquake.id).toBe('near');
    expect(input).toEqual(events);
  });
});
