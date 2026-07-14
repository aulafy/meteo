import type { Coordinates } from '../../types';

export type CataloniaFirePhase = 'active' | 'stabilized' | 'controlled' | 'extinguished' | 'unknown';

export interface CataloniaFireIncident {
  id: string;
  coordinates: Coordinates;
  municipality: string;
  kind: string;
  phase: CataloniaFirePhase;
  resources: number;
  startedAt: string;
  updatedAt: string;
  source: 'Bombers de la Generalitat de Catalunya';
  officialUrl: string;
}

export interface CataloniaFireFeed {
  generatedAt: string;
  incidents: CataloniaFireIncident[];
}
