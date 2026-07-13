# GeoLibre aplicado a METEO

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
| Exportación | GeoJSON de detecciones visibles y ruta local | Excluye la ubicación precisa del usuario |
| View state y controles | Escala métrica, pantalla completa, pitch y brújula | Ayudas cartográficas, no información oficial |
| Dirección del viento | Segmento desde la ubicación hacia sotavento | No es un cono ni una predicción de avance del fuego |

Referencias oficiales:

- [GeoLibre](https://github.com/opengeos/GeoLibre)
- [Control de terreno de GeoLibre](https://github.com/opengeos/GeoLibre/blob/main/packages/map/src/terrain-control.ts)
- [Time Slider de GeoLibre](https://github.com/opengeos/GeoLibre/blob/main/packages/plugins/src/plugins/maplibre-time-slider.ts)
- [Perfil de elevación de GeoLibre](https://github.com/opengeos/GeoLibre/tree/main/packages/plugins/src/plugins/elevation-profile)
- [Terreno 3D en MapLibre](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/)
- [Elevation API de Open‑Meteo](https://open-meteo.com/en/docs/elevation-api)

## Capacidades pospuestas

- **Direcciones automáticas:** no se presentarán como evacuación hasta disponer de cortes de carretera, perímetros, refugios y órdenes oficiales actualizados.
- **Nubes, precipitación animada, sol y efectos atmosféricos:** tienen coste visual y de rendimiento sin añadir una señal operativa suficiente.
- **3D Tiles arbitrarios:** requieren código y datos externos de confianza; se evaluarán solo para datasets españoles con procedencia, licencia y fecha conocidas.
- **Compartir proyectos con ubicación:** se evita para no exponer accidentalmente el GPS de residentes.

## Privacidad y seguridad

La importación GPX/KML/GeoJSON sigue siendo local. Solo al pulsar «Calcular perfil de elevación» se envían a Open‑Meteo hasta 100 coordenadas muestreadas de la ruta. La exportación GeoJSON se genera en el navegador y declara que no contiene la ubicación precisa del usuario.
