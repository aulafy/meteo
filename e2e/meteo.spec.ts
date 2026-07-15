import { expect, test, type Page } from '@playwright/test';

const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XKkYVwAAAABJRU5ErkJggg==', 'base64');

async function installStableSources(page: Page, options: { failFirms?: () => boolean } = {}) {
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const detectedAt = new Date(now - 5 * 60_000).toISOString();

  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
    return route.abort();
  });

  await page.route('https://tiles.openfreemap.org/styles/positron', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ version: 8, name: 'METEO E2E', sources: {}, layers: [] }),
  }));
  await page.route('https://demotiles.maplibre.org/terrain-tiles/tiles.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tilejson: '2.2.0', tiles: ['https://e2e.invalid/dem/{z}/{x}/{y}.png'], minzoom: 0, maxzoom: 0, bounds: [-180, -85, 180, 85] }),
  }));

  await page.route('https://aulafy.github.io/meteo/fires.json', (route) => {
    if (options.failFirms?.()) return route.abort('failed');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt,
        fires: [{
          id: 'e2e-fire',
          coordinates: [-3.7, 40.4],
          name: 'Foco satelital de prueba',
          confidence: 90,
          intensity: 70,
          frp: 12.3,
          detectedAt,
          source: 'NASA FIRMS',
        }],
      }),
    });
  });
  await page.route('**/api/dgt-incidents', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ source: 'DGT DATEX II v3.7', publishedAt: generatedAt, coverage: 'Prueba E2E', incidents: [] }),
  }));
  await page.route('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ type: 'FeatureCollection', metadata: { generated: now, count: 0 }, features: [] }),
  }));
  await page.route('https://services7.arcgis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
  }));
  await page.route('https://api.open-meteo.com/v1/forecast**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('current')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ current: { temperature_2m: 27, relative_humidity_2m: 38, precipitation: 0, wind_speed_10m: 14, wind_direction_10m: 270, wind_gusts_10m: 24 } }),
      });
    }
    const times = Array.from({ length: 12 }, (_, index) => new Date(now + index * 3_600_000).toISOString());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hourly: {
        time: times,
        temperature_2m: times.map(() => 27),
        relative_humidity_2m: times.map(() => 38),
        precipitation_probability: times.map(() => 0),
        wind_speed_10m: times.map(() => 14),
        wind_gusts_10m: times.map(() => 24),
        wind_direction_10m: times.map(() => 270),
      } }),
    });
  });
  await page.route('https://air-quality-api.open-meteo.com/v1/air-quality**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ current: { european_aqi: 21, pm2_5: 5, pm10: 11 } }),
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('mide sobre el mapa y mantiene la vista móvil contenida', async ({ page }) => {
  await installStableSources(page);
  await page.goto('/');
  await expect(page.getByText('Foco satelital de prueba')).toBeAttached();
  await page.getByRole('button', { name: 'Medir distancias' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await canvas.click({ position: { x: Math.round(bounds!.width * 0.28), y: Math.round(bounds!.height * 0.46) } });
  await canvas.click({ position: { x: Math.round(bounds!.width * 0.58), y: Math.round(bounds!.height * 0.61) } });
  await expect(page.locator('.measurement-card')).toContainText(/(m|km) geodésicos/);
  await expect(page.locator('.measurement-card')).toContainText('No es una distancia de evacuación');
  await expectNoHorizontalOverflow(page);
});

test('compara capas con transparencia y explica sus límites', async ({ page }) => {
  await installStableSources(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Capas y análisis GeoLibre' }).click();
  const satellite = page.locator('label.map-layer-switch', { hasText: 'Imagen satelital' }).locator('input');
  await satellite.check();
  const opacity = page.getByLabel('Opacidad de imagen satelital');
  await opacity.fill('37');
  await expect(opacity).toHaveValue('37');
  await expect(page.locator('.layer-comparison-note')).toContainText('No compara fechas equivalentes');
  await expectNoHorizontalOverflow(page);
});

test('recupera FIRMS desde copia local y bloquea la IA', async ({ page }) => {
  let failFirms = false;
  await installStableSources(page, { failFirms: () => failFirms });
  await page.goto('/');
  await expect(page.getByText('Foco satelital de prueba')).toBeAttached();
  failFirms = true;
  await page.reload();
  await page.getByRole('button', { name: 'Abrir panel de información' }).click();
  await expect(page.getByText('Copia local de contexto: puede faltar un foco reciente o mostrarse uno ya extinguido.')).toBeVisible();
  await expect(page.getByRole('button', { name: /focos más recientes con IA/i })).toBeDisabled();
  await expect(page.getByText('COPIA LOCAL · NO EN VIVO')).toBeAttached();
  await expectNoHorizontalOverflow(page);
});

test('mantiene panel y controles dentro del escritorio', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installStableSources(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Capas y análisis GeoLibre' }).click();
  const panel = page.locator('.map-layer-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Imprimir parte de situación' })).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
  await expectNoHorizontalOverflow(page);
});

test('carga el importador de rutas solo después de elegir un archivo', async ({ page }) => {
  let importerRequested = false;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/src/route-importer.ts')) importerRequested = true;
  });
  await installStableSources(page);
  await page.goto('/');
  await expect(page.getByText('Foco satelital de prueba')).toBeAttached();
  expect(importerRequested).toBe(false);
  await page.getByRole('button', { name: 'Cargar ruta local' }).click();
  await page.getByLabel(/Entiendo que METEO no ha verificado esta ruta/).check();
  await page.getByLabel('Seleccionar archivo de ruta').setInputFiles({
    name: 'referencia-e2e.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(JSON.stringify({ type: 'LineString', coordinates: [[-3.8, 40.3], [-3.7, 40.4], [-3.6, 40.5]] })),
  });
  await expect.poll(() => importerRequested).toBe(true);
  await expect(page.locator('.route-animation')).toContainText('referencia-e2e');
  await expect(page.locator('.route-animation')).toContainText('solo referencia');
  await expectNoHorizontalOverflow(page);
});
