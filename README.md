# Fuego Seguro

MVP web de detección temprana de incendios, riesgo meteorológico, rutas de evacuación y alertas por proximidad. Sigue el stack geoespacial web de [GeoLibre](https://github.com/opengeos/GeoLibre): React, TypeScript, MapLibre GL y capas GeoJSON.

## Arranque

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. La geolocalización necesita permiso del navegador. Si se deniega, se usa Madrid como escenario de demostración.

## Datos

- Meteorología actual: Open-Meteo, con fallback local.
- Rutas: servidor público OSRM, con fallback a línea directa.
- Focos: datos de demostración listos para sustituirse por NASA FIRMS. FIRMS requiere `MAP_KEY`; en producción debe consultarse desde un backend para no exponer la clave.
- Cartografía: OpenFreeMap/MapLibre.

## Arquitectura de producción recomendada

El cliente nunca debería decidir por sí solo una evacuación real. Un backend debe ingerir NASA FIRMS y fuentes oficiales regionales, normalizar focos en PostGIS, calcular corredores con una red vial y polígonos de propagación, y enviar notificaciones mediante Web Push/SMS. La ruta mostrada debe identificarse siempre como recomendación complementaria a Protección Civil y 112.

## Aviso

Este MVP es demostrativo y no sustituye las instrucciones de emergencias. Para desplegarlo hacen falta validación con autoridades, pruebas de carga, auditoría de privacidad/consentimiento, retención mínima de ubicaciones y redundancia de proveedores.
