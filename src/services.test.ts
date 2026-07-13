import { describe, expect, it } from 'vitest';
import { assessRisk, getActionGuidance, isActionableFire, parseFireFeed, rankFiresByDistance, windDirectionToCardinal } from './services';
import type { Fire } from './types';

const fires: Fire[] = [
  { id: 'n20-1', coordinates: [-7.9433, 42.3438], name: 'Foco satelital', confidence: 92, intensity: 78, frp: 14, detectedAt: new Date().toISOString(), source: 'NASA FIRMS' },
  { id: 'n21-2', coordinates: [-7.8, 42.4], name: 'Foco satelital', confidence: 81, intensity: 55, frp: 7, detectedAt: new Date().toISOString(), source: 'NASA FIRMS' },
];

describe('motor de seguridad', () => {
  it('incrementa el riesgo cerca de un foco', () => {
    const weather = { available: true, temperature: 38, humidity: 18, windSpeed: 35, windDirection: 200, precipitation: 0, label: 'fixture' };
    expect(assessRisk(fires[0].coordinates, fires, weather).score).toBeGreaterThan(assessRisk([-3.3, 40.1], fires, weather).score);
  });
  it('eleva el riesgo cercano y a sotavento', () => {
    const weather = { available: true, temperature: 21.1, humidity: 68, windSpeed: 5.9, windGusts: 22, windDirection: 281, precipitation: 0, label: 'fixture' };
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
  it('da instrucciones críticas sin inventar una ruta', () => {
    const guidance = getActionGuidance({ score: 82, level: 'extremo', nearestFire: fires[0], distanceKm: 3, reasons: [], etaMinutes: 0, isDownwind: true });
    expect(guidance.urgency).toBe('critica');
    expect(guidance.steps.join(' ')).toContain('112');
    expect(guidance.steps.join(' ').toLowerCase()).not.toContain('ruta recomendada');
  });
  it('traduce la dirección del viento a puntos cardinales', () => {
    expect(windDirectionToCardinal(90)).toBe('E');
    expect(windDirectionToCardinal(225)).toBe('SO');
  });
  it('rechaza un feed FIRMS con coordenadas fuera de España', () => {
    expect(() => parseFireFeed({ generatedAt: new Date().toISOString(), fires: [{ ...fires[0], coordinates: [20, 50] }] })).toThrow();
  });
  it('acepta un feed FIRMS bien formado', () => {
    expect(parseFireFeed({ generatedAt: new Date().toISOString(), fires }).fires).toHaveLength(2);
  });
  it('no usa una detección antigua o de baja confianza para el riesgo personal', () => {
    const weather = { available: true, temperature: 38, humidity: 18, windSpeed: 35, windDirection: 200, precipitation: 0, label: 'fixture' };
    const oldFire = { ...fires[0], detectedAt: new Date(Date.now() - 13 * 3600000).toISOString() };
    const lowConfidenceFire = { ...fires[1], confidence: 69 };
    const assessment = assessRisk(fires[0].coordinates, [oldFire, lowConfidenceFire], weather);
    expect(assessment.score).toBe(0);
    expect(assessment.nearestFire).toBeUndefined();
  });
  it('no convierte ceros meteorológicos en sequedad extrema si faltan datos', () => {
    const unavailableWeather = { available: false, temperature: 0, humidity: 0, windSpeed: 0, windDirection: 0, precipitation: 0, label: 'Meteorología no disponible' };
    const assessment = assessRisk([-3.3, 40.1], fires, unavailableWeather);
    expect(assessment.reasons).toContain('Meteorología no disponible; evaluación incompleta');
    expect(assessment.reasons.join(' ')).not.toContain('Humedad crítica');
  });
  it('rechaza observaciones futuras como accionables', () => {
    expect(isActionableFire({ ...fires[0], detectedAt: new Date(Date.now() + 3600000).toISOString() })).toBe(false);
  });
});
