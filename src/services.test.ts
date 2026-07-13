import { describe, expect, it } from 'vitest';
import { assessRisk, chooseSafePlace } from './services';
import { demoFires, safePlaces } from './data';

describe('motor de seguridad', () => {
  it('incrementa el riesgo cerca de un foco', () => {
    const weather = { temperature: 38, humidity: 18, windSpeed: 35, windDirection: 200, precipitation: 0, label: 'test' };
    const close = assessRisk(demoFires[0].coordinates, demoFires, weather);
    const far = assessRisk([-3.3, 40.1], demoFires, weather);
    expect(close.score).toBeGreaterThan(far.score);
  });
  it('elige un punto seguro válido', () => {
    expect(safePlaces).toContain(chooseSafePlace([-3.7, 40.42], demoFires, safePlaces));
  });
  it('eleva a alto el riesgo de un residente a 5 km y a sotavento', () => {
    const fire = { ...demoFires[0], coordinates: [-7.9433, 42.34381] as [number, number], confidence: 70, intensity: 60 };
    const weather = { temperature: 21.1, humidity: 68, windSpeed: 5.9, windGusts: 22, windDirection: 281, precipitation: 0, label: 'test' };
    const assessment = assessRisk([-7.88445, 42.33587], [fire], weather);
    expect(assessment.distanceKm).toBeLessThan(5.5);
    expect(['alto', 'extremo']).toContain(assessment.level);
    expect(assessment.reasons).toContain('Tu ubicación está a sotavento de la detección');
  });
});
