# 11. Proyectos finales

Elige una variante. No añadas las tres a la vez: cada una debe conservar el ciclo
fuente → validación → análisis determinista → interfaz → límites.

## A. Movilidad accesible

Construye un mapa de incidencias y accesos:

- fuente pública con licencia y actualización visibles;
- filtros por tipo de barrera;
- lista HTML y navegación por teclado;
- geolocalización solo durante la consulta;
- explicación IA limitada a resumir datos seleccionados;
- sin afirmar que una ruta es accesible si faltan datos.

## B. Agricultura y riego

Combina meteorología y parcelas ficticias:

- GeoJSON local de parcelas de ejemplo;
- humedad, precipitación y viento con unidades;
- reglas deterministas configurables;
- historial en PostGIS sin datos personales reales;
- IA que explica una recomendación ya calculada;
- presupuesto por finca, consulta y token.

## C. Mantenimiento de instalaciones

Representa activos e incidencias:

- puntos y polígonos con estado;
- formulario validado mediante función servidor;
- Supabase con políticas según rol en un proyecto separado;
- panel de fallos de proveedores;
- resumen IA sobre tickets, nunca cierre automático;
- despliegue preview y producción con bases distintas.

## Entregables obligatorios

1. `README.md` con problema, alcance y arranque.
2. Diagrama navegador/servidor/base/proveedores.
3. Inventario de datos, licencias y retención.
4. Matriz de costes para tres escalas y abuso.
5. Threat model con al menos ocho amenazas.
6. Tests de éxito, vacío, error, 429 y dato antiguo.
7. Evidencia de build y revisión móvil/teclado.
8. Preview pública sin secretos ni datos personales reales.
9. Procedimiento de apagado y rollback.
10. Lista honesta de funciones que la demo no ofrece.

## Rúbrica

| Criterio | 0 | 1 | 2 |
|---|---|---|---|
| fuentes | ocultas o ambiguas | visibles sin límites | visibles, fechadas, validadas y con fallback |
| geoespacial | coordenadas frágiles | cálculo funcional | tipos, índices y bordes probados |
| seguridad | secretos o acceso amplio | protección básica | mínimos privilegios, límites y rotación probada |
| privacidad | recoge por defecto | consentimiento parcial | minimización, eliminación y retención verificadas |
| IA | decide o inventa | prompt limitado | tarea acotada, validación, evals y modo apagado |
| costes | «plan gratuito» | estimación simple | tres escalas, abuso, alertas y kill switch |
| operación | solo funciona feliz | errores visibles | degradación, observabilidad y rollback |
| enseñanza | código sin guía | README básico | pasos, evidencia, fallos y decisiones explicados |

Puntuación recomendada para publicar como caso educativo: 13/16 y ningún cero en
seguridad, privacidad, IA o costes.

