import { mkdir, writeFile } from 'node:fs/promises';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-50m.json' with { type: 'json' };

const key = process.env.FIRMS_MAP_KEY;
if (!key) throw new Error('Falta FIRMS_MAP_KEY');

const sensors = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT'];
const spainBounds = '-10,35,5,44';
const confidenceScore = { l: 35, n: 70, h: 95 };
const countries = feature(world, world.objects.countries);
const spain = countries.features.find((country) => String(country.id) === '724');
if (!spain) throw new Error('No se pudo cargar la frontera de España');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function fetchWithRetry(url, sensor, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'METEO/1.0 (+https://github.com/aulafy/meteo)' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} — ${(await response.text()).slice(0, 120)}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 1500);
    }
  }
  throw new Error(`FIRMS ${sensor}: ${lastError instanceof Error ? lastError.message : 'fallo de red'}`);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

const settled = await Promise.allSettled(sensors.map(async (sensor) => {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${sensor}/${spainBounds}/1`;
  return parseCsv(await fetchWithRetry(url, sensor)).map((row) => ({ ...row, sensor }));
}));
const successful = settled.filter((result) => result.status === 'fulfilled');
const failures = settled.filter((result) => result.status === 'rejected');
failures.forEach((result) => console.warn(result.reason instanceof Error ? result.reason.message : result.reason));
if (!successful.length) {
  console.warn('FIRMS no respondió: se conserva el último feed válido sin cambiar generatedAt.');
  process.exit(0);
}
const results = successful.map((result) => result.value);

const seen = new Set();
const fires = results.flat().filter((row) => {
  const id = `${Number(row.latitude).toFixed(4)}:${Number(row.longitude).toFixed(4)}:${row.acq_date}:${row.acq_time}`;
  if (seen.has(id)) return false;
  seen.add(id);
  return Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude));
}).filter((row) => booleanPointInPolygon(point([Number(row.longitude), Number(row.latitude)]), spain)).map((row, index) => {
  const confidence = Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : (confidenceScore[row.confidence] ?? 60);
  const frp = Math.max(0, Number(row.frp) || 0);
  const hhmm = String(row.acq_time || '0000').padStart(4, '0');
  return {
    id: `firms-${row.acq_date}-${hhmm}-${index}`,
    coordinates: [Number(row.longitude), Number(row.latitude)],
    name: `Foco satelital ${row.satellite || 'VIIRS'}`,
    confidence,
    intensity: Math.round(Math.min(100, 20 + Math.log1p(frp) * 18)),
    frp,
    detectedAt: `${row.acq_date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`,
    source: 'NASA FIRMS',
    sensor: row.sensor,
  };
}).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

await mkdir('public', { recursive: true });
await writeFile('public/fires.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), country: 'ESP', source: 'NASA FIRMS', sensorsAvailable: successful.length, sensorsExpected: sensors.length, fires }, null, 2)}\n`);
console.log(`FIRMS: ${fires.length} detecciones publicadas desde ${successful.length}/${sensors.length} sensores`);
