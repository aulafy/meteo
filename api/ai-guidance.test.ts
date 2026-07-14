import { describe, expect, it } from 'vitest';
import { AI_SYSTEM_PROMPT, buildFireOverview, googleMapsLink } from './ai-guidance.js';

describe('prompt de situación', () => {
  it('prohíbe inventar rutas y cortes', () => {
    expect(AI_SYSTEM_PROMPT).toContain('NO dispone de una ruta de evacuación verificada');
    expect(AI_SYSTEM_PROMPT).toContain('Solo menciona cortes o afecciones incluidos en traffic.incidents');
    expect(AI_SYSTEM_PROMPT).toContain('no cubren Cataluña ni País Vasco');
  });
  it('distingue tres focos cercanos de cinco focos recientes', () => {
    expect(AI_SYSTEM_PROMPT).toContain('hasta 3 detecciones más cercanas');
    expect(AI_SYSTEM_PROMPT).toContain('hasta 5 detecciones más recientes');
    expect(AI_SYSTEM_PROMPT).toContain('no confirma por sí sola un incendio');
  });
  it('genera un listado verificable con enlace a Google Maps', () => {
    const overview = buildFireOverview({
      locationProvided: true,
      locationLabel: 'Valencia',
      fires: [{ name: 'Foco satelital N20', coordinates: [-0.3763, 39.4699], detectedAt: '2026-07-14T08:30:00Z', confidence: 92, frp: 14.2, distanceKm: 4.7 }],
    });
    expect(overview).toContain('1 detección térmica más cercana a Valencia');
    expect(overview).toContain('4.7 km');
    expect(overview).toContain('39.46990, -0.37630');
    expect(overview).toContain('https://www.google.com/maps/search/?api=1&query=39.4699,-0.3763');
    expect(googleMapsLink([-3.7038, 40.4168])).toBe('https://www.google.com/maps/search/?api=1&query=40.4168,-3.7038');
  });
});
