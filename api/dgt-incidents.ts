import { type ApiRequest, type ApiResponse, json } from './_lib.js';
import { parseDgtDatex } from './_lib/dgt.js';

const DGT_DATEX_URL = 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return json(response, { error: 'Método no permitido' }, 405);
  try {
    const upstream = await fetch(DGT_DATEX_URL, {
      headers: { 'User-Agent': 'METEO/0.1 (+https://github.com/aulafy/meteo)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) throw new Error(`DGT ${upstream.status}`);
    const parsed = parseDgtDatex(await upstream.text());
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return json(response, {
      source: 'DGT DATEX II v3.7',
      sourceUrl: 'https://nap.dgt.es/es/dataset/incidencias-dgt-datex2-v3-7',
      coverage: 'Red estatal excepto Cataluña y País Vasco',
      ...parsed,
    });
  } catch {
    return json(response, { error: 'Las incidencias DGT no están disponibles temporalmente' }, 502);
  }
}
