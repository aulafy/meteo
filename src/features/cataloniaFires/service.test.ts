import { describe, expect, it, vi } from 'vitest';
import { CATALONIA_FIRE_FEED_URL, fetchCataloniaFireFeed, parseCataloniaFireFeed } from './service';
import { cataloniaFireResourcesLabel, isOperationalCataloniaFire, selectCataloniaFiresForSummary } from './selectors';

const feature = (overrides: Record<string, unknown> = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [2.1, 41.5] },
  properties: {
    GlobalID: 'current-global-id',
    ESRI_OID: 260000001,
    TAL_DESC_ALARMA2: 'Incendi vegetació forestal',
    COM_FASE: 'Estabilitzat',
    ACT_NUM_VEH: 7,
    ACT_DAT_ACTUACIO: Date.parse('2026-07-14T10:00:00Z'),
    ACT_DAT_INICI: Date.parse('2026-07-14T10:01:00Z'),
    DATA_ACT: Date.parse('2026-07-14T11:00:00Z'),
    MUNICIPI_DPX: 'Municipi de prova',
    ...overrides,
  },
});

describe('adaptador de actuaciones de Bombers Catalunya', () => {
  it('normaliza fase, geometría y dotaciones sin inventar confianza o intensidad', () => {
    const feed = parseCataloniaFireFeed({ type: 'FeatureCollection', features: [feature()] }, Date.parse('2026-07-14T11:30:00Z'));
    expect(feed.incidents).toHaveLength(1);
    expect(feed.incidents[0]).toMatchObject({ municipality: 'Municipi de prova', phase: 'stabilized', resources: 7, coordinates: [2.1, 41.5] });
    expect(feed.incidents[0]).not.toHaveProperty('confidence');
    expect(feed.incidents[0]).not.toHaveProperty('intensity');
  });

  it('usa el identificador global actual de ArcGIS y conserva compatibilidad con el campo antiguo', () => {
    const current = parseCataloniaFireFeed({ type: 'FeatureCollection', features: [feature()] }).incidents[0];
    const legacyFeature = feature({ GlobalID: undefined, ESRI_OID: undefined, ACT_NUM_ACTUACIO: 'legacy-42' });
    const legacy = parseCataloniaFireFeed({ type: 'FeatureCollection', features: [legacyFeature] }).incidents[0];
    expect(current.id).toBe('bombers-cat-current-global-id');
    expect(legacy.id).toBe('bombers-cat-legacy-42');
  });

  it('descarta geometrías placeholder y conserva solo la versión más reciente de una actuación', () => {
    const feed = parseCataloniaFireFeed({ type: 'FeatureCollection', features: [
      feature({ DATA_ACT: Date.parse('2026-07-14T10:00:00Z'), COM_FASE: null }),
      feature({ DATA_ACT: Date.parse('2026-07-14T12:00:00Z'), COM_FASE: 'Controlat' }),
      { ...feature(), geometry: { type: 'Point', coordinates: [-1.48, 0] }, properties: { ...feature().properties, GlobalID: 'invalid' } },
    ] });
    expect(feed.incidents).toHaveLength(1);
    expect(feed.incidents[0].phase).toBe('controlled');
  });

  it('solo trata fases desconocidas como operativas si se actualizaron en las últimas 24 horas', () => {
    const now = Date.parse('2026-07-14T12:00:00Z');
    const recent = parseCataloniaFireFeed({ type: 'FeatureCollection', features: [feature({ COM_FASE: null, DATA_ACT: now - 60_000 })] }, now).incidents[0];
    const stale = { ...recent, id: 'stale', updatedAt: new Date(now - 25 * 60 * 60_000).toISOString() };
    expect(isOperationalCataloniaFire(recent, now)).toBe(true);
    expect(isOperationalCataloniaFire(stale, now)).toBe(false);
    expect(selectCataloniaFiresForSummary(null, [stale, recent], now)).toHaveLength(1);
  });

  it('rotula correctamente una o varias dotaciones', () => {
    expect(cataloniaFireResourcesLabel(1)).toBe('1 dotación');
    expect(cataloniaFireResourcesLabel(7)).toBe('7 dotaciones');
  });

  it('consulta exclusivamente el servicio cartográfico público de la Generalitat', async () => {
    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [feature()] }), { status: 200 })) as unknown as typeof fetch;
    const feed = await fetchCataloniaFireFeed(mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(CATALONIA_FIRE_FEED_URL, { cache: 'no-store' });
    expect(CATALONIA_FIRE_FEED_URL).toContain('services7.arcgis.com/ZCqVt1fRXwwK6GF4');
    expect(CATALONIA_FIRE_FEED_URL).toContain('GlobalID');
    expect(CATALONIA_FIRE_FEED_URL).toContain('ESRI_OID');
    expect(CATALONIA_FIRE_FEED_URL).not.toContain('ACT_NUM_ACTUACIO');
    expect(feed.incidents).toHaveLength(1);
  });
});
