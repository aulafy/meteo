export type Coordinates = [number, number];

export interface Fire {
  id: string;
  coordinates: Coordinates;
  name: string;
  confidence: number;
  intensity: number;
  frp?: number;
  detectedAt: string;
  source: 'NASA FIRMS';
}

export interface Weather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windGusts?: number;
  windDirection: number;
  precipitation: number;
  label: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  precipitationProbability: number;
}

export interface AirQuality {
  europeanAqi: number;
  pm25: number;
  pm10: number;
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
