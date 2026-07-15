import { describe, expect, it, vi } from 'vitest';
import handler, { AI_SYSTEM_PROMPT, aiInputSchema, buildFireOverview, buildNoLocationGuidance, googleMapsLink } from './ai-guidance.js';
import { resetRateLimitStateForTests, type ApiResponse } from './_lib.js';

const noLocationSituation = {
  locationProvided: false,
  locationLabel: null,
  riskLevel: null,
  riskScore: null,
  distanceKm: null,
  confidence: null,
  frp: null,
  weather: { available: false, temperature: 0, humidity: 0, windSpeed: 0, windDirection: 0 },
  reasons: [],
  fires: [{ name: 'Foco satelital N20', coordinates: [-3.7038, 40.4168], detectedAt: '2026-07-14T08:30:00Z', confidence: 92, frp: 14.2, distanceKm: null }],
  route: { state: 'none', verified: false },
  traffic: { available: true, publishedAt: null, coverage: 'Red estatal excepto Cataluña y País Vasco', incidents: [] },
} as const;

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
    expect(AI_SYSTEM_PROMPT).toContain('riskLevel y riskScore son null');
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

  it('prohíbe índices territoriales y genera orientación determinista sin ubicación', () => {
    expect(aiInputSchema.safeParse(noLocationSituation).success).toBe(true);
    expect(aiInputSchema.safeParse({ ...noLocationSituation, riskLevel: 'alto', riskScore: 65 }).success).toBe(false);
    const guidance = buildNoLocationGuidance(noLocationSituation);
    expect(guidance).toContain('No se ha calculado un nivel de riesgo para ninguna persona o municipio');
    expect(guidance).toContain('elige un municipio o activa el GPS');
    expect(guidance).not.toContain('riesgo alto');
  });

  it('responde sin Groq cuando falta ubicación y no transmite un índice ficticio', async () => {
    resetRateLimitStateForTests();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
    const response: ApiResponse = {
      status(code) { result.status = code; return this; },
      setHeader(name, value) { result.headers[name] = value; return this; },
      json(data) { result.body = data; },
    };
    await handler({ method: 'POST', headers: { 'x-forwarded-for': 'no-location-test' }, body: noLocationSituation }, response);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ model: 'METEO' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
