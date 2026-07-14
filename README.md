# METEO

Aplicación web de inteligencia meteorológica, detección temprana de incendios, orientación para residentes y alertas por proximidad. Sigue el stack geoespacial web de [GeoLibre](https://github.com/opengeos/GeoLibre): React, TypeScript, MapLibre GL y capas GeoJSON.

## Arranque

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. La geolocalización necesita permiso del navegador. Si se deniega, METEO mantiene la vista general de España y no presenta distancias ni riesgo como si fueran personales.

## Datos

- Meteorología actual, pronóstico horario y calidad del aire: Open-Meteo.
- Focos: NASA FIRMS (VIIRS NOAA-20, NOAA-21 y S-NPP) para España, actualizados por GitHub Actions cada 15 minutos. La `MAP_KEY` se conserva en el secreto `FIRMS_MAP_KEY` y nunca se entrega al navegador.
- Contexto europeo: Copernicus EFFIS mediante su WMS oficial, con índice meteorológico FWI diario y áreas quemadas NRT de la temporada. Estas capas no confirman una emergencia local ni representan un perímetro operativo.
- Tráfico: incidencias oficiales DGT DATEX II v3.7, normalizadas en el servidor.
- Terremotos: feed GeoJSON global de USGS de las últimas 24 horas, validado y mostrado como capa independiente desactivada por defecto. No modifica el riesgo de incendio ni se interpreta como alerta de tsunami.
- Cartografía: OpenFreeMap/MapLibre.

El mapa conserva las detecciones del feed como contexto, pero el riesgo personal y las notificaciones solo consideran observaciones de confianza igual o superior al 70% y con una antigüedad máxima de 12 horas. La consulta y el filtro geográfico cubren península, Baleares, Canarias, Ceuta y Melilla. Si falla la meteorología, la interfaz muestra el dato como no disponible y el motor no sustituye esos valores por cifras simuladas.

## Integración con MeteoFlow

METEO reutiliza de [aulafy/meteoflow](https://github.com/aulafy/meteoflow), ambos bajo MIT, el patrón de consulta y normalización de Open‑Meteo para pronóstico horario y calidad del aire. Se adaptó al contexto de incendios: muestra viento, rachas, humedad y partículas durante las próximas 12 horas, sin incorporar el paisaje 3D ni elementos meteorológicos que distraigan durante una emergencia.

## Rutas locales y GeoLibre

La herramienta de ruta del mapa acepta GPX, KML y GeoJSON y reproduce el patrón de animación de GeoLibre: flecha orientada, rastro, progreso, velocidad visual y seguimiento opcional. Los archivos se procesan localmente y nunca se presentan como evacuación segura. Consulta el [análisis técnico](docs/route-animation.md) y el [notebook experto](notebooks/geolibre-route-animation.ipynb).

El panel «Capas y análisis» incorpora otros patrones útiles de GeoLibre: relieve 3D, hillshade, imagen satelital contextual, ventanas temporales FIRMS, dirección del viento, perfil de elevación bajo consentimiento y exportación GeoJSON sin el GPS del residente. La [auditoría de integración](docs/geolibre-integration.md) explica qué se reutiliza, qué se descarta y por qué.

## Copernicus EFFIS

Las capas «Peligro meteorológico EFFIS» y «Áreas quemadas EFFIS» se consumen directamente del [WMS oficial](https://maps.effis.emergency.copernicus.eu/effis) y permanecen desactivadas por defecto. El FWI es un índice meteorológico modelado; la cartografía NRT representa daño/huella quemada y no el frente activo. EFFIS reutiliza detecciones FIRMS para sus focos activos, por lo que METEO no los duplica. Consulta la [integración y sus límites](docs/effis-integration.md).

## Tráfico oficial DGT

El backend consulta y normaliza el feed oficial [Incidencias DGT DATEX II v3.7](https://nap.dgt.es/es/dataset/incidencias-dgt-datex2-v3-7). METEO dibuja carreteras, calzadas y carriles cerrados, cortes intermitentes e incidencias de fuego/humo, con fuente y actualización visibles. La cobertura estatal excluye Cataluña y País Vasco y no garantiza vías locales o pistas forestales. Consulta los [límites y funcionamiento](docs/dgt-incidents.md).

## Terremotos USGS

La capa «Terremotos USGS» consume el [feed GeoJSON oficial de las últimas 24 horas](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson), actualizado por USGS cada minuto y consultado por METEO cada cinco minutos. Muestra clustering global, magnitud, profundidad, estado de revisión y enlace al evento oficial. El panel resume los tres terremotos más cercanos si se ha indicado una ubicación o los cinco más recientes si no se ha compartido ninguna; nunca trata el centro inicial de España como la posición del usuario. La capa permanece desactivada por defecto y no participa en el índice de incendios, Groq ni las notificaciones push. El indicador sísmico de USGS no se convierte en una alerta de tsunami; esa función requerirá boletines CAP emitidos por centros oficiales.

## Función de Groq

El endpoint servidor `/api/ai-guidance` convierte únicamente la evaluación estructurada que ya ve el residente, las detecciones FIRMS seleccionadas y las incidencias DGT cercanas en una explicación breve. Recibe las coordenadas públicas de los focos para generar enlaces verificables de Google Maps, pero no recibe el GPS ni las coordenadas de búsqueda del usuario. No calcula el nivel de riesgo, no confirma incendios, no crea rutas y no puede emitir órdenes de evacuación. La clave permanece en `GROQ_API_KEY` dentro de Vercel.

## Despliegue

El proyecto está preparado para Vercel mediante `vercel.json`. Las detecciones FIRMS se publican cada 15 minutos en el feed estático de GitHub Pages y la aplicación desplegada en Vercel consume ese feed sin exponer la clave de NASA. Puede configurarse otro feed mediante `VITE_FIRES_URL`.

### Web Push remoto

El directorio `api/` contiene funciones Vercel para suscribir dispositivos y evaluar alertas. Aplica en orden `supabase/migrations/001_push_alerts.sql` y `supabase/migrations/002_fire_observations.sql` en un proyecto Supabase con PostGIS y configura las variables de `.env.example` en Vercel. Genera las claves mediante `npx web-push generate-vapid-keys`.

El endpoint protegido `GET /api/cron/evaluate-alerts` debe invocarse con `Authorization: Bearer $CRON_SECRET` cada 15 minutos. Ingiere y audita FIRMS en PostGIS. La función SQL `pending_alert_candidates` selecciona mediante `ST_DWithin` la observación más próxima a cada dispositivo, con confianza mínima del 70%, una antigüedad máxima de 12 horas y dentro del radio consentido. Deduplica entregas y desactiva suscripciones expiradas.

La persona puede desactivar los avisos desde la propia app; esto elimina la suscripción y su ubicación. Como límite adicional, el evaluador elimina automáticamente suscripciones que lleven 180 días sin renovarse, observaciones con más de 30 días, auditorías de ingesta con más de 90 días y entregas con más de 365 días. La [documentación de backend](docs/supabase-backend.md) detalla el modelo de seguridad y el orden de despliegue.

## Arquitectura de producción recomendada

El cliente nunca decide por sí solo una evacuación real. El backend ya ingiere FIRMS, normaliza observaciones en PostGIS y calcula proximidad para Web Push. La siguiente fase de producción requiere fuentes operativas de perímetros, carreteras y refugios proporcionadas por autoridades antes de calcular cualquier corredor. Cualquier futura ruta debe identificarse siempre como recomendación complementaria a Protección Civil y 112.

## Aviso

METEO no sustituye las instrucciones de emergencias. Para su adopción pública hacen falta validación con autoridades, pruebas de carga, auditoría de privacidad/consentimiento, retención mínima de ubicaciones y redundancia de proveedores.

Las detecciones FIRMS son puntos térmicos observados por satélite, no incendios confirmados ni perímetros operativos. Pueden llegar con retraso debido a la órbita, nubosidad o procesamiento y deben contrastarse con 112, Protección Civil y los servicios autonómicos.

## Licencia

MIT © 2026 Aulafy.
