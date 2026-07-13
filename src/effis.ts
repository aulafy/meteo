const EFFIS_WMS = 'https://maps.effis.emergency.copernicus.eu/effis';

export const EFFIS_VIEWER_URL = 'https://forest-fire.emergency.copernicus.eu/apps/effis_current_situation/';
export const EFFIS_LICENSE_URL = 'https://forest-fire.emergency.copernicus.eu/about-effis/data-license';
export const EFFIS_ATTRIBUTION = 'EFFIS/Copernicus · © Unión Europea · CC BY 4.0';
export const EFFIS_SPAIN_IMAGE_COORDINATES: [[number, number], [number, number], [number, number], [number, number]] = [
  [-19, 44.5], [5, 44.5], [5, 27], [-19, 27],
];

export function effisDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function buildEffisFwiImageUrl(date = new Date()) {
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: 'mf010.fwi',
    STYLES: 'default', FORMAT: 'image/png', TRANSPARENT: 'true', SRS: 'EPSG:4326',
    BBOX: '-19,27,5,44.5', WIDTH: '1400', HEIGHT: '1000', TIME: effisDate(date),
  });
  return `${EFFIS_WMS}?${params.toString()}`;
}

export function buildEffisBurnedAreaTileUrl(date = new Date()) {
  const current = effisDate(date);
  const seasonStart = `${current.slice(0, 4)}-01-01`;
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: 'effis.nrt.ba.poly',
    STYLES: 'default', FORMAT: 'image/png', TRANSPARENT: 'true', SRS: 'EPSG:900913',
    BBOX: '__METEO_BBOX__', WIDTH: '256', HEIGHT: '256', TIME: `${seasonStart}/${current}`,
  });
  return `${EFFIS_WMS}?${params.toString()}`.replace('__METEO_BBOX__', '{bbox-epsg-3857}');
}

export function buildEffisLegendUrl(layer: 'fwi' | 'burned-areas') {
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetLegendGraphic',
    LAYER: layer === 'fwi' ? 'mf010.fwi' : 'effis.nrt.ba.poly', FORMAT: 'image/png', STYLE: 'default',
  });
  return `${EFFIS_WMS}?${params.toString()}`;
}
