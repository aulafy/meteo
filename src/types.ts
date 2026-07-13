export type Coordinates = [number, number];

export interface Fire {
  id: string;
  coordinates: Coordinates;
  name: string;
  confidence: number;
  intensity: number;
  frp?: number;
  detectedAt: string;
  source: 'NASA FIRMS' | 'Demo';
}

export interface Weather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  label: string;
}

export interface SafePlace {
  id: string;
  name: string;
  type: 'refugio' | 'hospital' | 'punto seguro';
  coordinates: Coordinates;
  capacity: string;
}

export type RiskLevel = 'bajo' | 'moderado' | 'alto' | 'extremo';

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  nearestFire?: Fire;
  distanceKm: number;
  reasons: string[];
  etaMinutes: number;
}
