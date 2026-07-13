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
});
