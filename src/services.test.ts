import { describe, expect, it } from 'vitest';
import { assessRisk, rankFiresByDistance } from './services';
import type { Fire } from './types';

const fires: Fire[] = [
  { id: 'n20-1', coordinates: [-7.9433, 42.3438], name: 'Foco satelital', confidence: 92, intensity: 78, frp: 14, detectedAt: new Date().toISOString(), source: 'NASA FIRMS' },
  { id: 'n21-2', coordinates: [-7.8, 42.4], name: 'Foco satelital', confidence: 81, intensity: 55, frp: 7, detectedAt: new Date().toISOString(), source: 'NASA FIRMS' },
];

describe('motor de seguridad', () => {
  it('incrementa el riesgo cerca de un foco', () => {
    const weather = { temperature: 38, humidity: 18, windSpeed: 35, windDirection: 200, precipitation: 0, label: 'fixture' };
    expect(assessRisk(fires[0].coordinates, fires, weather).score).toBeGreaterThan(assessRisk([-3.3, 40.1], fires, weather).score);
  });
  it('eleva el riesgo cercano y a sotavento', () => {
    const weather = { temperature: 21.1, humidity: 68, windSpeed: 5.9, windGusts: 22, windDirection: 281, precipitation: 0, label: 'fixture' };
    const assessment = assessRisk([-7.88445, 42.33587], [{ ...fires[0], confidence: 70 }], weather);
    expect(assessment.distanceKm).toBeLessThan(5.5);
    expect(['alto', 'extremo']).toContain(assessment.level);
    expect(assessment.reasons).toContain('Tu ubicación está a sotavento de la detección');
  });
  it('ordena los focos por distancia real', () => {
    const ordered = rankFiresByDistance(fires[0].coordinates, [fires[1], fires[0]]);
    expect(ordered[0].fire.id).toBe(fires[0].id);
    expect(ordered[0].distanceKm).toBe(0);
  });
});
