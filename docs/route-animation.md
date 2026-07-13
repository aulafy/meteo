# Animación de rutas en METEO y GeoLibre

## Qué está verificado

GeoLibre 2.0 incorpora un motor de animación de rutas en TypeScript. El motor oficial anima cualquier capa lineal, calcula la posición por distancia recorrida y ofrece progreso, velocidad en metros por segundo, bucle, flecha orientada, rastro, seguimiento de cámara, elevación 3D y grabación de vídeo. La implementación está en [`maplibre-route-animation.ts`](https://github.com/opengeos/GeoLibre/blob/main/packages/plugins/src/plugins/maplibre-route-animation.ts).

El paquete Python `geolibre==2.0.0` incorpora la aplicación completa dentro de Jupyter. Su API permite crear el mapa, añadir GeoJSON, mover la cámara, guardar el proyecto y exportar HTML. La animación de rutas se controla actualmente desde `Controls → Route Animation` dentro del widget; no existe un método Python público dedicado a ese panel.

Dos correcciones respecto al texto recibido:

- `Map.fly_to(..., duration=300)` expresa la duración en milisegundos. `0.3` no representa 0,3 segundos.
- Los estilos de `Map.add_geojson()` usan nombres como `strokeColor` y `strokeWidth`, no `stroke_color` ni `stroke_width`.

## Decisión para METEO

El paquete `@geolibre/plugins` es un paquete privado del monorepo y arrastra Deck.gl y numerosos plugins que METEO no necesita. Por eso se ha reproducido únicamente el patrón mínimo de GeoLibre sobre la instancia MapLibre existente:

- fuente GeoJSON para la ruta;
- fuente GeoJSON para el rastro recorrido;
- fuente puntual para el marcador;
- flecha generada localmente y orientada con el rumbo;
- progreso interpolado por distancia, no por índice de vértice;
- velocidad visual en metros por segundo;
- seguimiento de cámara opcional;
- pausa, desplazamiento manual y preferencia de movimiento reducido.

La ruta importada nunca se mezcla con el motor de riesgo ni con las alertas. Se identifica como local y no verificada.

## Formatos

| Formato | Conserva bien | Limitaciones relevantes | Uso recomendado |
| --- | --- | --- | --- |
| GPX | Tracks, routes, waypoints, elevación y tiempos de puntos | No representa cortes, restricciones, refugios ni autoridad de la ruta | Recorridos GPS obtenidos sobre el terreno |
| KML | Geometría, nombres, estilos, carpetas, tiempos y ciertos overlays | Puede incluir NetworkLinks, modelos 3D, GroundOverlay y extensiones `gx:*` que un conversor ligero no conserva | Intercambio con Google Earth y organismos que publiquen KML |
| GeoJSON | Geometría web sencilla, propiedades y carga directa en MapLibre | No define semántica de ruta, seguridad, tiempos o estilos; RFC 7946 usa WGS84 `[longitud, latitud]` | Formato normalizado interno para la web |

METEO convierte GPX/KML a GeoJSON en el navegador mediante [`@tmcw/togeojson`](https://github.com/tmcw/togeojson). Para cada archivo conserva las líneas visibles, elige la línea de mayor longitud para la animación y descarta puntos/waypoints del motor de animación.

## Alternativas

### JavaScript

- Parsers nativos de GeoLibre: máxima compatibilidad con su aplicación, incluidos estilos KML, pero no están publicados como paquete independiente estable.
- `@tmcw/togeojson`: conversión pequeña y probada de GPX/KML a GeoJSON; es la opción usada en METEO.
- GDAL en WebAssembly o `maplibre-gl-duckdb`: admite muchos más formatos, a costa de un bundle y una superficie de ataque considerablemente mayores.
- `@maplibre/maplibre-gl-directions`: útil para solicitar y visualizar rutas de un motor de routing, pero no demuestra que una carretera sea segura durante un incendio.

### Python

- GeoLibre + GeoPandas/Pyogrio: flujo general recomendado en el notebook.
- `gpxpy`: mejor si hay que conservar y analizar tiempos, segmentos y elevaciones GPX individualmente.
- `fastkml`: mejor si hay que inspeccionar jerarquías, estilos o tiempos KML sin depender de GDAL.
- GDAL/OGR directamente: mayor cobertura de formatos y control, con más complejidad de despliegue.

## Controles de seguridad aplicados

- El archivo se lee en el navegador y no se sube a Vercel, Supabase ni Groq.
- Tamaño máximo: 5 MB.
- Máximo: 20.000 puntos lineales.
- Solo se aceptan coordenadas dentro del ámbito de España.
- Solo se animan `LineString`, `MultiLineString` y líneas dentro de `GeometryCollection`.
- El usuario debe aceptar que la ruta no está verificada antes de cargarla.
- No se calculan tiempos de llegada, refugios, carreteras abiertas ni órdenes.

Una ruta solo podría pasar a la categoría oficial si llegara firmada o publicada por una autoridad competente junto con vigencia, perímetro del incendio, cortes viarios y destino confirmado.
