import { describe, expect, it } from 'vitest';
import { buildEffisBurnedAreaTileUrl, buildEffisFwiImageUrl, buildEffisLegendUrl, effisDate } from './effis';

const date = new Date('2026-07-14T01:00:00Z');

describe('capas oficiales EFFIS', () => {
  it('genera una imagen FWI diaria en EPSG:4326', () => {
    const url = decodeURIComponent(buildEffisFwiImageUrl(date));
    expect(url).toContain('LAYERS=mf010.fwi');
    expect(url).toContain('SRS=EPSG:4326');
    expect(url).toContain('BBOX=-19,27,5,44.5');
    expect(url).toContain('TIME=2026-07-14');
  });

  it('genera teselas de área quemada para la temporada actual', () => {
    const url = decodeURIComponent(buildEffisBurnedAreaTileUrl(date));
    expect(url).toContain('LAYERS=effis.nrt.ba.poly');
    expect(url).toContain('SRS=EPSG:900913');
    expect(url).toContain('BBOX={bbox-epsg-3857}');
    expect(url).toContain('TIME=2026-01-01/2026-07-14');
  });

  it('mantiene fecha y leyendas deterministas', () => {
    expect(effisDate(date)).toBe('2026-07-14');
    expect(effisDate(new Date('2026-07-13T23:30:00Z'))).toBe('2026-07-14');
    expect(buildEffisLegendUrl('fwi')).toContain('LAYER=mf010.fwi');
  });
});
