import type { Coordinates } from '../../types';

export interface Earthquake {
  id: string;
  coordinates: Coordinates;
  magnitude: number;
  depthKm: number;
  place: string;
  detectedAt: string;
  updatedAt: string;
  status: string;
  alert: string | null;
  url: string;
  source: 'USGS';
}

export interface EarthquakeFeed {
  generatedAt: string;
  earthquakes: Earthquake[];
}
