# METEO

Aplicación web de inteligencia meteorológica, detección temprana de incendios, riesgo ambiental, rutas de evacuación y alertas por proximidad. Sigue el stack geoespacial web de [GeoLibre](https://github.com/opengeos/GeoLibre): React, TypeScript, MapLibre GL y capas GeoJSON.

## Arranque

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. La geolocalización necesita permiso del navegador. Si se deniega, se usa Madrid como escenario de demostración.

## Datos

- Meteorología actual: Open-Meteo, con fallback local.
- Rutas: servidor público OSRM, con fallback a línea directa.
- Focos: NASA FIRMS (VIIRS NOAA-20, NOAA-21 y S-NPP) para España, actualizados por GitHub Actions cada 15 minutos. La `MAP_KEY` se conserva en el secreto `FIRMS_MAP_KEY` y nunca se entrega al navegador.
- Cartografía: OpenFreeMap/MapLibre.

## Despliegue

El proyecto está preparado para Vercel mediante `vercel.json`. Las detecciones FIRMS se publican cada 15 minutos en el feed estático de GitHub Pages y la aplicación desplegada en Vercel consume ese feed sin exponer la clave de NASA. Puede configurarse otro feed mediante `VITE_FIRES_URL`.

### Web Push remoto

El directorio `api/` contiene funciones Vercel para suscribir dispositivos y evaluar alertas. Aplica `supabase/migrations/001_push_alerts.sql` en un proyecto Supabase con PostGIS y configura las variables de `.env.example` en Vercel. Genera las claves mediante `npx web-push generate-vapid-keys`.

El endpoint protegido `GET /api/cron/evaluate-alerts` debe invocarse con `Authorization: Bearer $CRON_SECRET` cada 15 minutos. Solo envía detecciones FIRMS con confianza mínima del 70%, observadas durante las últimas 12 horas y dentro del radio consentido. Deduplica entregas y desactiva suscripciones expiradas.

## Arquitectura de producción recomendada

El cliente nunca debería decidir por sí solo una evacuación real. Un backend debe ingerir NASA FIRMS y fuentes oficiales regionales, normalizar focos en PostGIS, calcular corredores con una red vial y polígonos de propagación, y enviar notificaciones mediante Web Push/SMS. La ruta mostrada debe identificarse siempre como recomendación complementaria a Protección Civil y 112.

## Aviso

Este MVP es demostrativo y no sustituye las instrucciones de emergencias. Para desplegarlo hacen falta validación con autoridades, pruebas de carga, auditoría de privacidad/consentimiento, retención mínima de ubicaciones y redundancia de proveedores.

Las detecciones FIRMS son puntos térmicos observados por satélite, no incendios confirmados ni perímetros operativos. Pueden llegar con retraso debido a la órbita, nubosidad o procesamiento y deben contrastarse con 112, Protección Civil y los servicios autonómicos.

## Licencia

MIT © 2026 Aulafy.
