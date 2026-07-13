# Integración Copernicus EFFIS

## Qué se integra

METEO consume el servicio WMS oficial de EFFIS publicado en `https://maps.effis.emergency.copernicus.eu/effis`:

- `mf010.fwi`: Fire Weather Index diario de Meteo‑France. Es peligro meteorológico modelado, no una detección de fuego.
- `effis.nrt.ba.poly`: áreas quemadas NRT de la temporada. Es una estimación cartográfica de superficie afectada, no el frente activo ni un perímetro operativo de evacuación.

Las capas se cargan mediante especificaciones estándar de MapLibre: una imagen georreferenciada para FWI y teselas WMS en Web Mercator para las áreas quemadas. Permanecen desactivadas por defecto para no ocultar carreteras, focos FIRMS o la ubicación seleccionada.

## Por qué no se duplican los focos EFFIS

EFFIS declara que sus detecciones activas proceden de NASA FIRMS y que normalmente se publican entre dos y tres horas después de la adquisición. METEO ya ingiere FIRMS directamente cada 15 minutos. Mostrar ambos conjuntos como detecciones independientes duplicaría puntos y podría dar una falsa sensación de confirmación.

EFFIS aporta en esta fase dos señales distintas y útiles: peligro meteorológico diario y huella quemada. Ninguna se usa por sí sola para subir el nivel local, enviar una alerta, confirmar un incendio o calcular una ruta.

## Licencia y procedencia

Los datos se reutilizan bajo la política de la Comisión Europea y CC BY 4.0, con atribución visible a `EFFIS/Copernicus · © Unión Europea`. La interfaz enlaza al visor oficial y conserva la leyenda publicada por el propio WMS.

Fuentes oficiales:

- [Instrucciones de descarga y WMS](https://forest-fire.emergency.copernicus.eu/downloads-instructions)
- [Catálogo de datos y servicios](https://forest-fire.emergency.copernicus.eu/applications/data-and-services)
- [Licencia de datos](https://forest-fire.emergency.copernicus.eu/about-effis/data-license)
- [Metodología de focos activos](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/active-fire-detection)

## Límites operativos

- El FWI tiene resolución y frecuencia de modelo; no describe viento o humedad a escala de una calle.
- Un área quemada NRT puede actualizarse después del avance real del fuego.
- Una imagen WMS no contiene por sí sola una orden, una carretera cortada, un refugio o una ruta de evacuación.
- La IA de METEO no recibe ni interpreta los píxeles WMS. Solo explica datos estructurados que la aplicación puede atribuir y validar.
