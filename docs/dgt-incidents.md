# Incidencias y cortes de la DGT

METEO consulta el feed oficial [Incidencias DGT DATEX II v3.7](https://nap.dgt.es/es/dataset/incidencias-dgt-datex2-v3-7). La DGT declara una frecuencia de actualización de un minuto, licencia gratuita/CC BY y validación por sus Centros de Gestión y la Agrupación de Tráfico de la Guardia Civil.

El endpoint servidor `/api/dgt-incidents` descarga el XML oficial, conserva únicamente afecciones relevantes para una salida —carretera, calzada o carril cerrados, cortes intermitentes e incidencias relacionadas con fuego o humo— y las normaliza a JSON geográfico. La respuesta se almacena en caché durante 60 segundos para no multiplicar las consultas al servicio público.

## Lo que aparece en METEO

- tramos y puntos afectados sobre el mapa;
- diferencia entre carretera cortada, calzada cerrada, carril cerrado y corte intermitente;
- carretera, municipio, causa, hora de actualización y distancia a la ubicación consultada;
- aviso explícito cuando DGT no responde o sus datos llegan con retraso;
- incidencias cercanas suministradas a la IA sin enviarle coordenadas exactas del residente.

## Cobertura y límites

El feed cubre la red estatal española excepto Cataluña y País Vasco. No garantiza la presencia de calles locales, pistas forestales, controles policiales, caminos improvisados, perímetros del incendio, refugios o una orden de evacuación. La ausencia de una incidencia no demuestra que una vía esté abierta o sea segura.

La DGT aporta restricciones viales, pero no una ruta de evacuación oficial. METEO seguirá mostrando «No hay una ruta oficial disponible» salvo que una autoridad competente publique una ruta con vigencia, destino, perímetro y procedencia verificables. Una ruta GPX/KML/GeoJSON importada por el usuario permanece marcada como referencia local no verificada.

## IA

El prompt de Groq recibe un bloque estructurado `traffic` y otro `route`. Una cabecera determinista, generada por el servidor antes de mostrar la respuesta, garantiza que siempre se indique el estado real de la ruta y de la consulta DGT aunque el modelo redacte mal el resto.
