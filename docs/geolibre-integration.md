# GeoLibre aplicado a METEO

Auditoría actualizada contra [GeoLibre v2.1.0](https://github.com/opengeos/GeoLibre/releases/tag/v2.1.0), publicado el 14 de julio de 2026. No
se copia el conjunto completo de plugins: cada capacidad se evalúa por utilidad,
procedencia de datos, privacidad, licencia, coste de carga y riesgo de confusión.

## Auditoría del proyecto 3D compartido

El proyecto [`3d-tiles.geolibre.json`](https://share.geolibre.app/giswqs/3d-tiles.geolibre.json) demuestra dos capacidades:

- una capa WMTS con una captura histórica de Esri Wayback;
- un tileset 3D del edificio AGI HQ, situado en Pensilvania.

GeoLibre solicita además permiso antes de ejecutar el complemento 3D remoto porque un complemento externo obtiene acceso completo a la aplicación. METEO conserva ese principio de seguridad: no carga proyectos ni complementos remotos arbitrarios. El tileset y la captura concreta tampoco se incorporan porque no representan España ni una emergencia actual.

## Capacidades adoptadas

METEO reproduce sobre su instancia MapLibre los patrones de GeoLibre que sí ayudan en un incendio:

| Capacidad | Aplicación en METEO | Límite operativo |
|---|---|---|
| Control de capas | Panel único para relieve, satélite, viento y tiempo | No modifica el cálculo del riesgo |
| Terreno 3D y hillshade | DEM global AW3D30 de JAXA servido por MapLibre | Relieve de contexto; no modela propagación |
| Capa ráster | Esri World Imagery bajo las etiquetas del mapa | Imagen contextual; no es tiempo real |
| Time slider | Ventanas FIRMS de 1, 3, 6, 12 y 24 horas | Filtra solo la representación visual |
| Elevation profile | Hasta 100 muestras de la ruta con Open‑Meteo | Se consulta únicamente tras una acción explícita |
| Route animation | Flecha, rastro, progreso, velocidad y seguimiento | Ruta local no verificada |
| Carga diferida del importador | GPX/KML se descarga solo después de elegir un archivo | Reduce el arranque sin cambiar la validación local |
| Exportación | GeoJSON de detecciones visibles y ruta local | Excluye la ubicación precisa del usuario |
| Medición geodésica y sobre terreno | Distancia por puntos, con desnivel cuando el DEM está disponible | Medición visual; no representa una ruta transitable ni una distancia de evacuación |
| Parte imprimible | Resumen local con fecha, fuentes, capas y advertencias | No incluye coordenadas GPS ni sustituye un parte oficial |
| Comparación de capas | Transparencia independiente para imagen Esri, FWI y áreas quemadas EFFIS | Comparación visual; las capas no comparten fecha ni resolución |
| Resiliencia local | Última respuesta pública validada en IndexedDB, con caducidad por fuente | No almacena GPS y se rotula siempre como copia, nunca como dato en vivo |
| View state y controles | Escala métrica, pantalla completa, pitch y brújula | Ayudas cartográficas, no información oficial |
| Dirección del viento | Segmento desde la ubicación hacia sotavento | No es un cono ni una predicción de avance del fuego |

Referencias oficiales:

- [GeoLibre](https://github.com/opengeos/GeoLibre)
- [Control de terreno de GeoLibre](https://github.com/opengeos/GeoLibre/blob/main/packages/map/src/terrain-control.ts)
- [Time Slider de GeoLibre](https://github.com/opengeos/GeoLibre/blob/main/packages/plugins/src/plugins/maplibre-time-slider.ts)
- [Perfil de elevación de GeoLibre](https://github.com/opengeos/GeoLibre/tree/main/packages/plugins/src/plugins/elevation-profile)
- [Medición 3D de GeoLibre](https://github.com/opengeos/GeoLibre/blob/main/packages/plugins/src/plugins/terrain-measure.ts)
- [Terreno 3D en MapLibre](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/)
- [Elevation API de Open‑Meteo](https://open-meteo.com/en/docs/elevation-api)

## Capacidades pospuestas

- **Direcciones automáticas:** no se presentarán como evacuación hasta disponer de cortes de carretera, perímetros, refugios y órdenes oficiales actualizados.
- **Nubes, precipitación animada, sol y efectos atmosféricos:** tienen coste visual y de rendimiento sin añadir una señal operativa suficiente.
- **3D Tiles arbitrarios:** requieren código y datos externos de confianza; se evaluarán solo para datasets españoles con procedencia, licencia y fecha conocidas.
- **Compartir proyectos con ubicación:** se evita para no exponer accidentalmente el GPS de residentes.
- **Timelapse EOX:** GeoLibre añadió mosaicos anuales Sentinel-2, pero [EOX cambió sus términos en junio de 2026](https://cloudless.eox.at/documentation/license). El uso comercial requiere licencia y el producto anual no representa una emergencia actual; METEO no lo activa mientras no exista una decisión expresa de licencia y finalidad.
- **OpenAerialMap:** la búsqueda de imágenes recientes podría ayudar en un puesto técnico, pero necesita verificar fecha, cobertura, licencia y procedencia antes de ofrecerla a residentes.
- **PMTiles o mapas sin conexión completos:** el shell de la PWA ya abre sin red, pero una cartografía offline fiable exige paquetes regionales, licencia, actualización y almacenamiento que todavía no están resueltos.

## Capacidades descartadas para la interfaz de residentes

- **Grabación MP4 y vídeo de rutas:** aumenta consumo y no mejora una decisión urgente; el parte A4 es más verificable y ligero.
- **Detección YOLO/ONNX sobre imágenes:** no confirma incendios ni personas en peligro y puede crear falsos positivos sin un modelo y validación específicos.
- **DuckDB, Whitebox, PostGIS browser y gestores de servicios:** son herramientas de análisis profesional, no controles seguros para una pantalla de aviso ciudadano.
- **Tarjetas de Wikipedia, planetas, batimetría y fotos georreferenciadas:** no aportan una señal operativa a incendios en España.
- **Selector imperial o náutico:** METEO conserva kilómetros y metros para evitar mezclar unidades en España.
- **Plugins remotos y ejecución de IA sobre código:** se rechazan en el cliente público por superficie de ataque y porque no son necesarios para el flujo de emergencia.

## Privacidad y seguridad

La importación GPX/KML/GeoJSON sigue siendo local. Solo al pulsar «Calcular perfil de elevación» se envían a Open‑Meteo hasta 100 coordenadas muestreadas de la ruta. La exportación GeoJSON se genera en el navegador y declara que no contiene la ubicación precisa del usuario. La caché de resiliencia contiene exclusivamente respuestas públicas de FIRMS, DGT, Bombers y USGS; no contiene ubicación, consultas ni datos de cuenta.
