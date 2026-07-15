import { z } from 'zod';
import type { CataloniaFireFeed, CataloniaFireIncident, CataloniaFirePhase } from './types';

export const CATALONIA_FIRE_VIEWER_URL = 'https://interior.gencat.cat/ca/arees_dactuacio/bombers/actuacions-de-bombers/index.html';
const ARCGIS_LAYER_URL = 'https://services7.arcgis.com/ZCqVt1fRXwwK6GF4/arcgis/rest/services/ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW/FeatureServer/0';

const query = new URLSearchParams({
  f: 'geojson',
  where: '1=1',
  outFields: 'ESRI_OID,GlobalID,TAL_DESC_ALARMA2,COM_FASE,ACT_NUM_VEH,ACT_DAT_ACTUACIO,ACT_DAT_INICI,DATA_ACT,MUNICIPI_DPX',
  returnGeometry: 'true',
  outSR: '4326',
  resultRecordCount: '2000',
});

export const CATALONIA_FIRE_FEED_URL = `${ARCGIS_LAYER_URL}/query?${query.toString()}`;

const feedSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()).max(2_000),
});

const featureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().finite(), z.number().finite()]),
  }),
  properties: z.object({
    // ACT_NUM_ACTUACIO was removed from the public layer in July 2026.
    // GlobalID/ESRI_OID identify current rows; retain the old field for cached feeds.
    ACT_NUM_ACTUACIO: z.string().min(1).max(128).optional(),
    ESRI_OID: z.number().int().nonnegative().optional(),
    GlobalID: z.string().min(1).max(128).optional(),
    TAL_DESC_ALARMA2: z.string().max(160).nullish(),
    COM_FASE: z.string().max(40).nullish(),
    ACT_NUM_VEH: z.number().int().min(0).max(500).nullish(),
    ACT_DAT_ACTUACIO: z.number().finite().positive(),
    ACT_DAT_INICI: z.number().finite().positive().nullish(),
    DATA_ACT: z.number().finite().positive(),
    MUNICIPI_DPX: z.string().max(120).nullish(),
  }).refine((properties) => properties.GlobalID || properties.ESRI_OID != null || properties.ACT_NUM_ACTUACIO, 'Actuación sin identificador'),
});

const phaseByLabel: Record<string, CataloniaFirePhase> = {
  actiu: 'active',
  activo: 'active',
  estabilitzat: 'stabilized',
  estabilizado: 'stabilized',
  controlat: 'controlled',
  controlado: 'controlled',
  extingit: 'extinguished',
  extinguido: 'extinguished',
};

const normalizePhase = (value: string | null | undefined): CataloniaFirePhase => phaseByLabel[value?.trim().toLocaleLowerCase('ca') ?? ''] ?? 'unknown';

export function parseCataloniaFireFeed(input: unknown, generatedAt = Date.now()): CataloniaFireFeed {
  const feed = feedSchema.parse(input);
  const latestById = new Map<string, CataloniaFireIncident>();

  for (const candidate of feed.features) {
    const parsed = featureSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const { geometry, properties } = parsed.data;
    const [longitude, latitude] = geometry.coordinates;
    // The public layer occasionally contains placeholder geometry. Only retain Catalonia.
    if (longitude < 0.05 || longitude > 3.4 || latitude < 40.45 || latitude > 42.9) continue;
    const sourceId = properties.GlobalID ?? (properties.ESRI_OID != null ? String(properties.ESRI_OID) : properties.ACT_NUM_ACTUACIO);
    const incident: CataloniaFireIncident = {
      id: `bombers-cat-${sourceId}`,
      coordinates: [longitude, latitude],
      municipality: properties.MUNICIPI_DPX?.trim() || 'Municipio no publicado',
      kind: properties.TAL_DESC_ALARMA2?.trim() || 'Incendio de vegetación',
      phase: normalizePhase(properties.COM_FASE),
      resources: properties.ACT_NUM_VEH ?? 0,
      startedAt: new Date(properties.ACT_DAT_INICI ?? properties.ACT_DAT_ACTUACIO).toISOString(),
      updatedAt: new Date(properties.DATA_ACT).toISOString(),
      source: 'Bombers de la Generalitat de Catalunya',
      officialUrl: CATALONIA_FIRE_VIEWER_URL,
    };
    const existing = latestById.get(incident.id);
    if (!existing || Date.parse(incident.updatedAt) > Date.parse(existing.updatedAt)) latestById.set(incident.id, incident);
  }

  return {
    generatedAt: new Date(generatedAt).toISOString(),
    incidents: [...latestById.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
  };
}

export async function fetchCataloniaFireFeed(fetcher: typeof fetch = fetch) {
  const response = await fetcher(CATALONIA_FIRE_FEED_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Bombers Catalunya no disponible (${response.status})`);
  return parseCataloniaFireFeed(await response.json());
}
