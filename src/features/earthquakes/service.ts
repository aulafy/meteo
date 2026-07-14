import { z } from 'zod';
import type { EarthquakeFeed } from './types';

export const USGS_EARTHQUAKES_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

const featureSchema = z.object({
  id: z.string().min(1).max(120),
  properties: z.object({
    mag: z.number().min(-2).max(10),
    place: z.string().max(240).nullable(),
    time: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    url: z.string().url().refine((value) => {
      const hostname = new URL(value).hostname;
      return hostname === 'usgs.gov' || hostname.endsWith('.usgs.gov');
    }, 'URL USGS inválida'),
    status: z.string().min(1).max(40),
    alert: z.enum(['green', 'yellow', 'orange', 'red']).nullable(),
    type: z.string().max(80),
  }),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
      z.number().min(-20).max(1000),
    ]),
  }),
});

const feedSchema = z.object({
  type: z.literal('FeatureCollection'),
  metadata: z.object({ generated: z.number().int().nonnegative(), count: z.number().int().nonnegative() }),
  features: z.array(featureSchema).max(20_000),
});

export function parseUsgsEarthquakes(input: unknown): EarthquakeFeed {
  const feed = feedSchema.parse(input);
  return {
    generatedAt: new Date(feed.metadata.generated).toISOString(),
    earthquakes: feed.features
      .filter((feature) => feature.properties.type === 'earthquake')
      .map((feature) => ({
        id: feature.id,
        coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
        magnitude: feature.properties.mag,
        depthKm: feature.geometry.coordinates[2],
        place: feature.properties.place || 'Ubicación no especificada por USGS',
        detectedAt: new Date(feature.properties.time).toISOString(),
        updatedAt: new Date(feature.properties.updated).toISOString(),
        status: feature.properties.status,
        alert: feature.properties.alert,
        url: feature.properties.url,
        source: 'USGS',
      })),
  };
}

export async function fetchUsgsEarthquakes(fetcher: typeof fetch = fetch) {
  const response = await fetcher(USGS_EARTHQUAKES_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`USGS no disponible (${response.status})`);
  return parseUsgsEarthquakes(await response.json());
}
